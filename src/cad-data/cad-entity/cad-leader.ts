import {MatrixLike, ObjectOf, Point, Rectangle} from "@utils";
import {getVectorsFromArray, purgeObject} from "../../cad-utils";
import {CadLayer} from "../cad-layer";
import {CadType} from "../cad-types";
import {CadEntity} from "./cad-entity";

export class CadLeader extends CadEntity {
    type: CadType = "LEADER";
    vertices: Point[] = [];
    size: number;
    get _boundingRectCalc() {
        return Rectangle.fromPoints(this.vertices);
    }

    constructor(data: any = {}, layers: CadLayer[] = [], resetId = false) {
        super(data, layers, resetId);
        this.vertices = getVectorsFromArray(data.vertices) ?? [];
        this.size = data.size ?? 5;
    }

    export(): ObjectOf<any> {
        return {
            ...super.export(),
            ...purgeObject({vertices: this.vertices.map((v) => v.toArray()), size: this.size})
        };
    }

    clone(resetId = false) {
        return new CadLeader(this, [], resetId);
    }

    transform(matrix: MatrixLike, alter = false, parent?: CadEntity) {
        this._transform(matrix, alter, parent);
        if (alter) {
            this.vertices.forEach((v) => v.transform(matrix));
        }
        return this;
    }
}
