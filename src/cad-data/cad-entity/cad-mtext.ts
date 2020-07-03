import {CadEntity} from "./cad-entity";
import {Vector2} from "three";
import {CAD_TYPES} from "../cad-types";
import {CadLayer} from "../cad-layer";
import {getVectorFromArray} from "../utils";
import {CadTransformation} from "../cad-transformation";
import TextSprite from "@seregpie/three.text-sprite";

export class CadMtext extends CadEntity {
	insert: Vector2;
	font_size: number;
	text: string;
	anchor: Vector2;
	object?: TextSprite;

	constructor(data: any = {type: CAD_TYPES.mtext}, layers: CadLayer[] = []) {
		super(data, layers);
		this.insert = getVectorFromArray(data.insert);
		this.font_size = data.font_size || 16;
		this.text = data.text || "";
		this.anchor = getVectorFromArray(data.anchor);
	}

	export() {
		return Object.assign(super.export(), {
			insert: this.insert.toArray(),
			font_size: this.font_size,
			text: this.text,
			anchor: this.anchor.toArray()
		});
	}

	transform({matrix}: CadTransformation) {
		this.insert.applyMatrix3(matrix);
		// this.anchor.applyMatrix3(matrix);
		return this;
	}

	clone(resetId = false) {
		const data = this.export();
		if (resetId) {
			delete data.id;
		}
		return new CadMtext(data);
	}
}
