import {CadCircle} from "./cad-circle";
import {ArcCurve, MathUtils} from "three";
import {CAD_TYPES} from "../cad-types";
import {CadLayer} from "../cad-layer";
import {CadTransformation} from "../cad-transformation";

export class CadArc extends CadCircle {
	start_angle: number;
	end_angle: number;
	clockwise: boolean;
	get curve() {
		const {center, radius, start_angle, end_angle, clockwise} = this;
		return new ArcCurve(center.x, center.y, radius, MathUtils.degToRad(start_angle), MathUtils.degToRad(end_angle), clockwise);
	}

	constructor(data: any = {type: CAD_TYPES.arc}, layers: CadLayer[] = []) {
		super(data, layers);
		this.start_angle = data.start_angle || 0;
		this.end_angle = data.end_angle || 0;
		this.clockwise = data.clockwise || false;
	}

	transform({matrix, flip}: CadTransformation) {
		const {center, curve} = this;
		center.applyMatrix3(matrix);
		const start = curve.getPoint(0).applyMatrix3(matrix);
		const end = curve.getPoint(1).applyMatrix3(matrix);
		const startAngle = Math.atan2(start.y - center.y, start.x - center.x);
		const endAngle = Math.atan2(end.y - center.y, end.x - center.x);
		this.start_angle = MathUtils.radToDeg(startAngle);
		this.end_angle = MathUtils.radToDeg(endAngle);
		if (flip.vertical !== flip.horizontal) {
			this.clockwise = !this.clockwise;
		}
		return this;
	}

	export() {
		return Object.assign(super.export(), {
			start_angle: this.start_angle,
			end_angle: this.end_angle,
			clockwise: this.clockwise
		});
	}

	clone(resetId = false) {
		const data = this.export();
		if (resetId) {
			delete data.id;
		}
		return new CadArc(data);
	}
}
