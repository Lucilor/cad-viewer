import {Angle, Arc, Matrix, ObjectOf, Point, Rectangle} from "@lucilor/utils";
import {getVectorFromArray, purgeObject} from "../../cad-utils";
import {CadLayer} from "../cad-layer";
import {EntityType} from "../cad-types";
import {CadLineLike} from "./cad-line-like";

export class CadCircle extends CadLineLike {
  type: EntityType = "CIRCLE";
  center: Point;
  radius: number;

  get start() {
    return this.curve.getPoint(0);
  }
  get end() {
    return this.curve.getPoint(1);
  }
  get middle() {
    return this.curve.getPoint(0.5);
  }
  get curve() {
    const {center, radius} = this;
    return new Arc(center, radius, new Angle(0, "deg"), new Angle(360, "deg"), true);
  }
  get length() {
    return this.curve.length;
  }
  get _boundingRectCalc() {
    const {center, radius} = this;
    return Rectangle.fromPoints([center.clone().sub(radius), center.clone().add(radius)]);
  }

  constructor(data: any = {}, layers: CadLayer[] = [], resetId = false) {
    super(data, layers, resetId);
    this.type = "CIRCLE";
    this.center = getVectorFromArray(data.center);
    this.radius = data.radius ?? 0;
  }

  protected _transform(matrix: Matrix) {
    this.center.transform(matrix);
  }

  export(): ObjectOf<any> {
    return {
      ...super.export(),
      ...purgeObject({center: this.center.toArray(), radius: this.radius})
    };
  }

  clone(resetId = false): CadCircle {
    return this._afterClone(new CadCircle(this.export(), [], resetId));
  }

  equals(entity: CadCircle) {
    return this.radius === entity.radius && this.center.equals(entity.center);
  }
}
