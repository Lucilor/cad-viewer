import {Vector2, Matrix3} from "three";

export class CadTransformation {
	translate = new Vector2();
	flip = {vertical: false, horizontal: false, anchor: new Vector2()};
	rotate = {angle: 0, anchor: new Vector2()};
	get matrix() {
		const matrix = new Matrix3();
		const {translate, flip, rotate} = this;
		const {x: tx, y: ty} = translate;
		// TODO 翻转锚点未实现
		const sx = flip.horizontal ? -1 : 1;
		const sy = flip.vertical ? -1 : 1;
		const {angle, anchor} = rotate;
		matrix.setUvTransform(tx, ty, sx, sy, angle, anchor.x, anchor.y);
		return matrix;
	}

	constructor(
		params: {
			translate?: CadTransformation["translate"];
			flip?: CadTransformation["flip"];
			rotate?: CadTransformation["rotate"];
		} = {}
	) {
		if (params.translate) {
			this.translate = params.translate;
		}
		if (params.flip) {
			this.flip = params.flip;
		}
		if (params.rotate) {
			this.rotate = params.rotate;
		}
	}

	setTranslate(x = 0, y = 0) {
		this.translate.set(x, y);
		return this;
	}
	setFlip(vertical = false, horizontal = false, anchor: number[] = []) {
		this.flip.vertical = vertical;
		this.flip.horizontal = horizontal;
		this.flip.anchor.setX(anchor[0] || 0);
		this.flip.anchor.setY(anchor[1] || 0);
		return this;
	}
	setRotate(angle = 0, anchor: number[] = []) {
		this.rotate.angle = angle;
		this.rotate.anchor.setX(anchor[0] || 0);
		this.rotate.anchor.setY(anchor[1] || 0);
		return this;
	}
}
