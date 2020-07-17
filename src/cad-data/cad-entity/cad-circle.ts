import {CadEntity} from "./cad-entity";
import {Vector2, ArcCurve} from "three";
import {CAD_TYPES} from "../cad-types";
import {CadLayer} from "../cad-layer";
import {getVectorFromArray} from "../utils";
import {CadTransformation} from "../cad-transformation";
import {Line2} from "three/examples/jsm/lines/Line2";

export class CadCircle extends CadEntity {
	center: Vector2;
	radius: number;
	object?: Line2;

	get curve() {
		const {center, radius} = this;
		return new ArcCurve(center.x, center.y, radius, 0, Math.PI * 2, true);
	}
	get length() {
		return this.curve.getLength();
	}

	constructor(data: any = {type: CAD_TYPES.circle}, layers: CadLayer[] = [], resetId = false) {
		super(data, layers, resetId);
		this.center = getVectorFromArray(data.center);
		this.radius = data.radius ?? 0;
	}

	transform({matrix}: CadTransformation) {
		this.center.applyMatrix3(matrix);
		return this;
	}

	export() {
		return {
			...super.export(),
			center: this.center.toArray(),
			radius: this.radius
		};
	}

	clone(resetId = false) {
		return new CadCircle(this, [], resetId);
	}

	equals(entity: CadCircle) {
		return this.radius === entity.radius && this.center.equals(entity.center);
	}
}
