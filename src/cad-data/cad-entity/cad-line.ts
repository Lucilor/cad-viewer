import {Line, MatrixLike, ObjectOf, Point} from "@utils";
import {getVectorFromArray} from "../../cad-utils";
import {CadLayer} from "../cad-layer";
import {CadType} from "../cad-types";
import {CadEntity} from "./cad-entity";
import {CadLineLike} from "./cad-line-like";

export class CadLine extends CadLineLike {
    type: CadType = "LINE";
    start: Point;
    end: Point;
    guanlianbianhuagongshi: string;
    kongwei: string;
    tiaojianquzhi: {
        key: string;
        level: number;
        type: "选择" | "数值";
        data: {
            name: string;
            value: number;
            input: boolean;
        }[];
    }[];
    shiyongchazhi: string;
    宽高虚线?: {source: string; position: "上" | "下" | "左" | "右"};

    get curve() {
        return new Line(this.start, this.end);
    }
    get length() {
        return this.curve.length;
    }
    get slope() {
        return this.curve.slope;
    }
    get theta() {
        return this.curve.theta;
    }
    get middle() {
        return this.curve.middle;
    }
    get boundingPoints() {
        return [this.start, this.end];
    }

    constructor(data: any = {}, layers: CadLayer[] = [], resetId = false) {
        super(data, layers, resetId);
        this.start = getVectorFromArray(data.start);
        this.end = getVectorFromArray(data.end);
        this.guanlianbianhuagongshi = data.guanlianbianhuagongshi ?? "";
        this.kongwei = data.kongwei ?? "";
        this.tiaojianquzhi = data.tiaojianquzhi ?? [];
        this.tiaojianquzhi.forEach((v) => {
            if ((v.type as any) === "选项") {
                v.type = "选择";
            }
        });
        this.shiyongchazhi = data.shiyongchazhi ?? "";
        if (data.宽高虚线) {
            this.宽高虚线 = data.宽高虚线;
        }
    }

    transform(matrix: MatrixLike, alter = false, parent?: CadEntity) {
        this._transform(matrix, alter, parent);
        if (alter) {
            this.start.transform(matrix);
            this.end.transform(matrix);
        }
        return this;
    }

    export() {
        const result: ObjectOf<any> = {
            ...super.export(),
            start: this.start.toArray(),
            end: this.end.toArray(),
            guanlianbianhuagongshi: this.guanlianbianhuagongshi,
            kongwei: this.kongwei,
            tiaojianquzhi: this.tiaojianquzhi,
            shiyongchazhi: this.shiyongchazhi
        };
        if (this.宽高虚线) {
            result.宽高虚线 = this.宽高虚线;
        }
        return result;
    }

    clone(resetId = false) {
        return new CadLine(this, [], resetId);
    }

    equals(entity: CadLine) {
        return this.curve.equals(entity.curve);
    }

    isVertical(accuracy = 0) {
        return Math.abs(this.start.x - this.end.x) <= accuracy;
    }

    isHorizontal(accuracy = 0) {
        return Math.abs(this.start.y - this.end.y) <= accuracy;
    }
}
