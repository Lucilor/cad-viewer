import {CadLayer} from "../cad-layer";
import {CAD_TYPES} from "../cad-types";
import {MathUtils, Color, Object3D} from "three";
import {index2RGB, RGB2Index} from "@lucilor/utils";
import {CadTransformation} from "../cad-transformation";
import {lineweight2linewidth, linewidth2lineweight} from "../utils";

export abstract class CadEntity {
	id: string;
	originalId: string;
	type: string;
	layer: string;
	color: Color;
	linewidth: number;
	visible: boolean;
	opacity: number;
	selectable: boolean;
	selected: boolean;
	hover: boolean;
	object?: Object3D = null;
	info?: {[key: string]: any} = {};
	_indexColor: number;
	_lineweight: number;

	constructor(data: any = {}, layers: CadLayer[], resetId: boolean) {
		if (typeof data !== "object") {
			throw new Error("Invalid data.");
		}
		if (Object.values(CAD_TYPES).includes(data.type)) {
			this.type = data.type;
		} else {
			throw new Error(`Unrecognized cad type: ${data.type}`);
		}
		if (typeof data.id === "string" && !resetId) {
			this.id = data.id;
		} else {
			this.id = MathUtils.generateUUID();
		}
		this.originalId = data.originalId || this.id;
		this.layer = typeof data.layer === "string" ? data.layer : "0";
		this.color = new Color();
		if (typeof data.color === "number") {
			this._indexColor = data.color;
			if (data.color === 256) {
				const layer = layers.find((layer) => layer.name === this.layer);
				if (layer) {
					this.color.set(layer.color);
				}
			} else {
				this.color.set(index2RGB(data.color, "number"));
			}
		} else {
			if (data.color instanceof Color) {
				this.color = data.color;
			}
			this._indexColor = RGB2Index(this.color.getHex());
		}
		this.linewidth = typeof data.linewidth === "number" ? data.linewidth : 1;
		this._lineweight = -3;
		if (typeof data.lineweight === "number") {
			this._lineweight = data.lineweight;
			if (data.lineweight >= 0) {
				this.linewidth = lineweight2linewidth(data.lineweight);
			} else if (data.lineweight === -1) {
				const layer = layers.find((layer) => layer.name === this.layer);
				if (layer) {
					this.linewidth = layer.linewidth;
				}
			}
		}
		this.visible = data.visible === false ? false : true;
		this.opacity = typeof data.opacity === "number" ? data.opacity : 1;
		this.selectable = data.selectable === false ? false : true;
		this.selected = data.selected === true ? true : false;
		this.hover = data.hover === true ? true : false;
		if (data.info !== undefined) {
			this.info = data.info;
		}
	}

	abstract transform(trans: CadTransformation): this;

	export() {
		this._indexColor = RGB2Index(this.color.getHex());
		return {
			id: this.id,
			originalId: this.originalId,
			layer: this.layer,
			type: this.type,
			color: this._indexColor,
			lineweight: linewidth2lineweight(this.linewidth)
		};
	}

	abstract clone(resetId?: boolean): CadEntity;

	abstract equals(entity: CadEntity): boolean;
}
