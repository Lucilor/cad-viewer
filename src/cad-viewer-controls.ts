import {Point, Rectangle} from "@lucilor/utils";
import {CadEntities} from "./cad-data/cad-entities";
import {CadDimension, CadEntity} from "./cad-data/cad-entity";
import {CadDimensionLinear} from "./cad-data/cad-entity/cad-dimension-linear";
import {CadViewer} from "./cad-viewer";

let pointer: {from: Point; to: Point} | null = null;
let button: number | null = null;
let multiSelector: HTMLDivElement | null = null;
let entitiesToDrag: CadEntities | null = null;
let entitiesNotToDrag: CadEntities | null = null;
let draggingDimension: CadDimension | null = null;
let toRender: CadEntities | null = null;

export interface CadEvents {
  pointerdown: [PointerEvent];
  pointermove: [PointerEvent];
  pointerup: [PointerEvent];
  click: [MouseEvent];
  wheel: [WheelEvent];
  keydown: [KeyboardEvent];
  entityclick: [MouseEvent, CadEntity];
  entitydblclick: [MouseEvent, CadEntity];
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
  moveentities: [CadEntities, [number, number]];
  zoom: [];
}
export type CadEventCallBack<T extends keyof CadEvents> = (...params: CadEvents[T]) => void;

function onWheel(this: CadViewer, event: WheelEvent) {
  event.preventDefault();
  this.emit("wheel", event);
  if (!this.getConfig("enableZoom")) {
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
    const {selectMode, entityDraggable, dragAxis} = this.getConfig();
    const {from, to} = pointer;
    const translate = new Point(clientX, clientY).sub(to).divide(this.zoom());
    if (this.entitiesCopied) {
      const entities = this.entitiesCopied;
      translate.y = -translate.y;
      entities.transform({translate}, false);
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
            entitiesToDrag.remove(e);
            entitiesNotToDrag.add(e);
          }
        }
        toRender = this.moveEntities(entitiesToDrag, entitiesNotToDrag, translate.x, -translate.y);
      } else if (draggingDimension) {
        const [p1, p2] = this.data.getDimensionPoints(draggingDimension).map((v) => this.getScreenPoint(v.x, v.y));
        if (p1 && p2) {
          const left = Math.min(p1.x, p2.x);
          const right = Math.max(p1.x, p2.x);
          const top = Math.max(p1.y, p2.y);
          const bottom = Math.min(p1.y, p2.y);
          if (draggingDimension instanceof CadDimensionLinear) {
            const distance = draggingDimension.getDistance();
            if (draggingDimension.axis === "x") {
              if (clientX >= left && clientX <= right) {
                draggingDimension.setDistance(distance - translate.y);
              } else if (clientY >= bottom && clientY <= top) {
                draggingDimension.switchAxis();
                if (clientX <= left) {
                  draggingDimension.setDistance(clientX - left);
                } else {
                  draggingDimension.setDistance(clientX - right);
                }
              } else {
                draggingDimension.setDistance(distance - translate.y);
              }
            }
            if (draggingDimension.axis === "y") {
              if (clientY >= bottom && clientY <= top) {
                draggingDimension.setDistance(distance + translate.x);
              } else if (clientX >= left && clientX <= right) {
                draggingDimension.switchAxis();
                if (clientY >= top) {
                  draggingDimension.setDistance(top - clientY);
                } else {
                  draggingDimension.setDistance(bottom - clientY);
                }
              } else {
                draggingDimension.setDistance(distance + translate.x);
              }
            }
          } else {
            console.log(draggingDimension);
          }
          this.render(draggingDimension);
        }
      } else if (selectMode === "multiple" && from.distanceTo(to) > 1) {
        if (!multiSelector) {
          multiSelector = document.createElement("div");
          multiSelector.classList.add("multi-selector");
          this.dom.appendChild(multiSelector);
        }
        const rect = this.dom.getBoundingClientRect();
        const x = Math.min(from.x, to.x) - rect.left;
        const y = Math.min(from.y, to.y) - rect.top;
        const w = Math.abs(from.x - to.x);
        const h = Math.abs(from.y - to.y);
        multiSelector.style.left = x + "px";
        multiSelector.style.top = y + "px";
        multiSelector.style.width = w + "px";
        multiSelector.style.height = h + "px";
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
      if (this.entitiesCopied) {
        this.emit("entitiespaste", this.entitiesCopied);
        this.entitiesCopied = undefined;
      } else {
        this.emit("click", event);
      }
    } else if (multiSelector) {
      const selectorRect = Rectangle.fromDomRect(multiSelector.getBoundingClientRect());
      const toSelect = Array<CadEntity>();
      this.data.getAllEntities().forEach((e) => {
        const elDomRect = e.el?.node.getBoundingClientRect();
        if (!elDomRect) {
          return;
        }
        const elRect = Rectangle.fromDomRect(elDomRect);
        if (selectorRect.contains(elRect)) {
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
  if (toRender) {
    this.render(toRender);
    toRender = null;
  }
  entitiesToDrag = entitiesNotToDrag = draggingDimension = null;
  this.dom.focus();
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
  if (!entity.selectable) {
    return;
  }
  const selectMode = this.getConfig("selectMode");
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

function onEntityDoubleClick(this: CadViewer, event: MouseEvent, entity: CadEntity) {
  event.stopImmediatePropagation();
  if (!entity.selectable) {
    return;
  }
  this.emit("entitydblclick", event, entity);
  this.dom.focus();
}

function onEntityPointerDown(this: CadViewer, event: PointerEvent, entity: CadEntity) {
  if (this.getConfig("entityDraggable") && entity.selectable) {
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
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onKeyDown,
  onEntityClick,
  onEntityDoubleClick,
  onEntityPointerDown,
  onEntityPointerMove,
  onEntityPointerUp
};
