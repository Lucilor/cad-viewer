import {CadViewer} from "./cad-viewer";
import {CadEntity} from "./cad-data/cad-entity/cad-entity";
import {CadMtext} from "./cad-data/cad-entity/cad-mtext";
import {CadDimension} from "./cad-data/cad-entity/cad-dimension";
import {Color} from "three";

export interface CadStyle {
	color?: Color;
	linewidth?: number;
	fontSize?: number;
	opacity?: number;
	fontStyle?: string;
}

export class CadStylizer {
	cad: CadViewer;
	constructor(cad: CadViewer) {
		this.cad = cad;
	}

	get(entity: CadEntity, params: CadStyle = {}) {
		const cad = this.cad;
		const result: CadStyle = {fontStyle: "normal"};
		const {selectable, selected, hover} = entity;
		result.color = new Color(params.color || entity?.color || 0);
		if (selectable) {
			if (selected) {
				if (entity instanceof CadMtext) {
					result.fontStyle = "italic";
				}
			}
			if (hover && typeof cad.config.hoverColor === "number") {
				result.color = new Color(cad.config.hoverColor);
			}
		}
		if (cad.config.reverseSimilarColor) {
			this.correctColor(result.color);
		}
		if (params.linewidth > 0) {
			console.log(params);
			result.linewidth = params.linewidth;
		} else if (entity.linewidth > 0) {
			result.linewidth = entity.linewidth;
		} else {
			result.linewidth = 1;
		}
		let eFontSize: number = null;
		if (entity instanceof CadMtext || entity instanceof CadDimension) {
			eFontSize = entity.font_size;
		}
		if (entity instanceof CadDimension) {
			result.color.setRGB(0, 1, 0);
		}
		result.fontSize = params.fontSize || eFontSize || 16;
		result.opacity = entity.opacity;
		if (typeof params.opacity === "number") {
			result.opacity = params.opacity;
		}
		return result;
	}

	correctColor(color: Color, threshold = 5) {
		if (this.cad.config.reverseSimilarColor) {
			const colorNum = color.getHex();
			if (Math.abs(colorNum - this.cad.config.backgroundColor) <= threshold) {
				color.set(0xfffffff - colorNum);
			}
		}
	}

	getColorStyle(color: Color, a = 1) {
		const {r, g, b} = color;
		const arr = [r, g, b].map((v) => v * 255);
		if (a > 0 && a < 1) {
			return `rgba(${[...arr, a].join(",")})`;
		} else {
			return `rgb(${arr.join(",")})`;
		}
	}
}
