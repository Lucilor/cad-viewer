import {Angle, Arc, Matrix, MatrixLike, ObjectOf, Point} from "@utils";
import {getVectorFromArray} from "../../cad-utils";
import {CadLayer} from "../cad-layer";
import {CadType} from "../cad-types";
import {CadLineLike} from "./cad-line-like";

export class CadArc extends CadLineLike {
    type: CadType = "ARC";
    center: Point;
    radius: number;
    start_angle: number;
    end_angle: number;
    clockwise: boolean;

    get start() {
        return this.curve.getPoint(0);
    }
    get end() {
        return this.curve.getPoint(1);
    }
    get middle() {
        return this.curve.getPoint(0.5);
    }
    get curve() {
        const {center, radius, start_angle, end_angle, clockwise} = this;
        return new Arc(center, radius, new Angle(start_angle, "deg"), new Angle(end_angle, "deg"), clockwise);
    }
    get length() {
        return this.curve.length;
    }
    get boundingPoints() {
        const curve = this.curve;
        const result: Point[] = [];
        if (curve.radius) {
            result.push(curve.getPoint(0), curve.getPoint(0.5), curve.getPoint(1));
        }
        return result;
    }

    constructor(data: any = {}, layers: CadLayer[] = [], resetId = false) {
        super(data, layers, resetId);
        this.center = getVectorFromArray(data.center);
        this.radius = data.radius ?? 0;
        this.start_angle = data.start_angle ?? 0;
        this.end_angle = data.end_angle ?? 0;
        this.clockwise = data.clockwise ?? false;
    }

    transform(matrix: MatrixLike, alter = false) {
        matrix = new Matrix(matrix);
        this._transform(matrix, alter);
        if (alter) {
            const curve = this.curve;
            curve.transform(matrix);
            this.center = curve.center;
            this.radius = curve.radius;
            this.start_angle = curve.startAngle.deg;
            this.end_angle = curve.endAngle.deg;
            const [scaleX, scaleY] = matrix.scale();
            if (scaleX && scaleY && scaleX * scaleY < 0) {
                this.clockwise = !this.clockwise;
            }
        }
        return this;
    }

    export(): ObjectOf<any> {
        return {
            ...super.export(),
            center: this.center.toArray(),
            radius: this.radius,
            start_angle: this.start_angle,
            end_angle: this.end_angle,
            clockwise: this.clockwise
        };
    }

    clone(resetId = false) {
        return new CadArc(this, [], resetId);
    }

    equals(entity: CadArc) {
        return this.curve.equals(entity.curve);
    }
}
