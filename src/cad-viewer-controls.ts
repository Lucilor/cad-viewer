import { Point, Rectangle } from "@lucilor/utils";
import {CadDimension, CadEntities, CadEntity} from "./cad-data/cad-entities";
import {CadViewer} from "./cad-viewer";

let pointer: {from: Point; to: Point} | null = null;
let button: number | null = null;
let multiSelector: HTMLDivElement | null = null;
let entitiesToDrag: CadEntities | null = null;
let entitiesNotToDrag: CadEntities | null = null;
let draggingDimension: CadDimension | null = null;
let needsRender = false;

export interface CadEvents {
    pointerdown: [PointerEvent];
    pointermove: [PointerEvent];
    pointerup: [PointerEvent];
    click: [MouseEvent];
    wheel: [WheelEvent];
    keydown: [KeyboardEvent];
    entityclick: [MouseEvent, CadEntity];
    entitypointerdown: [PointerEvent, CadEntity];
    entitypointermove: [PointerEvent, CadEntity];
    entitypointerup: [PointerEvent, CadEntity];
    entitiesselect: [CadEntities, boolean];
    entitiesunselect: [CadEntities, boolean];
    entitiesremove: [CadEntities];
    entitiesadd: [CadEntities];
    entitiescopy: [CadEntities];
    entitiespaste: [CadEntities];
    render: [CadEntities];
    moveentities: [CadEntities];
    zoom: [];
}
export type CadEventCallBack<T extends keyof CadEvents> = (...params: CadEvents[T]) => void;

function onWheel(this: CadViewer, event: WheelEvent) {
    event.preventDefault();
    this.emit("wheel", event);
    if (!this.config("enableZoom")) {
        return;
    }
    const step = 0.1;
    const {deltaY, clientX, clientY} = event;
    const {x, y} = this.getWorldPoint(clientX, clientY);
    const zoom = this.zoom();
    if (deltaY > 0) {
        this.zoom(zoom * (1 - step), [x, y]);
    } else if (deltaY < 0) {
        this.zoom(zoom * (1 + step), [x, y]);
    }
}

function onClick(this: CadViewer, event: MouseEvent) {
    event.preventDefault();
    this.dom.focus();
    if (this.entitiesCopied) {
        this.emit("entitiespaste", this.entitiesCopied);
        this.entitiesCopied = undefined;
    } else {
        this.emit("click", event);
    }
}

function onPointerDown(this: CadViewer, event: PointerEvent) {
    event.preventDefault();
    const {clientX, clientY, button: eBtn} = event;
    const point = new Point(clientX, clientY);
    pointer = {from: point, to: point.clone()};
    button = eBtn;
    if (multiSelector) {
        multiSelector.remove();
        multiSelector = null;
    }
    this.emit("pointerdown", event);
}

function onPointerMove(this: CadViewer, event: PointerEvent) {
    event.preventDefault();
    const {clientX, clientY, shiftKey} = event;
    if (this.entitiesCopied && !pointer) {
        const point = new Point(clientX, clientY);
        pointer = {from: point, to: point.clone()};
    }
    if (pointer) {
        const {selectMode, entityDraggable, dragAxis} = this.config();
        const {from, to} = pointer;
        const translate = new Point(clientX, clientY).sub(to).divide(this.zoom());
        if (this.entitiesCopied) {
            const entities = this.entitiesCopied;
            translate.y = -translate.y;
            entities.transform({translate});
        } else if ((button === 0 && shiftKey) || button === 1) {
            if (!dragAxis.includes("x")) {
                translate.x = 0;
            }
            if (!dragAxis.includes("y")) {
                translate.y = 0;
            }
            this.move(translate.x, -translate.y);
        } else if (button === 0) {
            if (entitiesToDrag && entitiesNotToDrag && entityDraggable) {
                if (Array.isArray(entityDraggable)) {
                    const toRemove: CadEntity[] = [];
                    entitiesToDrag.forEach((e) => {
                        if (!entityDraggable.includes(e.type)) {
                            toRemove.push(e);
                        }
                    });
                    for (const e of toRemove) {
                        entitiesToDrag.remove(e).add(...e.children.toArray());
                        entitiesNotToDrag.add(e);
                    }
                }
                this.moveEntities(entitiesToDrag, entitiesNotToDrag, translate.x, -translate.y);
                needsRender = true;
            } else if (draggingDimension) {
                const [p1, p2] = this.data.getDimensionPoints(draggingDimension).map((v) => this.getScreenPoint(v.x, v.y));
                if (p1 && p2) {
                    const left = Math.min(p1.x, p2.x);
                    const right = Math.max(p1.x, p2.x);
                    const top = Math.max(p1.y, p2.y);
                    const bottom = Math.min(p1.y, p2.y);
                    if (draggingDimension.axis === "x") {
                        if (clientX >= left && clientX <= right) {
                            draggingDimension.distance -= translate.y;
                        } else if (clientY >= bottom && clientY <= top) {
                            draggingDimension.axis = "y";
                            if (clientX <= left) {
                                draggingDimension.distance = clientX - left;
                            } else {
                                draggingDimension.distance = clientX - right;
                            }
                            draggingDimension.distance = clientX - left;
                        } else {
                            draggingDimension.distance -= translate.y;
                        }
                    }
                    if (draggingDimension.axis === "y") {
                        if (clientY >= bottom && clientY <= top) {
                            draggingDimension.distance += translate.x;
                        } else if (clientX >= left && clientX <= right) {
                            draggingDimension.axis = "x";
                            if (clientY >= top) {
                                draggingDimension.distance = top - clientY;
                            } else {
                                draggingDimension.distance = bottom - clientY;
                            }
                        } else {
                            draggingDimension.distance += translate.x;
                        }
                    }
                    this.render(draggingDimension);
                }
            } else if (selectMode === "multiple" && from.distanceTo(to) > 1) {
                if (!multiSelector) {
                    multiSelector = document.createElement("div");
                    multiSelector.classList.add("multi-selector");
                    this.dom.appendChild(multiSelector);
                }
                multiSelector.style.left = Math.min(from.x, to.x) + "px";
                multiSelector.style.top = Math.min(from.y, to.y) + "px";
                multiSelector.style.width = Math.abs(from.x - to.x) + "px";
                multiSelector.style.height = Math.abs(from.y - to.y) + "px";
            }
        }
        to.set(clientX, clientY);
    }
    this.emit("pointermove", event);
}

function onPointerUp(this: CadViewer, event: PointerEvent) {
    event.preventDefault();
    if (pointer) {
        const {from, to} = pointer;
        if (from.distanceTo(to) < 1) {
            this.emit("click", event);
        } else if (multiSelector) {
            const rect = new Rectangle(from, to).justify();
            const toSelect = Array<CadEntity>();
            this.data.getAllEntities().forEach((e) => {
                const domRect = e.el?.node.getBoundingClientRect();
                if (!domRect) {
                    return;
                }
                const {top, right, bottom, left} = domRect;
                const rect2 = new Rectangle(new Point(left, top), new Point(right, bottom));
                if (rect.contains(rect2)) {
                    toSelect.push(e);
                }
            });
            if (toSelect.every((e) => e.selected)) {
                this.unselect(toSelect);
            } else {
                this.select(toSelect);
            }
            multiSelector.remove();
            multiSelector = null;
        }
    }
    pointer = null;
    button = null;
    if (needsRender) {
        needsRender = false;
        this.render();
    }
    entitiesToDrag = entitiesNotToDrag = draggingDimension = null;
    this.emit("pointerup", event);
}

function onKeyDown(this: CadViewer, event: KeyboardEvent) {
    const {key, ctrlKey} = event;
    if (key === "Escape") {
        this.unselectAll();
        event.preventDefault();
    } else if (ctrlKey) {
        if (key === "a") {
            event.preventDefault();
            this.selectAll();
        } else if (key === "c") {
            event.preventDefault();
            this.entitiesCopied = this.selected().clone(true);
            this.emit("entitiescopy", this.entitiesCopied);
        } else if (key === "v") {
            event.preventDefault();
            if (this.entitiesCopied) {
                this.emit("entitiespaste", this.entitiesCopied);
                this.entitiesCopied = undefined;
            }
        }
    } else if (key === "Delete" || key === "Backspace") {
        event.preventDefault();
        this.remove(this.selected());
    } else if (key === "Enter") {
        if (this.entitiesCopied) {
            event.preventDefault();
            this.emit("entitiespaste", this.entitiesCopied);
            this.entitiesCopied = undefined;
        }
    }
    this.emit("keydown", event);
}

function onEntityClick(this: CadViewer, event: MouseEvent, entity: CadEntity) {
    event.stopImmediatePropagation();
    const selectMode = this.config("selectMode");
    if (selectMode === "single" || selectMode === "multiple") {
        if (selectMode === "single") {
            this.unselectAll();
        }
        if (entity.selected) {
            this.unselect(entity);
        } else {
            this.select(entity);
        }
    }
    this.emit("entityclick", event, entity);
    this.dom.focus();
}

function onEntityPointerDown(this: CadViewer, event: PointerEvent, entity: CadEntity) {
    if (this.config("entityDraggable")) {
        if (entity instanceof CadDimension) {
            draggingDimension = entity;
        } else {
            entitiesToDrag = this.selected();
            entitiesNotToDrag = this.unselected();
        }
    }
    this.emit("entitypointerdown", event, entity);
}

function onEntityPointerMove(this: CadViewer, event: PointerEvent, entity: CadEntity) {
    this.emit("entitypointermove", event, entity);
}

function onEntityPointerUp(this: CadViewer, event: PointerEvent, entity: CadEntity) {
    this.emit("entitypointerup", event, entity);
}

export const controls = {
    onWheel,
    onClick,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onKeyDown,
    onEntityClick,
    onEntityPointerDown,
    onEntityPointerMove,
    onEntityPointerUp
};
