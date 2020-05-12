import {Vector2} from "three";

export function getVectorFromArray(data: number[]) {
	if (!Array.isArray(data)) {
		return new Vector2();
	}
	data = data.filter((v) => !isNaN(v));
	return new Vector2(...data);
}
