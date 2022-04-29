import {CadDimension, CadEntity, CadHatch, CadLine, CadLineLike, CadMtext} from "./cad-data/cad-entity";
import {CadStyle} from "./cad-data/cad-styles";
import {CadViewerConfig} from "./cad-viewer";
import {ColoredObject} from "./colored-object";

export class CadStylizer {
    get(entity: CadEntity, config: CadViewerConfig, params: CadStyle = {}) {
        const {dashedLinePadding, minLinewidth, reverseSimilarColor, validateLines} = config;
        const defaultStyle: Required<CadStyle> = {
            color: "white",
            fontStyle: {size: 16, family: "", weight: ""},
            lineStyle: {padding: dashedLinePadding, dashArray: entity.dashArray},
            opacity: 1
        };
        const result: Required<CadStyle> = {...defaultStyle, ...params};
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
        let eFontSize: number | undefined;
        if (entity instanceof CadMtext || entity instanceof CadDimension) {
            eFontSize = entity.font_size;
        }
        if (entity instanceof CadLineLike && entity.开料不要) {
            color.setColor(0xff4081);
        }
        result.fontStyle.size = params.fontStyle?.size || eFontSize || 0;
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
            if (entity.fontFamily) {
                if (result.fontStyle.family) {
                    result.fontStyle.family = `${result.fontStyle.family}, ${entity.fontFamily}`;
                } else {
                    result.fontStyle.family = entity.fontFamily;
                }
                result.fontStyle.family = entity.fontFamily;
            }
            if (entity.fontWeight) {
                result.fontStyle.weight = entity.fontWeight;
            }
        }
        result.fontStyle.color = result.color;

        result.lineStyle.width = linewidth;
        result.lineStyle.color = result.color;
        return result;
    }

    correctColor(color: ColoredObject, config: CadViewerConfig, threshold = 5) {
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

    getColorStyle(color: ColoredObject, a = 1) {
        const c = color.getColor();
        const arr = [c.red(), c.green(), c.blue()].map((v) => v * 255);
        if (a > 0 && a < 1) {
            return `rgba(${[...arr, a].join(",")})`;
        } else {
            return `rgb(${arr.join(",")})`;
        }
    }
}
