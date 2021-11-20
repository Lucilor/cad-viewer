import {CadDimension, CadEntity, CadHatch, CadLine, CadMtext} from "./cad-data/cad-entity";
import {CadViewer} from "./cad-viewer";
import {ColoredObject} from "./colored-object";

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
        let color = new ColoredObject(params.color || entity?.getColor() || 0);
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
                color.setColor(0xff0000);
            }
        }
        if (reverseSimilarColor) {
            color = this.correctColor(color);
        }
        result.color = color.getColor().hex();
        if (!(entity instanceof CadHatch)) {
            // ? make lines easier to select
            result.linewidth = Math.max(minLinewidth, result.linewidth);
        }

        result.fontStyle.family = cad.config("fontFamily");
        result.fontStyle.weight = cad.config("fontWeight");
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
        return result;
    }

    correctColor(color: ColoredObject, threshold = 5) {
        const {reverseSimilarColor, backgroundColor} = this.cad.config();
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
