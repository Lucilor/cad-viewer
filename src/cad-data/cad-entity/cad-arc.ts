import {Angle, Arc, Matrix, MatrixLike, ObjectOf, Point, Rectangle} from "@lucilor/utils";
import {getVectorFromArray, purgeObject} from "../../cad-utils";
import {CadLayer} from "../cad-layer";
import {EntityType} from "../cad-types";
import {CadLineLike} from "./cad-line-like";

export class CadArc extends CadLineLike {
  type: EntityType = "ARC";
  center: Point;
  radius: number;
  start_angle: number;
  end_angle: number;
  clockwise: boolean;

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
    const {center, radius, start_angle, end_angle, clockwise} = this;
    return new Arc(center, radius, new Angle(start_angle, "deg"), new Angle(end_angle, "deg"), clockwise);
  }
  get length() {
    return this.curve.length;
  }
  get _boundingRectCalc() {
    const curve = this.curve;
    if (curve.radius) {
      return Rectangle.fromPoints([curve.getPoint(0), curve.getPoint(0.5), curve.getPoint(1)]);
    }
    return Rectangle.min;
  }

  constructor(data: any = {}, layers: CadLayer[] = [], resetId = false) {
    super(data, layers, resetId);
    this.center = getVectorFromArray(data.center);
    this.radius = data.radius ?? 0;
    this.start_angle = data.start_angle ?? 0;
    this.end_angle = data.end_angle ?? 0;
    this.clockwise = data.clockwise ?? false;
  }

  protected _transform(matrix: MatrixLike) {
    matrix = new Matrix(matrix);
    const curve = this.curve;
    curve.transform(matrix);
    this.center = curve.center;
    this.radius = curve.radius;
    this.start_angle = curve.startAngle.deg;
    this.end_angle = curve.endAngle.deg;
    this.clockwise = curve.clockwise;
  }

  export(): ObjectOf<any> {
    return {
      ...super.export(),
      ...purgeObject({
        center: this.center.toArray(),
        radius: this.radius,
        start_angle: this.start_angle,
        end_angle: this.end_angle,
        clockwise: this.clockwise
      })
    };
  }

  clone(resetId = false): CadArc {
    return this._afterClone(new CadArc(this.export(), [], resetId));
  }

  equals(entity: CadArc) {
    return this.curve.equals(entity.curve);
  }
}
