import {CadEntity} from "./cad-entity";
import {CAD_TYPES} from "../cad-types";
import {CadLayer} from "../cad-layer";

export class CadDimension extends CadEntity {
	font_size: number;
	dimstyle: string;
	axis: "x" | "y";
	entity1: {
		id: string;
		location: "start" | "end" | "center";
	};
	entity2: {
		id: string;
		location: "start" | "end" | "center";
	};
	distance: number;
	cad1: string;
	cad2: string;
	mingzi: string;
	qujian: string;

	constructor(data: any = {type: CAD_TYPES.dimension}, layers: CadLayer[] = []) {
		super(data, layers);
		this.font_size = data.font_size || 16;
		this.dimstyle = data.dimstyle || "";
		["entity1", "entity2"].forEach((field) => {
			this[field] = {id: "", location: "center"};
			if (data[field]) {
				if (typeof data[field].id === "string") {
					this[field].id = data[field].id;
				}
				if (["start", "end", "center"].includes(data[field].location)) {
					this[field].location = data[field].location;
				}
			}
		});
		this.axis = data.axis || "x";
		this.distance = data.distance || 16;
		this.cad1 = data.cad1 || "";
		this.cad2 = data.cad2 || "";
		this.mingzi = data.mingzi || "";
		this.qujian = data.qujian || "";
	}

	export() {
		return Object.assign(super.export(), {
			dimstyle: this.dimstyle,
			font_size: this.font_size,
			axis: this.axis,
			entity1: {...this.entity1},
			entity2: {...this.entity2},
			distance: this.distance,
			cad1: this.cad1,
			cad2: this.cad2,
			mingzi: this.mingzi,
			qujian: this.qujian
		});
	}
}
