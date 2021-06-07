import {Matrix, ObjectOf, Point} from "@utils";
import {getVectorFromArray} from "../../cad-utils";
import {DEFAULT_LENGTH_TEXT_SIZE} from "../cad-entities";
import {CadLayer} from "../cad-layer";
import {CadType} from "../cad-types";
import {CadEntity} from "./cad-entity";

export class CadMtext extends CadEntity {
    type: CadType = "MTEXT";
    insert: Point;
    font_size: number;
    text: string;
    anchor: Point;
    fontFamily: string;
    fontWeight: string;

    get boundingPoints() {
        const rect = this.el?.node?.getBoundingClientRect();
        const {insert, anchor, scale} = this;
        if (rect && !isNaN(scale)) {
            const width = rect.width / scale;
            const height = rect.height / scale;
            const x = insert.x - anchor.x * width;
            const y = insert.y - (1 - anchor.y) * height;
            return [new Point(x, y), new Point(x + width, y + height)];
        }
        return [];
    }

    constructor(data: any = {}, layers: CadLayer[] = [], resetId = false) {
        super(data, layers, resetId);
        this.insert = getVectorFromArray(data.insert);
        this.text = data.text ?? "";
        this.anchor = getVectorFromArray(data.anchor);
        this.fontFamily = data.fontFamily ?? "";
        this.fontWeight = data.fontWeight ?? "normal";
        if (this.text.includes("     ")) {
            this.font_size = 36;
            this.insert.y += 11;
            this.insert.x -= 4;
            this.text = this.text.replace("     ", "");
            this.fontFamily = "仿宋";
        } else {
            this.font_size = data.font_size ?? DEFAULT_LENGTH_TEXT_SIZE;
        }
    }

    export(): ObjectOf<any> {
        const anchor = this.anchor.toArray();
        return {
            ...super.export(),
            insert: this.insert.toArray(),
            font_size: this.font_size,
            text: this.text,
            anchor,
            fontFamily: this.fontFamily
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
                    console.warn(this.info.offset, m.e, m.f);
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
