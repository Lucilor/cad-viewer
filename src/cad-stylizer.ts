import Color from "color";
import {CadDimension, CadEntity, CadHatch, CadLine, CadMtext} from "./cad-data/cad-entity";
import {CadViewer} from "./cad-viewer";

export interface FontStyle {
    size: number;
    family: string;
    weight: string;
}
export interface CadStyle {
    color: string;
    linewidth: number;
    fontStyle: FontStyle;
    opacity: number;
}

export class CadStylizer {
    cad: CadViewer;
    constructor(cad: CadViewer) {
        this.cad = cad;
    }

    get(entity: CadEntity, params: Partial<CadStyle> = {}) {
        const cad = this.cad;
        const result: CadStyle = {
            color: "white",
            linewidth: 1,
            fontStyle: {size: 16, family: "", weight: ""},
            opacity: 1
        };
        let color = new Color(params.color || entity?.color || 0);
        if (params.linewidth && params.linewidth > 0) {
            result.linewidth = params.linewidth;
        } else if (entity.linewidth > 0) {
            result.linewidth = entity.linewidth;
        } else {
            result.linewidth = 1;
        }
        let eFontSize: number | undefined;
        if (entity instanceof CadMtext || entity instanceof CadDimension) {
            eFontSize = entity.font_size;
        }
        result.fontStyle.size = params.fontStyle?.size || eFontSize || 16;
        result.opacity = entity.opacity;
        if (typeof params.opacity === "number") {
            result.opacity = params.opacity;
        }

        const {validateLines, reverseSimilarColor, minLinewidth} = cad.config();
        if (validateLines && entity instanceof CadLine) {
            if (entity.info.errors?.length) {
                result.linewidth *= 10;
                color = new Color(0xff0000);
            }
        }
        if (reverseSimilarColor) {
            color = this.correctColor(color);
        }
        result.color = color.hex();
        if (!(entity instanceof CadHatch)) {
            // ? make lines easier to select
            result.linewidth = Math.max(minLinewidth, result.linewidth);
        }

        result.fontStyle.family = cad.config("fontFamily");
        result.fontStyle.weight = cad.config("fontWeight");
        if (entity instanceof CadMtext) {
            if (entity.fontFamily) {
                result.fontStyle.family = entity.fontFamily;
            }
            if (entity.fontWeight) {
                result.fontStyle.weight = entity.fontWeight;
            }
        }

        return result;
    }

    correctColor(color: Color, threshold = 5) {
        const {reverseSimilarColor, backgroundColor} = this.cad.config();
        if (reverseSimilarColor) {
            if (Math.abs(color.rgbNumber() - new Color(backgroundColor).rgbNumber()) <= threshold) {
                return color.negate();
            }
        }
        return color;
    }

    getColorStyle(color: Color, a = 1) {
        const arr = [color.red(), color.green(), color.blue()].map((v) => v * 255);
        if (a > 0 && a < 1) {
            return `rgba(${[...arr, a].join(",")})`;
        } else {
            return `rgb(${arr.join(",")})`;
        }
    }
}
