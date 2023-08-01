import {getTypeOf, Matrix, MatrixLike, ObjectOf, Rectangle} from "@lucilor/utils";
import {G, Matrix as Matrix2, Svg} from "@svgdotjs/svg.js";
import {cloneDeep} from "lodash";
import {v4} from "uuid";
import {Defaults, lineweight2linewidth, linewidth2lineweight, purgeObject} from "../../cad-utils";
import {ColoredObject} from "../../colored-object";
import {CadEntities} from "../cad-entities";
import {CadLayer} from "../cad-layer";
import {EntityType} from "../cad-types";

export abstract class CadEntity extends ColoredObject {
  id: string;
  abstract type: EntityType;
  layer: string;
  info: ObjectOf<any>;
  parent: CadEntity | null = null;
  children: CadEntities;
  el?: G | null;
  updateInfo: {matrix?: Matrix} = {};
  calcBoundingRect = true;
  calcBoundingRectForce = false;
  protected abstract get _boundingRectCalc(): Rectangle;
  private _root: CadEntities | null = null;
  get root() {
    if (this.parent) {
      return this.parent._root;
    }
    return this._root;
  }
  set root(value) {
    this._root = value;
    this.children.root = value?.root ?? null;
  }
  linewidth: number;
  _lineweight: number;
  dashArray?: number[];

  get rootEl() {
    if (this.el) {
      for (const parent of this.el.parents()) {
        if (parent instanceof Svg) {
          return parent;
        }
      }
    }
    return null;
  }

  get boundingRect() {
    const {el, rootEl} = this;
    if (!el || !rootEl || isNaN(this.scale)) {
      return this._boundingRectCalc;
    }
    const {x, y, x2, y2} = el.bbox();
    return new Rectangle([x, y], [x2, y2]);
  }

  get scale() {
    const rootEl = this.rootEl;
    return rootEl ? rootEl.zoom() : NaN;
  }

  protected _selectable?: boolean;
  get selectable() {
    return !!this._selectable;
  }
  set selectable(value) {
    if (this.el) {
      if (value) {
        this.el.addClass("selectable");
      } else {
        this.el.removeClass("selectable");
      }
    }
    this._selectable = value;
    this.children.forEach((c) => (c.selectable = value));
  }

  protected _selected = false;
  get selected() {
    return this._selected;
  }
  set selected(value) {
    if (this.el) {
      if (value && this.selectable) {
        this.el.addClass("selected");
      } else {
        this.el.removeClass("selected");
      }
    }
    this._selected = value;
    this.children.forEach((c) => (c.selected = value));
  }

  protected _opacity = 0;
  get opacity() {
    if (this.el) {
      return Number(this.el.css("opacity") ?? 1);
    } else {
      return this._opacity;
    }
  }
  set opacity(value) {
    if (this.el) {
      this.el.css("opacity", value.toString());
    }
    this._opacity = value;
    this.children.forEach((c) => (c.opacity = value));
  }

  private _visible = true;
  get visible() {
    if (this.el) {
      return this.el.css("display") !== "none";
    } else {
      return this._visible;
    }
  }
  set visible(value) {
    if (this.el) {
      this.el.css("display", value ? "" : "none");
    }
    this._visible = value;
    this.children.forEach((c) => (c.visible = value));
  }

  constructor(data: ObjectOf<any> = {}, layers: CadLayer[] = [], resetId = false) {
    super();
    if (getTypeOf(data) !== "object") {
      throw new Error("Invalid data.");
    }
    if (typeof data.id === "string" && !resetId) {
      this.id = data.id;
    } else {
      this.id = v4();
    }
    this.layer = data.layer ?? "0";
    if (typeof data.color === "number") {
      if (data.color === 256) {
        const layer = layers.find((l) => l.name === this.layer);
        if (layer) {
          this.setColor(layer.getColor());
        }
      } else {
        this.setIndexColor(data.color);
      }
    }
    if (typeof data.info === "object" && !Array.isArray(data.info)) {
      this.info = cloneDeep(data.info);
    } else {
      this.info = {};
    }
    this.children = new CadEntities(data.children, [], resetId);
    this.children.forEach((c) => (c.parent = this));
    this.selectable = data.selectable ?? true;
    this.selected = data.selected ?? false;
    if (data.parent instanceof CadEntity) {
      this.parent = data.parent;
    }
    this.visible = data.visible ?? cadEntityDefaultValues.visible;
    this.opacity = data.opacity ?? cadEntityDefaultValues.opacity;
    this.calcBoundingRect = data.calcBoundingRect ?? cadEntityDefaultValues.calcBoundingRect;
    this.calcBoundingRectForce = data.calcBoundingRectForce ?? cadEntityDefaultValues.calcBoundingRectForce;
    this.linewidth = data.linewidth ?? 1;
    this._lineweight = -3;
    if (typeof data.lineweight === "number") {
      this._lineweight = data.lineweight;
      if (data.lineweight >= 0) {
        this.linewidth = lineweight2linewidth(data.lineweight);
      } else if (data.lineweight === -1) {
        const layer = layers.find((l) => l.name === this.layer);
        if (layer) {
          this.linewidth = layer.linewidth;
        }
      }
    }
    if (typeof data.linetype === "string" && (data.linetype as string).toLowerCase().includes("dash")) {
      this.dashArray = Defaults.DASH_ARRAY;
    } else if (Array.isArray(data.dashArray) && data.dashArray.length > 0) {
      this.dashArray = cloneDeep(data.dashArray);
    }
  }

  transform(matrix: MatrixLike, alter: boolean, isFromParent?: boolean): CadEntity {
    if (alter) {
      this._transform(matrix, isFromParent);
    } else {
      const el = this.el;
      const matrix2 = new Matrix(matrix);
      if (el) {
        const oldMatrix = new Matrix2(el.transform());
        el.transform(oldMatrix.transform(matrix2));
      }
      if (this.updateInfo.matrix) {
        this.updateInfo.matrix.transform(matrix2);
      } else {
        this.updateInfo.matrix = matrix2;
      }
    }
    this.children.forEach((e) => {
      e.transform(matrix, alter, true);
    });
    return this;
  }

  protected abstract _transform(matrix: MatrixLike, isFromParent?: boolean): void;

  update(isFromParent?: boolean) {
    if (this.el) {
      if (typeof this._selectable === "boolean") {
        this.selectable = this._selectable;
      }
      if (typeof this._selected === "boolean") {
        this.selected = this._selected;
      }
      if (typeof this._opacity === "number") {
        this.opacity = this._opacity;
      }
      if (typeof this._visible === "boolean") {
        this.visible = this._visible;
      }
    }
    const matrix = this.updateInfo.matrix;
    if (matrix) {
      if (!isFromParent) {
        this.transform(matrix, true);
      }
      delete this.updateInfo.matrix;
      this.el?.transform({});
    }
    this.children.forEach((child) => {
      child.parent = this;
    });
  }

  export(): ObjectOf<any> {
    this.update();
    return purgeObject(
      {
        id: this.id,
        layer: this.layer,
        type: this.type,
        color: this.getIndexColor(),
        children: this.children.export(),
        info: this.info,
        lineweight: linewidth2lineweight(this.linewidth),
        dashArray: this.dashArray,
        visible: this.visible,
        opacity: this.opacity,
        calcBoundingRect: this.calcBoundingRect,
        calcBoundingRectForce: this.calcBoundingRectForce
      },
      cadEntityDefaultValues
    );
  }

  addChild(...children: CadEntity[]) {
    children.forEach((e) => {
      if (e instanceof CadEntity) {
        e.parent = this;
        this.children.add(e);
      }
    });
    return this;
  }

  removeChild(...children: CadEntity[]) {
    children.forEach((e) => {
      if (e instanceof CadEntity) {
        e.parent = null;
        this.children.remove(e);
      }
    });
    return this;
  }

  remove() {
    this.el?.remove();
    this.el = null;
    this.parent?.removeChild(this);
    this.root?.remove(this);
    return this;
  }

  abstract clone(resetId?: boolean): CadEntity;
  protected _afterClone<T extends CadEntity>(e: T) {
    e.root = this.root;
    return e;
  }

  equals(entity: CadEntity) {
    const info1 = this.export();
    const info2 = entity.export();
    delete info1.id;
    delete info2.id;
    return JSON.stringify(info1) === JSON.stringify(info2);
  }

  // abstract getBoundingRect(): Rectangle;
}

export const cadEntityDefaultValues: Partial<CadEntity> = {
  visible: true,
  opacity: 1,
  calcBoundingRect: true,
  calcBoundingRectForce: false
};
