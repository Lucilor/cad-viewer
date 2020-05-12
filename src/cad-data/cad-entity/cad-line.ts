import {CadEntity} from ".";
import {Vector2} from "three";
import {CAD_TYPES} from "../cad-types";
import {CadLayer} from "../cad-layer";
import {getVectorFromArray} from "../utils";
import {CadTransformation} from "../cad-transformation";

export class CadLine extends CadEntity {
	start: Vector2;
	end: Vector2;
	mingzi?: string;
	qujian?: string;
	gongshi?: string;
	get length() {
		return this.start.distanceTo(this.end);
	}
	get slope() {
		const {start, end} = this;
		return (start.y - end.y) / (start.x - end.x);
	}
	get theta() {
		const {start, end} = this;
		return Math.atan2(start.y - end.y, start.x - end.x);
	}

	constructor(data: any = {type: CAD_TYPES.line}, layers: CadLayer[] = []) {
		super(data, layers);
		this.start = getVectorFromArray(data.start);
		this.end = getVectorFromArray(data.end);
		this.mingzi = data.mingzi || "";
		this.qujian = data.qujian || "";
		this.gongshi = data.gongshi || "";
	}

	transform({matrix}: CadTransformation) {
		this.start.applyMatrix3(matrix);
		this.end.applyMatrix3(matrix);
	}

	export() {
		return Object.assign(super.export(), {
			start: this.start.toArray(),
			end: this.end.toArray(),
			mingzi: this.mingzi,
			qujian: this.qujian,
			gongshi: this.gongshi
		});
	}
}
