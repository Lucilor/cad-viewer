import {CadEntity} from "./cad-entity";
import {Vector2} from "three";
import {CAD_TYPES} from "../cad-types";
import {CadLayer} from "../cad-layer";
import {getVectorFromArray, isBetween} from "../utils";
import {CadTransformation} from "../cad-transformation";
import {Line2} from "three/examples/jsm/lines/Line2";

export class CadLine extends CadEntity {
	start: Vector2;
	end: Vector2;
	mingzi: string;
	qujian: string;
	gongshi: string;
	guanlianbianhuagongshi: string;
	object?: Line2;

	get valid() {
		const {start, end} = this;
		const dx = Math.abs(start.x - end.x);
		const dy = Math.abs(start.y - end.y);
		return !isBetween(dx) && !isBetween(dy);
	}

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
	get middle() {
		return this.start.clone().add(this.end).divideScalar(2);
	}

	constructor(data: any = {type: CAD_TYPES.line}, layers: CadLayer[] = []) {
		super(data, layers);
		this.start = getVectorFromArray(data.start);
		this.end = getVectorFromArray(data.end);
		this.mingzi = data.mingzi || "";
		this.qujian = data.qujian || "";
		this.gongshi = data.gongshi || "";
		this.guanlianbianhuagongshi = data.guanlianbianhuagongshi || "";
	}

	transform({matrix}: CadTransformation) {
		this.start.applyMatrix3(matrix);
		this.end.applyMatrix3(matrix);
		return this;
	}

	export() {
		return Object.assign(super.export(), {
			start: this.start.toArray(),
			end: this.end.toArray(),
			mingzi: this.mingzi,
			qujian: this.qujian,
			gongshi: this.gongshi,
			guanlianbianhuagongshi: this.guanlianbianhuagongshi
		});
	}

	clone(resetId = false) {
		const data = this.export();
		if (resetId) {
			delete data.id;
		}
		return new CadLine(data);
	}

	isVertical(accuracy = 0) {
		return Math.abs(this.start.x - this.end.x) <= accuracy;
	}

	isHorizonal(accuracy = 0) {
		return Math.abs(this.start.y - this.end.y) <= accuracy;
	}
}
