import {ObjectOf, Rectangle} from "@lucilor/utils";
import {cloneDeep} from "lodash";
import {CadStylizer} from "../../cad-stylizer";
import {purgeObject} from "../../cad-utils";
import {CadLayer} from "../cad-layer";
import {CadDimensionStyle} from "../cad-styles";
import {EntityType} from "../cad-types";
import {CadEntity} from "./cad-entity";

export interface CadDimensionEntity {
  id: string;
  location: "start" | "end" | "center" | "min" | "max" | "minX" | "maxX" | "minY" | "maxY";
  defPoint?: number[];
}

export abstract class CadDimension extends CadEntity {
  type: EntityType = "DIMENSION";
  dimstyle: string;
  style: CadDimensionStyle = {};
  mingzi: string;
  qujian: string;
  ref?: "entity1" | "entity2" | "minX" | "maxX" | "minY" | "maxY" | "minLength" | "maxLength";
  quzhifanwei: string;
  xianshigongshiwenben: string;
  xiaoshuchuli: "四舍五入" | "舍去小数" | "小数进一" | "保留一位" | "保留两位";

  get hideDimLines() {
    return !!this.style?.extensionLines?.hidden;
  }
  set hideDimLines(value) {
    if (!this.style) {
      this.style = {};
    }
    if (value) {
      if (!this.style.extensionLines) {
        this.style.extensionLines = {};
      }
      this.style.extensionLines.hidden = true;
      if (!this.style.dimensionLine) {
        this.style.dimensionLine = {};
      }
      this.style.dimensionLine.hidden = true;
      if (!this.style.arrows) {
        this.style.arrows = {};
      }
      this.style.arrows.hidden = true;
    } else {
      if (this.style.extensionLines?.hidden) {
        delete this.style.extensionLines.hidden;
      }
      if (this.style.dimensionLine?.hidden) {
        delete this.style.dimensionLine.hidden;
      }
      if (this.style.arrows?.hidden) {
        delete this.style.arrows.hidden;
      }
    }
  }

  get _boundingRectCalc() {
    if (this.root) {
      const points = this.root.getDimensionPoints(this);
      if (points.length === 4) {
        return Rectangle.fromPoints(points);
      }
    }
    return Rectangle.min;
  }

  constructor(data: any = {}, layers: CadLayer[] = [], resetId = false) {
    super(data, layers, resetId);
    this.dimstyle = data.dimstyle || "";
    this.setStyle(data.style || {});
    if (data.font_size) {
      this.setStyle({text: {size: data.font_size}});
    }
    this.mingzi = data.mingzi ?? "";
    this.qujian = data.qujian ?? "";
    this.ref = data.ref ?? "entity1";
    this.quzhifanwei = data.quzhifanwei ?? "";
    this.hideDimLines = data.hideDimLines === true;
    this.xianshigongshiwenben = data.xianshigongshiwenben ?? "";
    this.xiaoshuchuli = data.xiaoshuchuli ?? "四舍五入";
  }

  export(): ObjectOf<any> {
    const result = {
      ...super.export(),
      ...purgeObject({
        dimstyle: this.dimstyle,
        style: cloneDeep(this.style),
        mingzi: this.mingzi,
        qujian: this.qujian,
        ref: this.ref,
        quzhifanwei: this.quzhifanwei,
        hideDimLines: this.hideDimLines,
        xianshigongshiwenben: this.xianshigongshiwenben,
        xiaoshuchuli: this.xiaoshuchuli
      })
    };
    return result;
  }

  setStyle(style: CadDimensionStyle): this {
    if (!this.style) {
      this.style = {};
    }
    CadStylizer.mergeDimStyle(this.style, style);
    return this;
  }
}
