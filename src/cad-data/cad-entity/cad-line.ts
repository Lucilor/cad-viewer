import {DEFAULT_TOLERANCE, Line, MatrixLike, ObjectOf, Point, Rectangle} from "@lucilor/utils";
import {getVectorFromArray} from "../../cad-utils";
import {CadLayer} from "../cad-layer";
import {EntityType} from "../cad-types";
import {CadLineLike} from "./cad-line-like";

export class CadLine extends CadLineLike {
  type: EntityType = "LINE";
  start: Point;
  end: Point;
  kongwei: string;
  tiaojianquzhi: {
    key: string;
    level: number;
    type: "选择" | "数值" | "数值+选择";
    data: {
      name: string;
      value: number;
      input: boolean;
    }[];
  }[];
  shiyongchazhi: string;
  宽高虚线?: {source: string; position: "上" | "下" | "左" | "右"};

  get curve() {
    return new Line(this.start, this.end);
  }
  get length() {
    return this.curve.length;
  }
  get slope() {
    return this.curve.slope;
  }
  get theta() {
    return this.curve.theta;
  }
  get middle() {
    return this.curve.middle;
  }
  get _boundingRectCalc() {
    return Rectangle.fromPoints([this.start, this.end]);
  }

  constructor(data: any = {}, layers: CadLayer[] = [], resetId = false) {
    super(data, layers, resetId);
    this.start = getVectorFromArray(data.start);
    this.end = getVectorFromArray(data.end);
    this.kongwei = data.kongwei ?? "";
    this.tiaojianquzhi = data.tiaojianquzhi ?? [];
    this.tiaojianquzhi.forEach((v) => {
      if ((v.type as any) === "选项") {
        v.type = "选择";
      }
    });
    this.shiyongchazhi = data.shiyongchazhi ?? "";
    if (data.宽高虚线) {
      this.宽高虚线 = data.宽高虚线;
    }
  }

  protected _transform(matrix: MatrixLike) {
    this.start.transform(matrix);
    this.end.transform(matrix);
  }

  export() {
    const result: ObjectOf<any> = {
      ...super.export(),
      start: this.start.toArray(),
      end: this.end.toArray(),
      kongwei: this.kongwei,
      tiaojianquzhi: this.tiaojianquzhi,
      shiyongchazhi: this.shiyongchazhi
    };
    if (this.宽高虚线) {
      result.宽高虚线 = this.宽高虚线;
    }
    return result;
  }

  clone(resetId = false): CadLine {
    return this._afterClone(new CadLine(this.export(), [], resetId));
  }

  equals(entity: CadLine) {
    return this.curve.equals(entity.curve);
  }

  isVertical(accuracy = DEFAULT_TOLERANCE) {
    return Math.abs(this.start.x - this.end.x) <= accuracy;
  }

  isHorizontal(accuracy = DEFAULT_TOLERANCE) {
    return Math.abs(this.start.y - this.end.y) <= accuracy;
  }
}
