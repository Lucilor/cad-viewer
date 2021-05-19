import {Line, MatrixLike, ObjectOf, Point} from "@utils";
import {getVectorFromArray} from "../../cad-utils";
import {CadLayer} from "../cad-layer";
import {CadEntity} from "./cad-entity";
import {CadLineLike} from "./cad-line-like";

export class CadLine extends CadLineLike {
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
    get maxX() {
        return Math.max(this.start.x, this.end.x);
    }
    get maxY() {
        return Math.max(this.start.y, this.end.y);
    }
    get minX() {
        return Math.min(this.start.x, this.end.x);
    }
    get minY() {
        return Math.min(this.start.y, this.end.y);
    }
    get boundingPoints() {
        return [this.start, this.end];
    }

    constructor(data: any = {}, layers: CadLayer[] = [], resetId = false) {
        super(data, layers, resetId);
        this.type = "LINE";
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
    }

    transform(matrix: MatrixLike, alter = false, parent?: CadEntity) {
        super.transform(matrix, alter, parent);
        if (alter) {
            this.start.transform(matrix);
            this.end.transform(matrix);
        }
        return this;
    }

    export(): ObjectOf<any> {
        return {
            ...super.export(),
            start: this.start.toArray(),
            end: this.end.toArray(),
            guanlianbianhuagongshi: this.guanlianbianhuagongshi,
            kongwei: this.kongwei,
            tiaojianquzhi: this.tiaojianquzhi,
            shiyongchazhi: this.shiyongchazhi
        };
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
