import {Vector2} from "three";
import {Line} from "@lucilor/utils";

export function getVectorFromArray(data: number[]) {
	if (!Array.isArray(data)) {
		return new Vector2();
	}
	data = data.filter((v) => !isNaN(v));
	return new Vector2(...data);
}

export function isLinesParallel(lines: Line[], accurary = 0.1) {
	const line0 = lines[0];
	for (let i = 1; i < lines.length; i++) {
		if (Math.abs(line0.slope - lines[i].slope) > accurary) {
			return false;
		}
	}
	return true;
}

export function mergeArray<T>(arr1: T[], arr2: T[], field?: string) {
	if (field) {
		const keys = arr1.map((v) => v[field]);
		arr2.forEach((v) => {
			const idx = keys.indexOf(v[field]);
			if (idx === -1) {
				arr1.push(v);
			} else {
				arr1[idx] = v;
			}
		});
	} else {
		arr1 = Array.from(new Set(arr1.concat(arr2)));
	}
	return arr1;
}

export function separateArray<T>(arr1: T[], arr2: T[], field?: string) {
	if (field) {
		const keys = arr2.map((v) => v[field]);
		arr1 = arr1.filter((v) => !keys.includes(v[field]));
	} else {
		arr1 = arr1.filter((v) => !arr2.includes(v));
	}
	return arr1;
}
