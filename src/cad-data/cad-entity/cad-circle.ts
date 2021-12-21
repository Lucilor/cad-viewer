import {Point, Arc, Angle, Matrix, ObjectOf, Rectangle} from "@utils";
import {getVectorFromArray, purgeObject} from "../../cad-utils";
import {CadLayer} from "../cad-layer";
import {CadType} from "../cad-types";
import {CadEntity} from "./cad-entity";

export class CadCircle extends CadEntity {
    type: CadType = "CIRCLE";
    center: Point;
    radius: number;

    get curve() {
        const {center, radius} = this;
        return new Arc(center, radius, new Angle(0, "deg"), new Angle(360, "deg"), true);
    }
    get length() {
        return this.curve.length;
    }
    get _boundingRectCalc() {
        const {center, radius} = this;
        return Rectangle.fromPoints([center.clone().sub(radius), center.clone().add(radius)]);
    }

    constructor(data: any = {}, layers: CadLayer[] = [], resetId = false) {
        super(data, layers, resetId);
        this.type = "CIRCLE";
        this.center = getVectorFromArray(data.center);
        this.radius = data.radius ?? 0;
    }

    protected _transform(matrix: Matrix, parent?: CadEntity) {
        this.center.transform(matrix);
    }

    export(): ObjectOf<any> {
        return {
            ...super.export(),
            ...purgeObject({center: this.center.toArray(), radius: this.radius})
        };
    }

    clone(resetId = false): CadCircle {
        return this._afterClone(new CadCircle(this.export(), [], resetId));
    }

    equals(entity: CadCircle) {
        return this.radius === entity.radius && this.center.equals(entity.center);
    }
}
