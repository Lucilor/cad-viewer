import {CadLayer} from "../cad-layer";
import {CAD_TYPES} from "../cad-types";
import {MathUtils} from "three";
import {index2RGB} from "@lucilor/utils";
import {CadTransformation} from "../cad-transformation";

export class CadEntity {
	id: string;
	type: string;
	layer: string;
	color: number;
	visible: boolean;
	_indexColor: number;
	constructor(data: any = {}, layers: CadLayer[] = []) {
		if (typeof data !== "object") {
			throw new Error("Invalid data.");
		}
		if (Object.values(CAD_TYPES).includes(data.type)) {
			this.type = data.type;
		} else {
			throw new Error(`Unrecognized cad type: ${data.type}`);
		}
		this.id = typeof data.id === "string" ? data.id : MathUtils.generateUUID();
		this.layer = typeof data.layer === "string" ? data.layer : "0";
		this.color = 0;
		if (data._indexColor && typeof data.color === "number") {
			this._indexColor = data._indexColor;
			this.color = data.color;
		} else {
			this._indexColor = data.color;
			if (typeof data.color === "number") {
				if (data.color === 256) {
					const layer = layers.find((layer) => layer.name === this.layer);
					if (layer) {
						this.color = layer.color;
					}
				} else {
					this.color = index2RGB(data.color, "number");
				}
			}
		}
		this.visible = data.visible === false ? false : true;
	}

	transform(_params: CadTransformation) {}

	export() {
		return {
			id: this.id,
			layer: this.layer,
			type: this.type,
			color: this._indexColor
		};
	}
}
