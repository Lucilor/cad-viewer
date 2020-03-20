export enum CadTypes {
	Line = "LINE",
	MText = "MTEXT",
	Dimension = "DIMENSION",
	Arc = "ARC",
	Circle = "CIRCLE",
	LWPolyline = "LWPOLYLINE",
	Hatch = "HATCH"
}

export interface TextInfo {
	text?: string;
	rawText?: string;
	mingzi?: string;
	qujian?: string;
	gongshi?: string;
	to: string[];
}

export interface CadEntity {
	id: string;
	type: string;
	layer: string;
	color: number;
	colorRGB?: number;
	lineWidth?: number;
	container?: PIXI.Container;
	selected?: boolean;
	selectable?: boolean;
}

export interface CadLine extends CadEntity {
	start: number[];
	end: number[];
	mingzi?: string;
	qujian?: string;
	gongshi?: string;
}

export interface CadCircle extends CadEntity {
	center: number[];
	radius: number;
}

export interface CadArc extends CadEntity {
	center: number[];
	radius: number;
	start_angle: number;
	end_angle: number;
	clockwise?: boolean;
}

export interface CadMText extends CadEntity {
	insert: number[];
	text: TextInfo;
	font_size: number;
}

export interface CadDimension extends CadEntity {
	defpoint: number[];
	defpoint2: number[];
	defpoint3: number[];
	text: TextInfo;
	font_size: number;
	dimstyle: string;
}

export interface CadLWPolyline extends CadEntity {
	points: number[][];
	closed: boolean;
}

export interface CadHatch extends CadEntity {
	paths: {edges?: {start: number[]; end: number}[]; vertices?: number[][]}[];
}

export interface CadLayer {
	color: number;
	colorRGB: number;
	name: string;
}

export interface CadBaseLine {
	name: string;
	idX: string;
	idY: string;
	valueX?: number;
	valueY?: number;
}

export interface CadJointPoint {
	name: string;
	valueX?: number;
	valueY?: number;
}

export interface CadOption {
	name: string;
	value: string;
}

export interface CadData<T extends CadEntity = CadEntity> {
	entities: T[];
	layers: CadLayer[];
	id?: string;
	name?: string;
	type?: string;
	conditions?: string[];
	baseLines?: CadBaseLine[];
	jointPoints?: CadJointPoint[];
	options?: CadOption[];
	parent?: string;
	partners?: CadData[];
	components?: Components;
	dimensions?: Dimension[];
	mtexts?: MText[];
}

export interface CadRawData extends CadData {
	lineText: (CadMText | CadDimension)[];
	globalText: (CadMText | CadDimension)[];
}

export interface Dimension {
	axis: "x" | "y";
	entity1: {id: string; location: "start" | "end" | "center"};
	entity2: {id: string; location: "start" | "end" | "center"};
	distance: number;
	fontSize: number;
	dimstyle: string;
	cad1?: string;
	cad2?: string;
	mingzi?: string;
	qujian?: string;
}

export interface MText {
	entity: string;
	distance: number;
	text: string;
	fontSize: number;
}

export interface Component {
	name: string;
	entities: CadEntity[];
}

export interface Components {
	data: Component[];
	connections: Connection[];
}

export interface Connection {
	names: string[];
	lines: string[];
	space: string;
	position: ComponentPosition;
	axis?: "x" | "y";
	offset?: {x?: number; y?: number};
}

export type ComponentPosition = "absolute" | "relative";
