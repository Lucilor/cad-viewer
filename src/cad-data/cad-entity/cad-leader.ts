import {Point} from "@utils";
import {CadEntity} from "./cad-entity";

export class CadLeader extends CadEntity {
    vertices: number[][] = [];
    get boundingPoints() {
        return this.vertices.map((v) => new Point(v));
    }

    clone(resetId = false) {
        return new CadLeader(resetId);
    }
}
