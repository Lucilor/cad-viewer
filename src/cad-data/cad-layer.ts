import {index2RGB} from "@lucilor/utils";
import {MathUtils} from "three";

export class CadLayer {
	id: string;
	color: number;
	name: string;
	_indexColor: number;
	constructor(data: any = {}) {
		this.color = index2RGB(data.color, "number") || 0;
		this.name = data.name || "";
		this.id = data.id || MathUtils.generateUUID();
		this.color = 0;
		if (data._indexColor && typeof data.color === "number") {
			this._indexColor = data._indexColor;
			this.color = data.color;
		} else {
			this._indexColor = data.color;
			this.color = index2RGB(data.color, "number");
		}
	}

	export() {
		return {id: this.id, color: this._indexColor, name: this.name};
	}
}
