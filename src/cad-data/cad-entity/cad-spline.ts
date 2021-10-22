import {MatrixLike, ObjectOf, Point} from "@utils";
import {getVectorsFromArray, purgeObject} from "../../cad-utils";
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
        this.fitPoints = getVectorsFromArray(data.fitPoints) ?? [];
        this.controlPoints = getVectorsFromArray(data.controlPoints) ?? [];
        if (typeof data.degree === "number") {
            this.degree = data.degree;
        }
    }

    export(): ObjectOf<any> {
        return {
            ...super.export(),
            ...purgeObject({
                fitPoints: this.fitPoints.map((v) => v.toArray()),
                controlPoints: this.controlPoints.map((v) => v.toArray()),
                degree: this.degree
            })
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
