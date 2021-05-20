import {ObjectOf, Point} from "@utils";
import {cloneDeep} from "lodash";
import {getArray} from "../../cad-utils";
import {CadLayer} from "../cad-layer";
import {CadType} from "../cad-types";
import {CadEntity} from "./cad-entity";

export class CadLeader extends CadEntity {
    type: CadType = "LEADER";
    vertices: [[number, number], [number, number]];
    size: number;
    get boundingPoints() {
        return this.vertices.map((v) => new Point(v));
    }

    constructor(data: any = {}, layers: CadLayer[] = [], resetId = false) {
        super(data, layers, resetId);
        this.vertices = getArray(data.vertices) as CadLeader["vertices"];
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
}
