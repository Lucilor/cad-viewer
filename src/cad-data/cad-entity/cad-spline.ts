import {MatrixLike, ObjectOf, Point} from "@utils";
import {getVectorFromArray} from "../../cad-utils";
import {CadLayer} from "../cad-layer";
import {CadType} from "../cad-types";
import {CadEntity} from "./cad-entity";

export class CadSpline extends CadEntity {
    type: CadType = "SPLINE";
    fitPoints: Point[] = [];
    controlPoints: Point[] = [];
    degree = 3;
    get boundingPoints() {
        return [] as Point[];
    }

    constructor(data: any = {}, layers: CadLayer[] = [], resetId = false) {
        super(data, layers, resetId);
        if (Array.isArray(data.fitPoints)) {
            data.fitPoints.forEach((v: any) => this.fitPoints.push(getVectorFromArray(v)));
        }
        if (Array.isArray(data.controlPoints)) {
            data.controlPoints.forEach((v: any) => this.controlPoints.push(getVectorFromArray(v)));
        }
        if (typeof data.degree === "number") {
            this.degree = data.degree;
        }
    }

    export(): ObjectOf<any> {
        return {
            ...super.export(),
            fitPoints: this.fitPoints.map((v) => v.toArray()),
            controlPoints: this.controlPoints.map((v) => v.toArray()),
            degree: this.degree
        };
    }

    clone(resetId = false) {
        return new CadSpline(this, [], resetId);
    }

    transform(matrix: MatrixLike, alter = false, parent?: CadEntity) {
        this._transform(matrix, alter, parent);
        if (alter) {
            this.fitPoints.forEach((p) => p.transform(matrix));
            this.controlPoints.forEach((p) => p.transform(matrix));
        }
        return this;
    }
}
