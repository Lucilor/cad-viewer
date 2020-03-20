import {Point} from "@lucilor/utils";

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
	showPartners?: boolean;
	drawMText?: boolean;
	drawPolyline?: false;
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
	showPartners: false,
	drawMText: false,
	drawPolyline: false,
	reverseSimilarColor: true
};
