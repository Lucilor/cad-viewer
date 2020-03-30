import {Point} from "@lucilor/utils";
import {CadOption} from ".";

export interface LineStyle {
	color?: number;
	lineWidth?: number;
}

export interface TextStyle {
	color?: number;
	fontSize?: number;
}

export enum Events {
	entityhover = "entityhover",
	entityout = "entityout",
	entityclick = "entityclick",
	linelengthclick = "linelengthclick",
	dragstart = "dragstart",
	drag = "drag",
	dragend = "dragend",
	wheel = "wheel"
}

export interface Tramsform {
	translate?: Point;
	flip?: {vertical?: boolean; horizontal?: boolean; anchor?: Point};
	rotate?: {angle?: number; anchor?: Point};
}

export interface Config {
	backgroundColor?: number;
	selectedColor?: number;
	hoverColor?: number;
	showLineLength?: number;
	maxScale?: number;
	minScale?: number;
	padding?: number[] | number;
	selectMode?: "none" | "single" | "multiple";
	fontSize?: number;
	dragAxis?: "x" | "y" | "xy" | "";
	transparent?: boolean;
	fps?: number; // 每秒内执行render方法的最大次数
	drawMTexts?: boolean;
	drawDimensions?: boolean;
	drawPolyline?: boolean;
	reverseSimilarColor?: true; // 颜色与背景相近时反相显示
}

export const defaultConfig: Config = {
	backgroundColor: 0,
	selectedColor: 0xffff00,
	hoverColor: 0x00ffff,
	showLineLength: 0,
	maxScale: 5,
	minScale: 0.1,
	padding: [0],
	selectMode: "none",
	fontSize: 17,
	dragAxis: "xy",
	transparent: false,
	fps: 60,
	drawMTexts: false,
	drawDimensions: false,
	drawPolyline: false,
	reverseSimilarColor: true
};

function _obj2Arr(obj: object) {
	if (typeof obj !== "object") {
		return obj;
	}
	const arr = [];
	for (const key in obj) {
		const v = {...obj[key], id: key};
		arr.push(v);
	}
	return arr;
}

function _arr2Obj(arr: any[]) {
	if (!Array.isArray(arr)) {
		return arr;
	}
	const obj = {};
	arr.forEach(v => {
		obj[v.id] = v;
		delete v.id;
	});
	return obj;
}

export function transformData(data: any, to: "array" | "object") {
	if (typeof data !== "object" || Array.isArray(data)) {
		console.warn("Invalid argument: data.");
		return {};
	}
	if (!["array", "object"].includes(to)) {
		console.warn("Invalid argument: to.");
		return {};
	}
	const list = ["entities", "layers", "lineText", "globalText"];
	if (to === "array") {
		for (const key of list) {
			if (data[key] && !Array.isArray(data[key])) {
				data[key] = _obj2Arr(data[key]);
			}
		}
		if (!Array.isArray(data.options)) {
			const options: CadOption[] = [];
			for (const key in data.options) {
				options.push({name: key, value: data.options[key]});
			}
			data.options = options;
		}
	}
	if (to === "object") {
		for (const key of list) {
			if (data[key] && Array.isArray(data[key])) {
				data[key] = _arr2Obj(data[key]);
			}
		}
		if (Array.isArray(data.options)) {
			const options = {};
			(data.options as CadOption[]).forEach(o => {
				if (o.name) {
					options[o.name] = o.value;
				}
			});
			data.options = options;
		}
	}
	data.partners?.forEach(v => transformData(v, to));
	data.components?.data.forEach(v => transformData(v, to));
	return data;
}
