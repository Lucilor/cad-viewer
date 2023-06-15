import {keysOf} from "@lucilor/utils";
import {cloneDeep} from "lodash";
import {CadDimension, CadEntity, CadHatch, CadLine, CadLineLike, CadMtext} from "./cad-data/cad-entity";
import {CadDimensionStyle, CadStyle, FontStyle} from "./cad-data/cad-styles";
import {Defaults} from "./cad-utils";
import {CadViewerConfig} from "./cad-viewer";
import {ColoredObject} from "./colored-object";

export class CadStylizer {
  static get(entity: CadEntity, config: CadViewerConfig, params: CadStyle = {}) {
    const {dashedLinePadding, minLinewidth, reverseSimilarColor, validateLines} = config;
    const defaultStyle: Required<CadStyle> = {
      color: "white",
      fontStyle: {size: Defaults.FONT_SIZE, family: "", weight: "", ...config.fontStyle, ...params.fontStyle},
      lineStyle: {padding: dashedLinePadding, dashArray: entity.dashArray},
      opacity: 1,
      dimStyle: {text: {size: 16}}
    };
    const result: Required<CadStyle> = {...defaultStyle, ...params};
    this.mergeDimStyle(result.dimStyle, defaultStyle.dimStyle);
    this.mergeDimStyle(result.dimStyle, config.dimStyle);
    this.mergeDimStyle(result.dimStyle, params.dimStyle || {});
    let linewidth: number;
    let color = new ColoredObject(params.color || entity?.getColor() || 0);
    if (params.lineStyle) {
      result.lineStyle = params.lineStyle;
      linewidth = params.lineStyle.width || 1;
    } else if (entity.linewidth > 0) {
      linewidth = entity.linewidth;
    } else {
      linewidth = 1;
    }
    if (entity instanceof CadLineLike && entity.开料不要) {
      color.setColor(0xff4081);
    }
    result.opacity = entity.opacity;
    if (typeof params.opacity === "number") {
      result.opacity = params.opacity;
    }

    if (validateLines && entity instanceof CadLine) {
      if (entity.info.errors?.length) {
        linewidth *= 10;
        color.setColor(0xff0000);
      }
    }
    if (reverseSimilarColor) {
      color = this.correctColor(color, config);
    }
    result.color = color.getColor().hex();
    if (!(entity instanceof CadHatch)) {
      // ? make lines easier to select
      linewidth = Math.max(minLinewidth, linewidth);
    }

    if (entity instanceof CadMtext) {
      this.mergeFontStyle(result.fontStyle, entity.fontStyle);
      if (!result.fontStyle.color) {
        result.fontStyle.color = result.color;
      }
    }

    if (entity instanceof CadDimension) {
      this.mergeDimStyle(result.dimStyle, entity.style);
      // this.mergeFontStyle(result.dimStyle.text, result.fontStyle, false);
      result.dimStyle.color = result.color;
    }

    result.lineStyle.width = linewidth;
    result.lineStyle.color = result.color;
    return result;
  }

  static correctColor(color: ColoredObject, config: CadViewerConfig, threshold = 5) {
    const {reverseSimilarColor, backgroundColor} = config;
    const c1 = color.getColor();
    if (reverseSimilarColor) {
      const c2 = new ColoredObject(backgroundColor).getColor();
      if (Math.abs(c1.rgbNumber() - c2.rgbNumber()) <= threshold) {
        return new ColoredObject(c1.negate());
      }
    }
    return color;
  }

  static getColorStyle(color: ColoredObject, a = 1) {
    const c = color.getColor();
    const arr = [c.red(), c.green(), c.blue()].map((v) => v * 255);
    if (a > 0 && a < 1) {
      return `rgba(${[...arr, a].join(",")})`;
    } else {
      return `rgb(${arr.join(",")})`;
    }
  }

  static getFontSize(value: any) {
    const size = Number(value);
    if (isNaN(size) || size <= 0) {
      return null;
    }
    return size;
  }

  static getFontFamilies(str: string) {
    return str
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
  }

  static mergeFontFamilies(val1: string | string[], val2: string | string[]) {
    if (typeof val1 === "string") {
      val1 = this.getFontFamilies(val1);
    }
    if (typeof val2 === "string") {
      val2 = this.getFontFamilies(val2);
    }
    return Array.from(new Set([...val1, ...val2]));
  }

  static mergeFontStyle(style1: FontStyle, style2: FontStyle) {
    for (const key2 in style2) {
      const key = key2 as keyof FontStyle;
      if (key === "family" && style2.family) {
        style1.family = this.mergeFontFamilies(style1.family || "", style2.family).join(", ");
      } else if (key === "size") {
        const size = this.getFontSize(style2.size);
        if (size) {
          style1.size = size;
        }
      } else {
        style1[key] = style2[key] as any;
      }
    }
  }

  static mergeDimStyle(style1: CadDimensionStyle, style2: CadDimensionStyle) {
    keysOf(style2).forEach((key) => {
      if (key === "color") {
        style1[key] = style2[key];
      } else {
        style1[key] = {...style1[key], ...cloneDeep(style2[key])};
      }
    });
  }
}
