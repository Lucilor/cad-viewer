import {Matrix, MatrixLike, ObjectOf, Point, Rectangle} from "@lucilor/utils";
import {getVectorsFromArray, purgeObject} from "../../cad-utils";
import {CadLayer} from "../cad-layer";
import {EntityType} from "../cad-types";
import {CadEntity} from "./cad-entity";

export class CadLeader extends CadEntity {
  type: EntityType = "LEADER";
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

  clone(resetId = false): CadLeader {
    return this._afterClone(new CadLeader(this.export(), [], resetId));
  }

  protected _transform(matrix: MatrixLike) {
    this.vertices.forEach((v) => v.transform(matrix));
    const m = new Matrix(matrix);
    const [scaleX, scaleY] = m.scale();
    this.size *= Math.abs(Math.sqrt(scaleX * scaleY));
  }
}
