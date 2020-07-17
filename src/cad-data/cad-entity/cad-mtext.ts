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

	constructor(data: any = {type: CAD_TYPES.mtext}, layers: CadLayer[] = [], resetId = false) {
		super(data, layers, resetId);
		this.insert = getVectorFromArray(data.insert);
		this.font_size = data.font_size ?? 16;
		this.text = data.text ?? "";
		this.anchor = getVectorFromArray(data.anchor);
	}

	export() {
		return {
			...super.export(),
			insert: this.insert.toArray(),
			font_size: this.font_size,
			text: this.text,
			anchor: this.anchor.toArray()
		};
	}

	transform({matrix}: CadTransformation) {
		this.insert.applyMatrix3(matrix);
		return this;
	}

	clone(resetId = false) {
		return new CadMtext(this, [], resetId);
	}

	equals(entity: CadMtext) {
		return (
			this.insert.equals(entity.insert) &&
			this.font_size === entity.font_size &&
			this.text === entity.text &&
			this.anchor.equals(entity.anchor)
		);
	}
}
