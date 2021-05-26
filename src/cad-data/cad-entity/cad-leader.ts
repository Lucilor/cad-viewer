import {MatrixLike, ObjectOf, Point} from "@utils";
import {cloneDeep} from "lodash";
import {getVectorFromArray} from "../../cad-utils";
import {CadLayer} from "../cad-layer";
import {CadType} from "../cad-types";
import {CadEntity} from "./cad-entity";

export class CadLeader extends CadEntity {
    type: CadType = "LEADER";
    vertices: Point[] = [];
    size: number;
    get boundingPoints() {
        return this.vertices.map((v) => v.clone());
    }

    constructor(data: any = {}, layers: CadLayer[] = [], resetId = false) {
        super(data, layers, resetId);
        if (Array.isArray(data.vertices)) {
            data.vertices.forEach((v: any) => this.vertices.push(getVectorFromArray(v)));
        }
        this.size = data.size ?? 5;
    }

    export(): ObjectOf<any> {
        return {
            ...super.export(),
            vertices: cloneDeep(this.vertices),
            size: this.size
        };
    }

    clone(resetId = false) {
        return new CadLeader(resetId);
    }

    transform(matrix: MatrixLike, alter = false) {
        this._transform(matrix, alter);
        if (alter) {
            this.vertices.forEach((v) => v.transform(matrix));
        }
        return this;
    }
}
