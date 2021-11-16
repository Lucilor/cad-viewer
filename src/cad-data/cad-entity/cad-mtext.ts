import {Matrix, ObjectOf, Point} from "@utils";
import {getVectorFromArray, purgeObject} from "../../cad-utils";
import {DEFAULT_LENGTH_TEXT_SIZE} from "../cad-entities";
import {CadLayer} from "../cad-layer";
import {CadType} from "../cad-types";
import {CadEntity} from "./cad-entity";

export interface CadMtextInfo {
    [key: string]: any;
    isLengthText?: boolean;
    isGongshiText?: boolean;
    offset?: number[];
}

export class CadMtext extends CadEntity {
    type: CadType = "MTEXT";
    insert: Point;
    font_size: number;
    text: string;
    anchor: Point;
    fontFamily: string;
    fontWeight: string;
    info!: CadMtextInfo;

    // get boundingRect() {
    //     if (this.el) {
    //         const {insert, anchor, scale} = this;
    //         return geteTextElRect(this.el, insert, anchor, scale);
    //     }
    //     return Rectangle.min;
    // }

    constructor(data: any = {}, layers: CadLayer[] = [], resetId = false) {
        super(data, layers, resetId);
        this.insert = getVectorFromArray(data.insert);
        this.text = data.text ?? "";
        this.anchor = getVectorFromArray(data.anchor);
        this.fontFamily = data.fontFamily ?? "";
        this.fontWeight = data.fontWeight ?? "normal";
        this.font_size = data.font_size ?? DEFAULT_LENGTH_TEXT_SIZE;
    }

    export(): ObjectOf<any> {
        const anchor = this.anchor.toArray();
        return {
            ...super.export(),
            ...purgeObject({insert: this.insert.toArray(), font_size: this.font_size, text: this.text, anchor, fontFamily: this.fontFamily})
        };
    }

    transform(matrix: Matrix, alter = false, parent?: CadEntity) {
        this._transform(matrix, alter, parent);
        if (alter) {
            this.insert.transform(matrix);
            const m = new Matrix(matrix);
            if (this.info.isLengthText || this.info.isGongshiText) {
                if (!Array.isArray(this.info.offset)) {
                    this.info.offset = [0, 0];
                }
                if (!parent) {
                    this.info.offset[0] += m.e;
                    this.info.offset[1] += m.f;
                }
            }
        }
        return this;
    }

    clone(resetId = false) {
        return new CadMtext(this, [], resetId);
    }

    equals(entity: CadMtext) {
        return (
            this.insert.equals(entity.insert) &&
            this.font_size === entity.font_size &&
            this.text === entity.text &&
            this.anchor.equals(entity.anchor)
        );
    }
}
