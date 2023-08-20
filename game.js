//@ts-check
/** @typedef {{ holders: Set<FakeObject>; holding: Set<FakeObject>; x: number; y: number; type: number; }} FakeObject */

const canvas = document.body.appendChild(document.createElement("canvas"));
const ctx = canvas.getContext("2d") ?? ((() => { throw "ctx is null" })());
const SLOT_EDGE_COUNT = 9;
const SLOT_WIDTH = Math.trunc(document.body.clientHeight / SLOT_EDGE_COUNT);
const DOT_SIZE = 0.75;
const DOT_WIDTH = SLOT_WIDTH * DOT_SIZE;
const DOT_OFFSET = ((SLOT_WIDTH - DOT_WIDTH) / 2);
const CANVAS_WIDTH = canvas.width = canvas.height = SLOT_EDGE_COUNT * SLOT_WIDTH;
const GARBAGE_COLOR = "grey";
const ROOT_COLOR = "orange";
const OBJECT_COLOR = "grey";
const OBJECT_COUNT = 1 + Math.trunc(SLOT_EDGE_COUNT * SLOT_EDGE_COUNT / 5);
const GARBAGE_COUNT = Math.trunc(OBJECT_COUNT * 2.5);

const drawSlot = (type, x, y) => {
    if (type === 0) {
        ctx.fillStyle = ROOT_COLOR
    } else if (type === 1) {
        ctx.fillStyle = OBJECT_COLOR
    } else {
        ctx.fillStyle = GARBAGE_COLOR
    }
    ctx.fillRect(x * SLOT_WIDTH + DOT_OFFSET, y * SLOT_WIDTH + DOT_OFFSET, DOT_WIDTH, DOT_WIDTH);
};

let /** @type {(FakeObject[][][])?} */ slots = null;

const generateSlots = () => {
    const rootedTree = [];
    rootedTree.length = OBJECT_COUNT;
    {
        const LAST = OBJECT_COUNT - 1;
        const root = {
            holders: new Set, holding: new Set,
            x: 0, y: 0,
            type: 0
        };
        rootedTree[LAST] = root;
        for (let i = 0; i < LAST; i++) {
            const target = {
                holders: new Set, holding: new Set,
                x: 0, y: 0,
                type: 1
            };
            rootedTree[i] = target;
            const holder = (() => {
                const index = Math.trunc(Math.random() * (i + 1));
                if (index < i) {
                    return rootedTree[index];
                }
                return root;
            })();
            holder.holding.add(target);
            target.holders.add(holder)
        }
    }
    for (let i = Math.trunc(OBJECT_COUNT / 3); i > 0; i--) { // add random ref
        const holderIndex = Math.trunc(Math.random() * OBJECT_COUNT);
        const targetIndex = (() => {
            const targetIndex = Math.trunc(Math.random() * (OBJECT_COUNT - 1));
            if (targetIndex < holderIndex) {
                return targetIndex;
            }
            return targetIndex + 1;
        })(); // Rust let-else
        const { [targetIndex]: target, [holderIndex]: holder } = rootedTree;
        target.holders.add(holder);
        holder.holding.add(target)
    }
    const unrootedObjects = [];
    unrootedObjects.length = GARBAGE_COUNT;
    for (let i = 0; i < GARBAGE_COUNT; i++) {
        unrootedObjects[i] = {
            holders: new Set, holding: new Set,
            x: 0, y: 0,
            type: 2
        }
    }
    for (let i = GARBAGE_COUNT * 2; i > 0; i--) { // random ref
        const holderIndex = Math.trunc(Math.random() * GARBAGE_COUNT);
        const targetIndex = (() => {
            const targetIndex = Math.trunc(Math.random() * (GARBAGE_COUNT - 1));
            if (targetIndex < holderIndex) {
                return targetIndex;
            }
            return targetIndex + 1;
        })();
        const { [targetIndex]: target, [holderIndex]: holder } = unrootedObjects;
        target.holders.add(holder);
        holder.holding.add(target)
    }
    for (let i = OBJECT_COUNT; i > 0; i--) { // add ref towards tree
        const { [Math.trunc(Math.random() * GARBAGE_COUNT)]: holder } = unrootedObjects;
        const { [Math.trunc(Math.random() * OBJECT_COUNT)]: target } = rootedTree;
        target.holders.add(holder);
        holder.holding.add(target)
    }

    slots = [];
    slots.length = SLOT_EDGE_COUNT;
    for (let i = 0; i < SLOT_EDGE_COUNT; i++) {
        const arr = [];
        arr.length = SLOT_EDGE_COUNT;
        for (let i = 0; i < SLOT_EDGE_COUNT; i++) {
            arr[i] = []
        }
        slots[i] = arr
    }
    const TOTAL = OBJECT_COUNT + GARBAGE_COUNT;
    const arr = [];
    arr.length = TOTAL;
    let garbageLeft = GARBAGE_COUNT;
    let objectLeft = OBJECT_COUNT - 1;
    for (let i = 0; i < TOTAL; i++) {
        if ((Math.random() < OBJECT_COUNT / TOTAL || garbageLeft < 1) && objectLeft > 0) {
            arr[i] = rootedTree[--objectLeft];
            continue;
        }
        arr[i] = unrootedObjects[--garbageLeft]
    }
    arr[TOTAL - 1] = rootedTree[OBJECT_COUNT - 1];
    slots[0][0] = arr
}
let selectedX = null;
let selectedY = null;
const drawSlots = () => {
    if (!slots) {
        throw "slot is null";
    }
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_WIDTH);
    const pending = [];
    const done = new Set;
    for (let x = 0; x < SLOT_EDGE_COUNT; x++) {
        const element = slots[x];
        for (let y = 0; y < SLOT_EDGE_COUNT; y++) {
            const slot = element[y];
            const LAST = slot.length - 1;
            if (LAST < 0) {
                continue;
            }
            const { type } = slot[LAST];
            pending.push(() => { drawSlot(type, x, y) }); // delayed render
            for (let i = LAST; i > -1; i--) {
                const { x, y, holders } = slot[i];
                for (const { x: holderX, y: holderY } of holders) {
                    if ((x === holderX && y === holderY) || done.has(`${holderX}_${holderY}_${x}_${y}`)) {
                        continue;
                    }
                    done.add(`${holderX}_${holderY}_${x}_${y}`);
                    ctx.beginPath();
                    ctx.strokeStyle = "white";
                    const centerX = (x + 0.5) * SLOT_WIDTH;
                    const centerY = (y + 0.5) * SLOT_WIDTH;
                    ctx.moveTo((holderX + 0.5) * SLOT_WIDTH, (holderY + 0.5) * SLOT_WIDTH);
                    ctx.lineTo(centerX, centerY);
                    ctx.stroke();
                    ctx.beginPath();
                    ctx.fillStyle = "white";
                    ctx.moveTo(centerX, centerY);
                    const rad = Math.atan2(x - holderX, y - holderY);
                    const left = rad + 0.08;
                    const right = rad - 0.08;
                    ctx.lineTo(centerX - Math.sin(left) * SLOT_WIDTH, centerY - Math.cos(left) * SLOT_WIDTH);
                    ctx.lineTo(centerX - Math.sin(right) * SLOT_WIDTH, centerY - Math.cos(right) * SLOT_WIDTH);
                    ctx.closePath();
                    ctx.fill()
                }
            }
        }
    }
    for (let i = pending.length - 1; i > -1; i--) { // avoid length re-getting
        (pending[i])()
    }
    if (selectedX !== null) {
        ctx.strokeStyle = "white";
        ctx.strokeRect(selectedX * SLOT_WIDTH, selectedY * SLOT_WIDTH, SLOT_WIDTH, SLOT_WIDTH)
    }
};
const moveObj = (x, y) => {
    if (!slots) {
        throw "slot is null";
    }
    const slotSrc = slots[selectedX][selectedY];
    const obj = /** @type {FakeObject} */(slotSrc.pop());
    obj.x = x;
    obj.y = y;
    const slot = slots[x][y];
    const LAST = slot.length - 1;
    const top = slot[LAST];

    if (LAST < 0 || top.type > 0) {
        slot.push(obj);
        return;
    }
    slot.push(top);
    slot[LAST] = obj;
};
let freed = 0;
const freeSlot = () => {
    if (!slots) {
        throw "slot is null";
    }
    const slot = slots[selectedX][selectedY];
    const { length } = slot;
    if (slot[length - 1].type === 0) {
        console.log("can not free root object");
        return;
    }
    for (let i = 0; i < length; i++) {
        for (const holder of slot[i].holders) {
            if (holder.x !== selectedX || holder.y !== selectedY) {
                console.log("can not free object has ref");
                return;
            }
        }
    }
    for (let i = length - 1; i > -1; i--) {
        const element = slot[i];
        for (const orph of element.holding) {
            orph.holders.delete(element);
            element.holding.delete(orph)
        }
    }
    slots[selectedX][selectedY] = [];
    console.log("freed objects");
    freed += length;
    if (freed === GARBAGE_COUNT) {
        console.log("finished");
        alert("Finished!")
    }
};
canvas.addEventListener("click", (event) => {
    if (!slots) {
        throw "slot is null";
    }
    const { offsetX, offsetY, target } = event;
    const { clientWidth, clientHeight } = /** @type {HTMLCanvasElement} */(target);
    const x = Math.trunc(offsetX / clientWidth * SLOT_EDGE_COUNT);
    const y = Math.trunc(offsetY / clientHeight * SLOT_EDGE_COUNT);
    console.log("clicked", x, y);
    console.log("selected", selectedX, selectedY);

    if (selectedX !== null) {
        if (selectedX === x && selectedY === y) {
            freeSlot();
            selectedX = null;
            selectedY = null;
            drawSlots();
            return;
        }
        moveObj(x, y);
        selectedX = null;
        selectedY = null;
        drawSlots();
        return;
    }
    if (slots[x][y].length > 0) {
        selectedX = x;
        selectedY = y;
        drawSlots();
        return;
    }
    console.log("can not select empty slot")
    console.log(slots[x][y])
});

generateSlots();
drawSlots();
