import {index2RGB, RGB2Index} from "@lucilor/utils";
import Color from "color";
import {v4} from "uuid";
import {lineweight2linewidth, linewidth2lineweight} from "../utils";

export class CadLayer {
    id: string;
    originalId: string;
    color: Color;
    name: string;
    linewidth: number;
    _indexColor: number | null;
    _lineweight: number;

    constructor(data: any = {}) {
        this.name = data.name || "";
        this.id = data.id ?? v4();
        this.originalId = data.originalId ?? this.id;
        this.color = new Color();
        if (typeof data.color === "number") {
            this._indexColor = data.color;
            this.color = new Color(index2RGB(data.color, "num"));
        } else {
            if (data.color instanceof Color) {
                this.color = data.color;
            }
            this._indexColor = RGB2Index(this.color.hex());
        }
        this.linewidth = typeof data.lineWidth === "number" ? data.lineWidth : 1;
        this._lineweight = -3;
        if (typeof data.lineweight === "number") {
            this._lineweight = data.lineweight;
            if (data.lineweight >= 0) {
                this.linewidth = lineweight2linewidth(data.lineweight);
            }
        }
    }

    export() {
        this._indexColor = RGB2Index(this.color.hex());
        return {
            id: this.id,
            color: this._indexColor,
            name: this.name,
            originalId: this.originalId,
            lineweight: linewidth2lineweight(this.linewidth)
        };
    }
}
