import {Matrix, ObjectOf} from "@utils";
import {cloneDeep} from "lodash";
import {CadLayer} from "../cad-layer";
import {CadType} from "../cad-types";
import {CadEntity} from "./cad-entity";

export interface CadDimensionEntity {
    id: string;
    location: "start" | "end" | "center" | "min" | "max" | "minX" | "maxX" | "minY" | "maxY";
    defPoint?: number[];
}

export class CadDimension extends CadEntity {
    type: CadType = "DIMENSION";
    font_size: number;
    dimstyle: string;
    axis: "x" | "y";
    entity1: CadDimensionEntity;
    entity2: CadDimensionEntity;
    distance: number;
    distance2?: number;
    cad1: string;
    cad2: string;
    mingzi: string;
    qujian: string;
    ref?: "entity1" | "entity2" | "minX" | "maxX" | "minY" | "maxY" | "minLength" | "maxLength";
    quzhifanwei: string;
    xianshigongshiwenben: string;

    private _renderStyle = 1;
    get renderStyle() {
        return this._renderStyle;
    }
    set renderStyle(value) {
        if (this._renderStyle !== value) {
            this.el?.remove();
            this.el = null;
        }
        this._renderStyle = value;
    }

    private _hideDimLines = false;
    get hideDimLines() {
        return this._hideDimLines;
    }
    set hideDimLines(value) {
        if (this._hideDimLines !== value) {
            this.el?.remove();
            this.el = null;
        }
        this._hideDimLines = value;
    }

    get boundingPoints() {
        if (this.root) {
            return this.root.getDimensionPoints(this);
        }
        return [];
    }

    constructor(data: any = {}, layers: CadLayer[] = [], resetId = false) {
        super(data, layers, resetId);
        this.font_size = data.font_size || 16;
        if (this.font_size === 2.5) {
            this.font_size = 36;
        }
        this.dimstyle = data.dimstyle || "";
        this.entity1 = {id: "", location: "center"};
        this.entity2 = {id: "", location: "center"};
        (["entity1", "entity2"] as ("entity1" | "entity2")[]).forEach((field) => {
            if (data[field]) {
                if (typeof data[field].id === "string") {
                    this[field].id = data[field].id;
                }
                this[field].location = data[field].location ?? "center";
            }
        });
        this.axis = data.axis ?? "x";
        this.distance = data.distance ?? 20;
        this.cad1 = data.cad1 ?? "";
        this.cad2 = data.cad2 ?? "";
        this.mingzi = data.mingzi ?? "";
        this.qujian = data.qujian ?? "";
        this.ref = data.ref ?? "entity1";
        this.quzhifanwei = data.quzhifanwei ?? "";
        this.renderStyle = data.renderStyle ?? 1;
        this.hideDimLines = data.hideDimLines === true;
        this.xianshigongshiwenben = data.xianshigongshiwenben ?? "";
    }

    transform(matrix: Matrix, alter = false, parent?: CadEntity) {
        this._transform(matrix, alter, parent);
        return this;
    }

    export(): ObjectOf<any> {
        return cloneDeep({
            ...super.export(),
            dimstyle: this.dimstyle,
            font_size: this.font_size,
            axis: this.axis,
            entity1: this.entity1,
            entity2: this.entity2,
            distance: this.distance,
            cad1: this.cad1,
            cad2: this.cad2,
            mingzi: this.mingzi,
            qujian: this.qujian,
            ref: this.ref,
            quzhifanwei: this.quzhifanwei,
            renderStyle: this.renderStyle,
            hideDimLines: this.hideDimLines,
            xianshigongshiwenben: this.xianshigongshiwenben
        });
    }

    clone(resetId = false) {
        return new CadDimension(this, [], resetId);
    }

    get selected() {
        if (this.el) {
            return this.el.hasClass("selected") && this.selectable;
        } else {
            return typeof this._selected === "boolean" ? this._selected : false;
        }
    }
    set selected(value: boolean) {
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
}
