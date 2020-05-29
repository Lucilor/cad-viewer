import {CadLayer} from "../cad-layer";
import {CAD_TYPES} from "../cad-types";
import {MathUtils, Color} from "three";
import {index2RGB, RGB2Index} from "@lucilor/utils";
import {CadTransformation} from "../cad-transformation";

export abstract class CadEntity {
	id: string;
	originalId: string;
	type: string;
	layer: string;
	color: Color;
	visible: boolean;
	opacity: number;
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
		this.originalId = data.originalId || this.id;
		this.layer = typeof data.layer === "string" ? data.layer : "0";
		this.color = new Color();
		if (data._indexColor && typeof data.color === "number") {
			this._indexColor = data._indexColor;
			this.color.set(data.color);
		} else {
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
			}
		}
		this.visible = data.visible === false ? false : true;
		this.opacity = typeof data.opacity === "number" ? data.opacity : 1;
	}

	abstract transform(trans: CadTransformation): this;

	export() {
		this._indexColor = RGB2Index(this.color.getHex());
		return {
			id: this.id,
			originalId: this.originalId,
			layer: this.layer,
			type: this.type,
			color: this._indexColor
		};
	}

	abstract clone(resetId?: boolean): CadEntity;
}
