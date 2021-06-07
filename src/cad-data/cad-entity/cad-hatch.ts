import {Point, ObjectOf, Matrix} from "@utils";
import {getVectorFromArray} from "../../cad-utils";
import {CadLayer} from "../cad-layer";
import {CadType} from "../cad-types";
import {CadEntity} from "./cad-entity";

export class CadHatch extends CadEntity {
    type: CadType = "HATCH";
    bgcolor: number[];
    paths: {
        edges: {
            start: Point;
            end: Point;
        }[];
        vertices: Point[];
    }[];

    get boundingPoints() {
        return [] as Point[];
    }

    constructor(data: ObjectOf<any> = {}, layers: CadLayer[] = [], resetId = false) {
        super(data, layers, resetId);
        this.bgcolor = Array.isArray(data.bgcolor) ? data.bgcolor : [0, 0, 0];
        this.paths = [];
        if (Array.isArray(data.paths)) {
            data.paths.forEach((path) => {
                const edges: CadHatch["paths"][0]["edges"] = [];
                const vertices: CadHatch["paths"][0]["vertices"] = [];
                if (Array.isArray(path.edges)) {
                    path.edges.forEach((edge: any) => {
                        const start = getVectorFromArray(edge.start);
                        const end = getVectorFromArray(edge.end);
                        edges.push({start, end});
                    });
                }
                if (Array.isArray(path.vertices)) {
                    path.vertices.forEach((vertice: any) => {
                        vertices.push(getVectorFromArray(vertice));
                    });
                }
                this.paths.push({edges, vertices});
            });
        }
    }

    export(): ObjectOf<any> {
        const paths: any[] = [];
        this.paths.forEach((path) => {
            const edges: any[] = [];
            const vertices: any[] = [];
            path.edges.forEach((edge) => edges.push({start: edge.start.toArray(), end: edge.end.toArray()}));
            path.vertices.forEach((vertice) => vertices.push(vertice.toArray()));
            paths.push({edges, vertices});
        });
        return {...super.export(), paths};
    }

    transform(matrix: Matrix, alter = false, parent?: CadEntity) {
        this._transform(matrix, alter, parent);
        if (alter) {
            this.paths.forEach((path) => {
                path.edges.forEach((edge) => {
                    edge.start.transform(matrix);
                    edge.end.transform(matrix);
                });
                path.vertices.forEach((vertice) => vertice.transform(matrix));
            });
        }
        return this;
    }

    clone(resetId = false) {
        return new CadHatch(this, [], resetId);
    }
}
