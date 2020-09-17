import {CadLayer} from "./cad-layer";
import {CadType, cadTypes} from "./cad-types";
import {Angle, Arc, index2RGB, Line, Point, RGB2Index} from "@lucilor/utils";
import {getVectorFromArray, isBetween, lineweight2linewidth, linewidth2lineweight} from "./utils";
import {G, Matrix, MatrixAlias} from "@svgdotjs/svg.js";
import Color from "color";
import {v4} from "uuid";
import {CadEntities} from "./cad-entities";
import {intersection} from "lodash";

export abstract class CadEntity {
	id: string;
	originalId: string;
	type: CadType = null;
	layer: string;
	color: Color;
	linewidth: number;
	visible: boolean;
	info: {[key: string]: any};
	_indexColor: number;
	_lineweight: number;
	parent: CadEntity = null;
	children: CadEntities;
	el?: G = null;
	needsTransform = false;

	get selectable() {
		return this.el?.hasClass("selectable");
	}
	set selectable(value) {
		if (value) {
			this.el?.addClass("selectable");
		} else {
			this.el?.removeClass("selectable");
		}
		this.children.forEach((c) => (c.selectable = value));
	}
	get selected() {
		return this.el?.hasClass("selected") && this.selectable;
	}
	set selected(value) {
		if (this.el) {
			if (value && this.selectable) {
				this.el.addClass("selected");
				this.el.children().forEach((c) => {
					if (c.hasClass("stroke")) {
						c.css("stroke-dasharray", "20, 7");
					}
					if (c.hasClass("fill")) {
						c.css("font-style", "italic");
					}
				});
			} else {
				this.el.removeClass("selected").css("stroke-dasharray", "");
				this.el.children().forEach((c) => {
					c.css("stroke-dasharray", "");
					c.css("font-style", "");
				});
			}
		}
		this.children.forEach((c) => (c.selected = value));
	}
	get opacity() {
		return Number(this.el?.css("opacity") ?? 1);
	}
	set opacity(value) {
		this.el?.css("opacity", value);
		this.children.forEach((c) => (c.opacity = value));
	}

	constructor(data: any = {}, layers: CadLayer[] = [], resetId = false) {
		if (typeof data !== "object") {
			throw new Error("Invalid data.");
		}
		if (cadTypes.includes(data.type)) {
			this.type = data.type;
		}
		if (typeof data.id === "string" && !resetId) {
			this.id = data.id;
		} else {
			this.id = v4();
		}
		this.originalId = data.originalId ?? this.id;
		this.layer = data.layer ?? "0";
		this.color = new Color();
		if (typeof data.color === "number") {
			this._indexColor = data.color;
			if (data.color === 256) {
				const layer = layers.find((layer) => layer.name === this.layer);
				if (layer) {
					this.color = new Color(layer.color);
				}
			} else {
				this.color = new Color(index2RGB(data.color, "number"));
			}
		} else {
			if (data.color instanceof Color) {
				this.color = new Color(data.color);
			}
			this._indexColor = RGB2Index(this.color.hex());
		}
		this.linewidth = data.linewidth ?? 1;
		this._lineweight = -3;
		if (typeof data.lineweight === "number") {
			this._lineweight = data.lineweight;
			if (data.lineweight >= 0) {
				this.linewidth = lineweight2linewidth(data.lineweight);
			} else if (data.lineweight === -1) {
				const layer = layers.find((layer) => layer.name === this.layer);
				if (layer) {
					this.linewidth = layer.linewidth;
				}
			}
		}
		if (typeof data.info === "object" && !Array.isArray(data.info)) {
			this.info = data.info;
		} else {
			this.info = {};
		}
		this.children = new CadEntities(data.children || {}, [], false);
		this.children.forEach((c) => (c.parent = this));
		this.selectable = data.selectable ?? true;
		this.selected = data.selected ?? false;
		if (data.parent instanceof CadEntity) {
			this.parent = data.parent;
		}
		this.visible = data.visible ?? true;
		this.opacity = data.opacity ?? 1;
	}

	transform(matrix: MatrixAlias, _parent?: CadEntity) {
		this.children.forEach((e) => e.transform(matrix, this));
		return this;
	}

	export() {
		this._indexColor = RGB2Index(this.color.hex());
		return {
			id: this.id,
			originalId: this.originalId,
			layer: this.layer,
			type: this.type,
			color: this._indexColor,
			lineweight: linewidth2lineweight(this.linewidth),
			children: this.children.export(),
			info: this.info
		};
	}

	add(...children: CadEntity[]) {
		children.forEach((e) => {
			if (e instanceof CadEntity) {
				e.parent = this;
				this.children.add(e);
			}
		});
		return this;
	}

	remove(...children: CadEntity[]) {
		children.forEach((e) => {
			if (e instanceof CadEntity) {
				this.children.remove(e);
			}
		});
		return this;
	}

	abstract clone(resetId?: boolean): CadEntity;

	abstract equals(entity: CadEntity): boolean;

	// abstract getBoundingRect(): Rectangle;
}

export class CadArc extends CadEntity {
	center: Point;
	radius: number;
	start_angle: number;
	end_angle: number;
	clockwise: boolean;
	gongshi = "";

	get start() {
		return this.curve.getPoint(0);
	}
	get end() {
		return this.curve.getPoint(1);
	}
	get middle() {
		return this.curve.getPoint(0.5);
	}
	get curve() {
		const {center, radius, start_angle, end_angle, clockwise} = this;
		return new Arc(center, radius, new Angle(start_angle, "deg"), new Angle(end_angle, "deg"), clockwise);
	}
	get length() {
		return this.curve.length;
	}

	constructor(data: any = {}, layers: CadLayer[] = [], resetId = false) {
		super(data, layers, resetId);
		this.type = "ARC";
		this.center = getVectorFromArray(data.center);
		this.radius = data.radius ?? 0;
		this.start_angle = data.start_angle ?? 0;
		this.end_angle = data.end_angle ?? 0;
		this.clockwise = data.clockwise ?? false;
	}

	transform(matrix: MatrixAlias) {
		super.transform(matrix, this);
		this.curve.transform(new Matrix(matrix));
		return this;
	}

	export() {
		return {
			...super.export(),
			center: this.center.toArray(),
			radius: this.radius,
			start_angle: this.start_angle,
			end_angle: this.end_angle,
			clockwise: this.clockwise
		};
	}

	clone(resetId = false) {
		return new CadArc(this, [], resetId);
	}

	equals(entity: CadArc) {
		return this.curve.equals(entity.curve);
	}
}

export class CadCircle extends CadEntity {
	center: Point;
	radius: number;

	get curve() {
		const {center, radius} = this;
		return new Arc(center, radius, new Angle(0, "deg"), new Angle(360, "deg"), true);
	}
	get length() {
		return this.curve.length;
	}

	constructor(data: any = {}, layers: CadLayer[] = [], resetId = false) {
		super(data, layers, resetId);
		this.type = "CIRCLE";
		this.center = getVectorFromArray(data.center);
		this.radius = data.radius ?? 0;
	}

	transform(matrix: MatrixAlias) {
		super.transform(matrix);
		this.center.transform(new Matrix(matrix));
		return this;
	}

	export() {
		return {
			...super.export(),
			center: this.center.toArray(),
			radius: this.radius
		};
	}

	clone(resetId = false) {
		return new CadCircle(this, [], resetId);
	}

	equals(entity: CadCircle) {
		return this.radius === entity.radius && this.center.equals(entity.center);
	}
}

export interface CadDimensionEntity {
	id: string;
	location: "start" | "end" | "center" | "min" | "max";
	defPoint?: number[];
}

export class CadDimension extends CadEntity {
	font_size: number;
	dimstyle: string;
	axis: "x" | "y";
	entity1: CadDimensionEntity;
	entity2: CadDimensionEntity;
	distance: number;
	distance2?: number;
	cad1: string;
	cad2: string;
	mingzi: string;
	qujian: string;
	ref?: "entity1" | "entity2" | "minX" | "maxX" | "minY" | "maxY" | "minLength" | "maxLength";

	private _renderStyle: 1 | 2;
	get renderStyle() {
		return this._renderStyle;
	}
	set renderStyle(value) {
		if (this._renderStyle !== value) {
			this.el?.clear();
		}
		this._renderStyle = value;
	}

	constructor(data: any = {}, layers: CadLayer[] = [], resetId = false) {
		super(data, layers, resetId);
		this.type = "DIMENSION";
		this.font_size = data.font_size || 16;
		if (this.font_size === 2.5) {
			this.font_size = 36;
		}
		this.dimstyle = data.dimstyle || "";
		["entity1", "entity2"].forEach((field: "entity1" | "entity2") => {
			this[field] = {id: "", location: "center"};
			if (data[field]) {
				if (typeof data[field].id === "string") {
					this[field].id = data[field].id;
				}
				this[field].location = data[field].location ?? "center";
			}
		});
		this.axis = data.axis ?? "x";
		this.distance = data.distance ?? 20;
		this.cad1 = data.cad1 ?? "";
		this.cad2 = data.cad2 ?? "";
		this.mingzi = data.mingzi ?? "";
		this.qujian = data.qujian ?? "";
		this.ref = data.ref ?? "entity1";
		this.renderStyle = data.renderStyle ?? 1;
	}

	transform(matrix: Matrix) {
		super.transform(matrix);
		return this;
	}

	export() {
		return {
			...super.export(),
			dimstyle: this.dimstyle,
			font_size: this.font_size,
			axis: this.axis,
			entity1: {...this.entity1},
			entity2: {...this.entity2},
			distance: this.distance,
			cad1: this.cad1,
			cad2: this.cad2,
			mingzi: this.mingzi,
			qujian: this.qujian,
			ref: this.ref,
			renderStyle: this.renderStyle
		};
	}

	clone(resetId = false) {
		return new CadDimension(this, [], resetId);
	}

	equals(dimension: CadDimension) {
		const aIds = [this.entity1.id, this.entity2.id];
		const bIds = [dimension.entity1.id, dimension.entity2.id];
		return intersection(aIds, bIds).length === 2 || this.id === dimension.id || this.originalId === dimension.originalId;
	}
}

export class CadHatch extends CadEntity {
	bgcolor: number[];
	paths: {
		edges: {
			start: Point;
			end: Point;
		}[];
		vertices: Point[];
	}[];

	constructor(data: any = {}, layers: CadLayer[] = [], resetId = false) {
		super(data, layers, resetId);
		this.type = "HATCH";
		this.bgcolor = Array.isArray(data.bgcolor) ? data.bgcolor : [0, 0, 0];
		this.paths = [];
		if (Array.isArray(data.paths)) {
			data.paths.forEach((path) => {
				const edges: CadHatch["paths"][0]["edges"] = [];
				const vertices: CadHatch["paths"][0]["vertices"] = [];
				if (Array.isArray(path.edges)) {
					path.edges.forEach((edge) => {
						const start = getVectorFromArray(edge.start);
						const end = getVectorFromArray(edge.end);
						edges.push({start, end});
					});
				}
				if (Array.isArray(path.vertices)) {
					path.vertices.forEach((vertice) => {
						vertices.push(getVectorFromArray(vertice));
					});
				}
				this.paths.push({edges, vertices});
			});
		}
	}

	export() {
		const paths = [];
		this.paths.forEach((path) => {
			const edges = [];
			const vertices = [];
			path.edges.forEach((edge) => edges.push({start: edge.start.toArray(), end: edge.end.toArray()}));
			path.vertices.forEach((vertice) => vertices.push(vertice.toArray()));
			paths.push({edges, vertices});
		});
		return {...super.export(), paths};
	}

	transform(matrix: MatrixAlias) {
		super.transform(matrix);
		const m = new Matrix(matrix);
		this.paths.forEach((path) => {
			path.edges.forEach((edge) => {
				edge.start.transform(m);
				edge.end.transform(m);
			});
			path.vertices.forEach((vertice) => vertice.transform(m));
		});
		return this;
	}

	clone(resetId = false) {
		return new CadHatch(this, [], resetId);
	}

	equals(entity: CadHatch) {
		// TODO: not yet implemented
		return false;
	}
}

export class CadLine extends CadEntity {
	start: Point;
	end: Point;
	mingzi: string;
	qujian: string;
	gongshi: string;
	guanlianbianhuagongshi: string;
	kongwei: string;
	nextZhewan: "自动" | "无" | "1mm" | "6mm";
	zidingzhankaichang = -1;

	get valid() {
		const {start, end} = this;
		const dx = Math.abs(start.x - end.x);
		const dy = Math.abs(start.y - end.y);
		return !isBetween(dx) && !isBetween(dy);
	}
	get curve() {
		return new Line(this.start, this.end);
	}
	get length() {
		return this.curve.length;
	}
	get slope() {
		return this.curve.slope;
	}
	get theta() {
		return this.curve.theta;
	}
	get middle() {
		return this.curve.middle;
	}
	get maxX() {
		return Math.max(this.start.x, this.end.x);
	}
	get maxY() {
		return Math.max(this.start.y, this.end.y);
	}
	get minX() {
		return Math.min(this.start.x, this.end.x);
	}
	get minY() {
		return Math.min(this.start.y, this.end.y);
	}

	constructor(data: any = {}, layers: CadLayer[] = [], resetId = false) {
		super(data, layers, resetId);
		this.type = "LINE";
		this.start = getVectorFromArray(data.start);
		this.end = getVectorFromArray(data.end);
		this.mingzi = data.mingzi ?? "";
		this.qujian = data.qujian ?? "";
		this.gongshi = data.gongshi ?? "";
		this.guanlianbianhuagongshi = data.guanlianbianhuagongshi ?? "";
		this.kongwei = data.kongwei ?? "";
		this.nextZhewan = data.nextZhewan ?? "自动";
		this.zidingzhankaichang = data.zidingzhankaichang ?? -1;
	}

	transform(matrix: MatrixAlias) {
		super.transform(matrix);
		const m = new Matrix(matrix);
		this.start.transform(m);
		this.end.transform(m);
		return this;
	}

	export() {
		return {
			...super.export(),
			start: this.start.toArray(),
			end: this.end.toArray(),
			mingzi: this.mingzi,
			qujian: this.qujian,
			gongshi: this.gongshi,
			guanlianbianhuagongshi: this.guanlianbianhuagongshi,
			kongwei: this.kongwei,
			nextZhewan: this.nextZhewan,
			zidingzhankaichang: this.zidingzhankaichang
		};
	}

	clone(resetId = false) {
		return new CadLine(this, [], resetId);
	}

	equals(entity: CadLine) {
		return this.curve.equals(entity.curve);
	}

	isVertical(accuracy = 0) {
		return Math.abs(this.start.x - this.end.x) <= accuracy;
	}

	isHorizonal(accuracy = 0) {
		return Math.abs(this.start.y - this.end.y) <= accuracy;
	}
}

export class CadMtext extends CadEntity {
	insert: Point;
	font_size: number;
	text: string;
	anchor: Point;

	constructor(data: any = {}, layers: CadLayer[] = [], resetId = false) {
		super(data, layers, resetId);
		this.type = "MTEXT";
		this.insert = getVectorFromArray(data.insert);
		this.font_size = data.font_size ?? 16;
		this.text = data.text ?? "";
		if (typeof data.anchor?.[1] === "number") {
			data.anchor[1] = data.anchor[1];
		}
		this.anchor = getVectorFromArray(data.anchor, new Point(0, 1));
	}

	export() {
		const anchor = this.anchor.toArray();
		return {
			...super.export(),
			insert: this.insert.toArray(),
			font_size: this.font_size,
			text: this.text,
			anchor
		};
	}

	transform(matrix: MatrixAlias, parent?: CadEntity) {
		super.transform(matrix);
		const m = new Matrix(matrix);
		this.insert.transform(m);
		if (this.info.isLengthText || this.info.isGongshiText) {
			if (!Array.isArray(this.info.offset)) {
				this.info.offset = [0, 0];
			}
			if (!parent) {
				this.info.offset[0] += m.e;
				this.info.offset[1] += m.f;
			}
		}
		return this;
	}

	clone(resetId = false) {
		return new CadMtext(this, [], resetId);
	}

	equals(entity: CadMtext) {
		return (
			this.insert.equals(entity.insert) &&
			this.font_size === entity.font_size &&
			this.text === entity.text &&
			this.anchor.equals(entity.anchor)
		);
	}
}

export function getCadEntity<T extends CadEntity>(data: any = {}, layers: CadLayer[] = [], resetId = false) {
	let entity: CadEntity;
	const type = data.type as CadType;
	if (type === "ARC") {
		entity = new CadArc(data, layers, resetId);
	} else if (type === "CIRCLE") {
		entity = new CadCircle(data, layers, resetId);
	} else if (type === "DIMENSION") {
		entity = new CadDimension(data, layers, resetId);
	} else if (type === "HATCH") {
		entity = new CadHatch(data, layers, resetId);
	} else if (type === "LINE") {
		entity = new CadLine(data, layers, resetId);
	} else if (type === "MTEXT") {
		entity = new CadMtext(data, layers, resetId);
	}
	return entity as T;
}
