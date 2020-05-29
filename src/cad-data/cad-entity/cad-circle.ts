import {CadEntity} from "./cad-entity";
import {Vector2, ArcCurve} from "three";
import {CAD_TYPES} from "../cad-types";
import {CadLayer} from "../cad-layer";
import {getVectorFromArray} from "../utils";
import {CadTransformation} from "../cad-transformation";

export class CadCircle extends CadEntity {
	center: Vector2;
	radius: number;
	get curve() {
		const {center, radius} = this;
		return new ArcCurve(center.x, center.y, radius, 0, Math.PI * 2, true);
	}

	constructor(data: any = {type: CAD_TYPES.circle}, layers: CadLayer[] = []) {
		super(data, layers);
		this.center = getVectorFromArray(data.center);
		this.radius = data.radius || 0;
	}

	transform({matrix}: CadTransformation) {
		this.center.applyMatrix3(matrix);
		return this;
	}

	export() {
		return Object.assign(super.export(), {
			center: this.center.toArray(),
			radius: this.radius
		});
	}

	clone(resetId = false) {
		const data = this.export();
		if (resetId) {
			delete data.id;
		}
		return new CadCircle(data);
	}
}
