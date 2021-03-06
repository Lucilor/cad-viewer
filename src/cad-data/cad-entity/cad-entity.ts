import {G, Matrix as Matrix2, Svg} from "@svgdotjs/svg.js";
import {Angle, index2RGB, Matrix, MatrixLike, ObjectOf, Point, RGB2Index} from "@utils";
import Color from "color";
import {cloneDeep} from "lodash";
import {v4} from "uuid";
import {lineweight2linewidth, linewidth2lineweight} from "../../cad-utils";
import {CadEntities} from "../cad-entities";
import {CadLayer} from "../cad-layer";
import {CadType} from "../cad-types";

export abstract class CadEntity {
    id: string;
    abstract type: CadType;
    layer: string;
    color: Color;
    info: ObjectOf<any>;
    _indexColor: number | null;
    parent?: CadEntity;
    children: CadEntities;
    el?: G | null;
    updateInfo: {parent?: CadEntity; update: boolean} = {update: false};
    calcBoundingPoints = true;
    abstract get boundingPoints(): Point[];
    root?: CadEntities;
    linewidth: number;
    _lineweight: number;

    get scale() {
        if (this.el) {
            for (const parent of this.el.parents()) {
                if (parent instanceof Svg) {
                    return (parent as any).zoom();
                }
            }
        }
        return NaN;
    }

    protected _selectable?: boolean;
    get selectable() {
        if (this.el) {
            return this.el.hasClass("selectable");
        } else {
            return typeof this._selectable === "boolean" ? this._selectable : false;
        }
    }
    set selectable(value) {
        if (this.el) {
            if (value) {
                this.el.addClass("selectable");
            } else {
                this.el.removeClass("selectable");
            }
        } else {
            this._selectable = value;
        }
        this.children.forEach((c) => (c.selectable = value));
    }

    protected _selected?: boolean;
    get selected() {
        if (this.el) {
            return this.el.hasClass("selected") && this.selectable;
        } else {
            return typeof this._selected === "boolean" ? this._selected : false;
        }
    }
    set selected(value) {
        if (this.el) {
            if (value && this.selectable) {
                this.el.addClass("selected");
            } else {
                this.el.removeClass("selected");
            }
        } else {
            this._selected = value;
        }
        this.children.forEach((c) => (c.selected = value));
    }

    protected _opacity?: number;
    get opacity() {
        if (this.el) {
            return Number(this.el.css("opacity") ?? 1);
        } else {
            return typeof this._opacity === "number" ? this._opacity : 0;
        }
    }
    set opacity(value) {
        if (this.el) {
            this.el.css("opacity", value.toString());
        } else {
            this._opacity = value;
        }
        this.children.forEach((c) => (c.opacity = value));
    }

    private _visible?: boolean;
    get visible() {
        if (this.el) {
            return this.el.css("display") !== "none";
        } else {
            return typeof this._visible === "boolean" ? this._visible : true;
        }
    }
    set visible(value) {
        if (this.el) {
            this.el.css("display", value ? "" : "none");
        } else {
            this._visible = value;
        }
        this.children.forEach((c) => (c.visible = value));
    }

    constructor(data: any = {}, layers: CadLayer[] = [], resetId = false) {
        if (typeof data !== "object") {
            throw new Error("Invalid data.");
        }
        if (typeof data.id === "string" && !resetId) {
            this.id = data.id;
        } else {
            this.id = v4();
        }
        this.layer = data.layer ?? "0";
        this.color = new Color();
        if (typeof data.color === "number") {
            this._indexColor = data.color;
            if (data.color === 256) {
                const layer = layers.find((l) => l.name === this.layer);
                if (layer) {
                    this.color = new Color(layer.color);
                }
            } else {
                this.color = new Color(index2RGB(data.color, "num"));
            }
        } else {
            if (data.color instanceof Color) {
                this.color = new Color(data.color);
            }
            this._indexColor = RGB2Index(this.color.hex());
        }
        if (typeof data.info === "object" && !Array.isArray(data.info)) {
            this.info = cloneDeep(data.info);
        } else {
            this.info = {};
        }
        this.children = new CadEntities(data.children || {}, [], false);
        this.children.forEach((c) => (c.parent = this));
        this.selectable = data.selectable ?? true;
        this.selected = data.selected ?? false;
        if (data.parent instanceof CadEntity) {
            this.parent = data.parent;
        }
        this.visible = data.visible ?? true;
        this.opacity = data.opacity ?? 1;
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
    }

    protected _transform(matrix: MatrixLike, alter = false, parent: CadEntity | undefined) {
        if (!alter) {
            if (this.el) {
                const oldMatrix = new Matrix2(this.el.transform());
                this.el.transform(oldMatrix.transform(new Matrix(matrix)));
            }
            this.updateInfo = {update: true, parent};
        }
        this.children.forEach((e) => e.transform(matrix, alter, this));
        return this;
    }

    abstract transform(matrix: MatrixLike, alter?: boolean, parent?: CadEntity): this;

    update() {
        if (this.el) {
            if (typeof this._selectable === "boolean") {
                this.selectable = this._selectable;
                delete this._selectable;
            }
            if (typeof this._selected === "boolean") {
                this.selected = this._selected;
                delete this._selected;
            }
            if (typeof this._opacity === "number") {
                this.opacity = this._opacity;
                delete this._opacity;
            }
            if (typeof this._visible === "boolean") {
                this.visible = this._visible;
                delete this._visible;
            }
            if (this.updateInfo.update) {
                const newMatrix = new Matrix2(this.el.transform()).decompose();
                if (typeof newMatrix.rotate === "number") {
                    newMatrix.rotate = new Angle(newMatrix.rotate, "deg").rad;
                }
                this.transform(newMatrix, true);
                this.updateInfo = {update: false};
                this.el.transform({});
            }
        }
    }

    export(): ObjectOf<any> {
        this._indexColor = RGB2Index(this.color.hex());
        this.update();
        return cloneDeep({
            id: this.id,
            layer: this.layer,
            type: this.type,
            color: this._indexColor,
            children: this.children.export(),
            info: this.info,
            lineweight: linewidth2lineweight(this.linewidth)
        });
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
                this.children.remove(e);
            }
        });
        return this;
    }

    remove() {
        this.el?.remove();
        this.el = null;
        this.parent?.removeChild(this);
        return this;
    }

    abstract clone(resetId?: boolean): CadEntity;

    equals(entity: CadEntity) {
        const info1 = this.export();
        const info2 = entity.export();
        delete info1.id;
        delete info2.id;
        return JSON.stringify(info1) === JSON.stringify(info2);
    }

    // abstract getBoundingRect(): Rectangle;
}
