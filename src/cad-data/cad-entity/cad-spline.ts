import {MatrixLike, ObjectOf, Point, Rectangle} from "@lucilor/utils";
import {getVectorsFromArray, purgeObject} from "../../cad-utils";
import {CadLayer} from "../cad-layer";
import {EntityType} from "../cad-types";
import {CadEntity} from "./cad-entity";

export class CadSpline extends CadEntity {
  type: EntityType = "SPLINE";
  fitPoints: Point[] = [];
  controlPoints: Point[] = [];
  degree = 3;
  calcBoundingRect = false;
  get _boundingRectCalc() {
    return Rectangle.min;
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

  clone(resetId = false): CadSpline {
    return this._afterClone(new CadSpline(this.export(), [], resetId));
  }

  protected _transform(matrix: MatrixLike) {
    this.fitPoints.forEach((p) => p.transform(matrix));
    this.controlPoints.forEach((p) => p.transform(matrix));
  }
}
