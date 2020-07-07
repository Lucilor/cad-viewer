import {Vector2} from "three";
import {CadLine} from "./cad-entity/cad-line";

export function getVectorFromArray(data: number[]) {
	if (!Array.isArray(data)) {
		return new Vector2();
	}
	data = data.filter((v) => !isNaN(v));
	return new Vector2(...data);
}

export function isLinesParallel(lines: CadLine[], accurary = 0) {
	const line0 = lines[0];
	const theta0 = Math.atan((line0.start.y - line0.end.y) / (line0.start.x - line0.end.x));
	for (let i = 1; i < lines.length; i++) {
		const {start, end} = lines[i];
		const theta1 = Math.atan((start.y - end.y) / (start.x - end.x));
		const dTheta = Math.abs(theta0 - theta1);
		if (dTheta !== Math.PI && dTheta > accurary) {
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

export const isBetween = (n: number, min = 0.01, max = 0.5) => n > min && n < max;

export type Expressions = {[key: string]: string};

export class ExpressionsParser {
	expressions: Expressions;
	builtinFns = {
		round: "Math.round"
	};
	operators = ["+", "-", "*", "×", "÷", "/"];
	get regOperators() {
		return this.operators.map((o) => {
			if (["+", "/", "*"].includes(o)) {
				return "\\" + o;
			}
			return o;
		});
	}

	constructor(exps?: Expressions) {
		this.expressions = exps || {};
	}

	getVariables(rightSideOnly = false) {
		const vars = new Set<string>();
		const {expressions: exps, builtinFns, regOperators} = this;
		const opReg = new RegExp(regOperators.join("|"), "g");
		for (const key in exps) {
			if (!rightSideOnly && isNaN(Number(key))) {
				vars.add(key);
			}
			exps[key].split(opReg).forEach((name) => {
				Object.keys(builtinFns).forEach((fn) => {
					const fnReg = new RegExp(`${fn}|\\(|\\)`, "g");
					name = name.replace(fnReg, "");
				});
				if (isNaN(Number(name))) {
					vars.add(name);
				}
			});
		}
		return Array.from(vars);
	}
}

export function lineweight2linewidth(value: number) {
	return value / 100 / 0.25;
}

export function linewidth2lineweight(value: number) {
	return value * 100 * 0.25;
}
