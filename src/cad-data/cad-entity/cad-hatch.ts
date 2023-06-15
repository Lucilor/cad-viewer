import {Matrix, ObjectOf, Point, Rectangle} from "@lucilor/utils";
import {getVectorFromArray, purgeObject} from "../../cad-utils";
import {CadLayer} from "../cad-layer";
import {EntityType} from "../cad-types";
import {CadEntity} from "./cad-entity";

export class CadHatch extends CadEntity {
  type: EntityType = "HATCH";
  bgcolor: number[];
  paths: {
    edges: {
      start: Point;
      end: Point;
    }[];
    vertices: Point[];
  }[];

  calcBoundingRect = false;
  get _boundingRectCalc() {
    const rect = Rectangle.min;
    this.paths.forEach(({edges, vertices}) => {
      edges.forEach(({start, end}) => {
        rect.expandByPoint(start);
        rect.expandByPoint(end);
      });
      vertices.forEach((vertice) => rect.expandByPoint(vertice));
    });
    return rect;
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
    return {...super.export(), ...purgeObject({paths})};
  }

  protected _transform(matrix: Matrix) {
    this.paths.forEach((path) => {
      path.edges.forEach((edge) => {
        edge.start.transform(matrix);
        edge.end.transform(matrix);
      });
      path.vertices.forEach((vertice) => vertice.transform(matrix));
    });
  }

  clone(resetId = false): CadHatch {
    return this._afterClone(new CadHatch(this.export(), [], resetId));
  }
}
