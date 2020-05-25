import {index2RGB, RGB2Index} from "@lucilor/utils";
import {MathUtils, Color} from "three";

export class CadLayer {
	id: string;
	originalId: string;
	color: Color;
	name: string;
	_indexColor: number;
	constructor(data: any = {}) {
		this.name = data.name || "";
		this.id = data.id || MathUtils.generateUUID();
		this.originalId = data.originalId || this.id;
		this.color = new Color();
		if (data._indexColor && typeof data.color === "number") {
			this._indexColor = data._indexColor;
			this.color.set(data.color);
		} else {
			this._indexColor = data.color;
			this.color.set(index2RGB(data.color, "number"));
		}
	}

	export() {
		this._indexColor = RGB2Index(this.color.getHex());
		return {id: this.id, color: this._indexColor, name: this.name, originalId: this.originalId};
	}
}
