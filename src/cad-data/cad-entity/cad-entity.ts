import {G, Matrix as Matrix2, Svg} from "@svgdotjs/svg.js";
import {ObjectOf, Point, index2RGB, RGB2Index, MatrixLike, Matrix, Angle} from "@utils";
import Color from "color";
import {cloneDeep} from "lodash";
import {v4} from "uuid";
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
    needsUpdate = false;
    calcBoundingPoints = true;
    abstract get boundingPoints(): Point[];
    root?: CadEntities;

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
                this.el.children().forEach((c, i) => {
                    if (c.hasClass("stroke")) {
                        c.css("stroke-dasharray", "20, 7");
                    }
                    if (c.hasClass("fill")) {
                        c.css("fill", "#ffca1c");
                    }
                });
            } else {
                this.el.removeClass("selected").css("stroke-dasharray", "");
                this.el.children().forEach((c) => {
                    c.css("stroke-dasharray", "");
                    c.css("fill", "");
                });
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
            this.el.css("opacity", value);
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
    }

    protected _transform(matrix: MatrixLike, alter = false, _parent?: CadEntity) {
        this.el?.attr("stroke", "red");
        if (!alter) {
            if (this.el) {
                const oldMatrix = new Matrix2(this.el.transform());
                this.el.transform(oldMatrix.transform(new Matrix(matrix)));
            }
            this.needsUpdate = true;
        }
        this.children.forEach((e) => e._transform(matrix, alter, this));
        return this;
    }

    abstract transform(matrix: MatrixLike, alter?: boolean): this;

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
            if (this.needsUpdate) {
                const newMatrix = new Matrix2(this.el.transform()).decompose();
                if (typeof newMatrix.rotate === "number") {
                    newMatrix.rotate = new Angle(newMatrix.rotate, "deg").rad;
                }
                this.transform(newMatrix, true);
                this.needsUpdate = false;
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
            info: this.info
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
