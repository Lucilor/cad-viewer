import {Vector2, Matrix3} from "three";

export class CadTransformation {
	translate: Vector2;
	flip: {vertical: boolean; horizontal: boolean};
	rotate: {angle: number};
	anchor: Vector2;
	get matrix() {
		const matrix = new Matrix3();
		const {translate, flip, rotate, anchor} = this;
		const {x: tx, y: ty} = translate;
		const sx = flip.horizontal ? -1 : 1;
		const sy = flip.vertical ? -1 : 1;
		const {angle} = rotate;
		matrix.setUvTransform(tx, ty, sx, sy, angle, anchor.x, anchor.y);
		return matrix;
	}

	constructor(
		params: {
			translate?: Vector2;
			flip?: {vertical?: boolean; horizontal?: boolean};
			rotate?: {angle?: number};
			anchor?: Vector2;
		} = {}
	) {
		this.anchor = params.anchor || new Vector2();
		this.translate = params.translate || new Vector2();
		{
			const {vertical = false, horizontal = false} = params.flip || {};
			this.flip = {vertical, horizontal};
		}
		{
			const {angle = 0} = params.rotate || {};
			this.rotate = {angle};
		}
	}
}
