import {MathUtils, Vector2, ArcCurve, Vector3} from "three";
import {index2RGB, Line, Point, Angle, Arc} from "@lucilor/utils";
import {cloneDeep} from "lodash";

export const enum CadTypes {
	Line = "LINE",
	MText = "MTEXT",
	Dimension = "DIMENSION",
	Arc = "ARC",
	Circle = "CIRCLE",
	LWPolyline = "LWPOLYLINE",
	Hatch = "HATCH"
}

export const cadTypes = {
	line: "LINE",
	mtext: "MTEXT",
	dimension: "DIMENSION",
	arc: "ARC",
	circle: "CIRCLE",
	hatch: "HATCH"
};

export interface CadTransform {
	translate?: number[];
	flip?: {vertical?: boolean; horizontal?: boolean; anchor?: number[]};
	rotate?: {angle?: number; anchor?: number[]};
}

export class CadData {
	entities: CadEntities;
	layers: CadLayer[];
	id: string;
	name: string;
	type: string;
	conditions: string[];
	options: CadOption[];
	baseLines: CadBaseLine[];
	jointPoints: CadJointPoint[];
	parent: string;
	partners: CadData[];
	components: Components;
	readonly visible: boolean;
	constructor(data: any = {}) {
		if (typeof data !== "object") {
			throw new Error("Invalid data.");
		}
		this.id = typeof data.id === "string" ? data.id : MathUtils.generateUUID();
		this.name = typeof data.name === "string" ? data.name : "";
		this.type = typeof data.type === "string" ? data.type : "";
		this.layers = [];
		if (typeof data.layers === "object") {
			for (const id in data.layers) {
				this.layers.push(new CadLayer(data.layers[id]));
			}
		}
		this.entities = new CadEntities(data.entities || {}, this.layers);
		this.conditions = Array.isArray(data.conditions) ? data.conditions : [];
		this.options = [];
		if (typeof data.options === "object") {
			for (const key in data.options) {
				this.options.push(new CadOption(key, data.options[key]));
			}
		}
		this.baseLines = [];
		if (Array.isArray(data.baseLines)) {
			data.baseLines.forEach((v) => {
				this.baseLines.push(new CadBaseLine(v));
			});
		}
		this.jointPoints = [];
		if (Array.isArray(data.jointPoints)) {
			data.jointPoints.forEach((v) => {
				this.jointPoints.push(new CadJointPoint(v));
			});
		}
		this.parent = data.parent || "";
		this.partners = [];
		this.components = new Components(data.components || {});
		if (Array.isArray(data.partners)) {
			data.partners.forEach((v) => {
				this.addPartner(new CadData(v));
			});
		}
		this.visible = data.visible === false ? false : true;
	}

	export() {
		this.updateBaseLines();
		const exLayers = {};
		this.layers.forEach((v) => {
			exLayers[v.id] = {id: v.id, color: v._indexColor, name: v.name};
		});
		const exOptions = {};
		this.options.forEach((v) => {
			if (v.name) {
				exOptions[v.name] = v.value;
			}
		});
		const result = {
			layers: exLayers,
			entities: this.entities.export(),
			id: this.id,
			name: this.name,
			type: this.type,
			conditions: this.conditions.filter((v) => v),
			options: exOptions,
			baseLines: cloneDeep(this.baseLines),
			jointPoints: cloneDeep(this.jointPoints),
			parent: this.parent,
			partners: this.partners.map((v) => v.export()),
			components: this.components.export()
		};
		return result;
	}

	/**
	 * 100: this.entities
	 * 010: this.partners entities
	 * 001: components.partners entities
	 */
	getAllEntities(mode = 0b111) {
		const result = new CadEntities();
		if (mode & 0b100) {
			result.merge(this.entities);
		}
		if (mode & 0b010) {
			this.partners.forEach((p) => {
				result.merge(p.getAllEntities(mode));
			});
		}
		if (mode & 0b001) {
			this.components.data.forEach((c) => {
				result.merge(c.getAllEntities(mode));
			});
		}
		return result;
	}

	findEntity(id: string) {
		return this.getAllEntities().find(id);
	}

	clone() {
		return new CadData(this.export());
	}

	private _mergeArray(arr1: any[], arr2: any[], field?: string) {
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

	merge(data: CadData) {
		this.layers = this.layers.concat(data.layers);
		this.entities.merge(data.entities);
		this.conditions = this._mergeArray(this.conditions, data.conditions);
		this.options = this._mergeArray(this.options, data.options, "name");
		this.partners = this._mergeArray(this.partners, data.partners, "id");
		this.jointPoints = this._mergeArray(this.jointPoints, data.jointPoints, "name");
		this.baseLines = this._mergeArray(this.baseLines, data.baseLines, "name");
		this.components.connections = this._mergeArray(this.components.connections, data.components.connections);
		this.components.data = this._mergeArray(this.components.data, data.components.data, "id");
		return this;
	}

	transform({translate, flip, rotate}: CadTransform) {
		this.entities.transform({translate, flip, rotate});
		this.partners.forEach((v) => v.transform({translate, flip, rotate}));
		this.components.data.forEach((v) => v.transform({translate, flip, rotate}));
		this.baseLines.forEach((v) => {
			const point = new Point(v.valueX, v.valueY);
			if (translate) {
				point.add(translate[0], translate[1]);
			}
			if (flip) {
				point.flip(flip.vertical, flip.horizontal, new Point(flip.anchor));
			}
			if (rotate) {
				point.rotate(rotate.angle, new Point(rotate.anchor));
			}
			v.valueX = point.x;
			v.valueY = point.y;
		});
		this.jointPoints.forEach((v) => {
			const point = new Point(v.valueX, v.valueY);
			if (translate) {
				point.add(translate[0], translate[1]);
			}
			if (flip) {
				point.flip(flip.vertical, flip.horizontal, new Point(flip.anchor));
			}
			if (rotate) {
				point.rotate(rotate.angle, new Point(rotate.anchor));
			}
			v.valueX = point.x;
			v.valueY = point.y;
		});
	}

	updateBaseLines() {
		this.baseLines.forEach((v) => {
			const eX = this.findEntity(v.idX);
			const eY = this.findEntity(v.idY);
			if (eX instanceof CadLine) {
				v.valueX = eX.start.x;
			} else {
				v.valueX = NaN;
			}
			if (eY instanceof CadLine) {
				v.valueY = eY.start.y;
			} else {
				v.valueY = NaN;
			}
		});
	}

	addPartner(partner: CadData) {
		let translate: number[];
		for (const p1 of this.jointPoints) {
			for (const p2 of partner.jointPoints) {
				if (p1.name === p2.name) {
					translate = [p1.valueX - p2.valueX, p1.valueY - p2.valueY];
					break;
				}
			}
		}
		if (!translate) {
			const rect1 = this.getAllEntities().getBounds();
			if (rect1.width && rect1.height) {
				const rect2 = partner.getAllEntities().getBounds();
				translate = [rect1.x - rect2.x, rect1.y - rect2.y];
				translate[0] += (rect1.width + rect2.width) / 2 + 15;
			}
		}
		partner.transform({translate});
		const data = this.partners;
		const prev = data.findIndex((v) => v.id === partner.id);
		if (prev > -1) {
			data[prev] = partner;
		} else {
			data.push(partner);
		}
	}

	updatePartners() {
		this.partners.forEach((v) => this.addPartner(v));
		this.partners.forEach((v) => v.updatePartners());
		this.components.data.forEach((v) => v.updatePartners());
	}

	addComponent(component: CadData) {
		const rect1 = this.getAllEntities().getBounds();
		if (rect1.width && rect1.height) {
			const rect2 = component.getAllEntities().getBounds();
			const translate = [rect1.x - rect2.x, rect1.y - rect2.y];
			translate[0] += (rect1.width + rect2.width) / 2 + 15;
			// offset1[1] += (rect1.height - rect2.height) / 2;
			component.transform({translate});
		}
		const data = this.components.data;
		const prev = data.findIndex((v) => v.id === component.id);
		if (prev > -1) {
			data[prev] = component;
		} else {
			data.push(component);
		}
		return this;
	}

	show() {
		this.getAllEntities().forEach((e) => (e.visible = true));
		return this;
	}

	hide() {
		this.getAllEntities().forEach((e) => (e.visible = false));
		return this;
	}
}

export class CadEntities {
	line: CadLine[] = [];
	circle: CadCircle[] = [];
	arc: CadArc[] = [];
	mtext: CadMtext[] = [];
	dimension: CadDimension[] = [];
	hatch: CadHatch[] = [];
	constructor(data: any = {}, layers: CadLayer[] = []) {
		if (typeof data !== "object") {
			throw new Error("Invalid data.");
		}
		if (typeof data.line === "object") {
			for (const id in data.line) {
				this.line.push(new CadLine(data.line[id], layers));
			}
		}
		if (typeof data.circle === "object") {
			for (const id in data.circle) {
				this.circle.push(new CadCircle(data.circle[id], layers));
			}
		}
		if (typeof data.arc === "object") {
			for (const id in data.arc) {
				this.arc.push(new CadArc(data.arc[id], layers));
			}
		}
		if (typeof data.mtext === "object") {
			for (const id in data.mtext) {
				this.mtext.push(new CadMtext(data.mtext[id], layers));
			}
		}
		if (typeof data.dimension === "object") {
			for (const id in data.dimension) {
				this.dimension.push(new CadDimension(data.dimension[id], layers));
			}
		}
		if (typeof data.hatch === "object") {
			for (const id in data.hatch) {
				this.hatch.push(new CadHatch(data.hatch[id], layers));
			}
		}
	}

	merge(entities: CadEntities) {
		Object.keys(cadTypes).forEach((type) => {
			this[type] = this[type].concat(entities[type]);
		});
	}

	find(id: string) {
		for (const type of Object.keys(cadTypes)) {
			const result = (this[type] as CadEntity[]).find((e) => e.id === id);
			if (result) {
				return result;
			}
		}
		return null;
	}

	filter(fn: (value: CadEntity, index: number, array: CadEntity[]) => boolean) {
		const result = new CadEntities();
		for (const type of Object.keys(cadTypes)) {
			result[type] = (this[type] as CadEntity[]).filter(fn);
		}
		return result;
	}

	export() {
		const result = {line: {}, circle: {}, arc: {}, mtext: {}, dimension: {}, hatch: {}};
		Object.keys(cadTypes).forEach((type) => {
			(this[type] as CadEntity[]).forEach((e) => (result[type][e.id] = e.export()));
		});
		return result;
	}

	transform(params: CadTransform) {
		Object.keys(cadTypes).forEach((v) => {
			(this[v] as CadEntity[]).forEach((e) => e.transform(params));
		});
	}

	getBounds() {
		let maxX = -Infinity;
		let minX = Infinity;
		let maxY = -Infinity;
		let minY = Infinity;
		const calc = (point: Vector2 | Vector3) => {
			maxX = Math.max(point.x, maxX);
			maxY = Math.max(point.y, maxY);
			minX = Math.min(point.x, minX);
			minY = Math.min(point.y, minY);
		};
		this.line.forEach((entity) => {
			if (entity.visible) {
				calc(entity.start);
				calc(entity.end);
			}
		});
		this.arc.forEach((entity) => {
			if (entity.visible) {
				const arcEntity = entity;
				const {center, radius, start_angle, end_angle, clockwise} = arcEntity;
				const arc = new ArcCurve(
					center.x,
					center.y,
					radius,
					MathUtils.degToRad(start_angle),
					MathUtils.degToRad(end_angle),
					clockwise
				);
				calc(arc.getPoint(0));
				calc(arc.getPoint(1));
			}
		});
		this.circle.forEach((entity) => {
			if (entity.visible) {
				const {center, radius} = entity;
				calc(center.addScalar(radius));
				calc(center.subScalar(radius));
			}
		});
		if (!isFinite(maxX + minX) || !isFinite(maxY + minY)) {
			return {x: 0, y: 0, width: 0, height: 0};
		}
		return {x: (minX + maxX) / 2, y: (minY + maxY) / 2, width: maxX - minX, height: maxY - minY};
	}

	forEach(callback: (value: CadEntity, index: number, array: CadEntity[]) => void) {
		Object.keys(cadTypes).forEach((type) => {
			(this[type] as CadEntity[]).forEach(callback);
		});
	}
}

export class CadEntity {
	id: string;
	type: string;
	layer: string;
	color: number;
	visible: boolean;
	_indexColor: number;
	constructor(data: any = {}, layers: CadLayer[] = []) {
		if (typeof data !== "object") {
			throw new Error("Invalid data.");
		}
		if (Object.values(cadTypes).includes(data.type)) {
			this.type = data.type;
		} else {
			throw new Error(`Unrecognized cad type: ${data.type}`);
		}
		this.id = typeof data.id === "string" ? data.id : MathUtils.generateUUID();
		this.layer = typeof data.layer === "string" ? data.layer : "0";
		this.color = 0;
		if (data._indexColor && typeof data.color === "number") {
			this._indexColor = data._indexColor;
			this.color = data.color;
		} else {
			this._indexColor = data.color;
			if (typeof data.color === "number") {
				if (data.color === 256) {
					const layer = layers.find((layer) => layer.name === this.layer);
					if (layer) {
						this.color = layer.color;
					}
				} else {
					this.color = index2RGB(data.color, "number");
				}
			}
		}
		this.visible = data.visible === false ? false : true;
	}

	transform({translate, flip, rotate}: CadTransform) {}
	export() {
		return {
			id: this.id,
			layer: this.layer,
			type: this.type,
			color: this._indexColor
		};
	}
}

export class CadLine extends CadEntity {
	start: Vector3;
	end: Vector3;
	mingzi?: string;
	qujian?: string;
	gongshi?: string;
	get length() {
		return this.start.distanceTo(this.end);
	}
	get slope() {
		const {start, end} = this;
		return (start.y - end.y) / (start.x - end.x);
	}
	get theta() {
		const {start, end} = this;
		return Math.atan2(start.y - end.y, start.x - end.x);
	}

	constructor(data: any = {type: cadTypes.line}, layers: CadLayer[] = []) {
		super(data, layers);
		this.start = Array.isArray(data.start) ? new Vector3(...data.start) : new Vector3();
		this.end = Array.isArray(data.end) ? new Vector3(...data.end) : new Vector3();
		this.mingzi = data.mingzi || "";
		this.qujian = data.qujian || "";
		this.gongshi = data.gongshi || "";
	}

	transform({translate, flip, rotate}: CadTransform) {
		const line = new Line(new Point(this.start.x, this.start.y), new Point(this.end.x, this.end.y));
		if (translate) {
			line.start.add(translate[0], translate[1]);
			line.end.add(translate[0], translate[1]);
		}
		if (flip) {
			line.flip(flip.vertical, flip.horizontal, new Point(flip.anchor));
		}
		if (rotate) {
			line.rotate(rotate.angle, new Point(rotate.anchor));
		}
		this.start = new Vector3(line.start.x, line.start.y);
		this.end = new Vector3(line.end.x, line.end.y);
	}

	export() {
		return Object.assign(super.export(), {
			start: this.start.toArray(),
			end: this.end.toArray(),
			mingzi: this.mingzi,
			qujian: this.qujian,
			gongshi: this.gongshi
		});
	}
}

export class CadCircle extends CadEntity {
	center: Vector3;
	radius: number;
	constructor(data: any = {type: cadTypes.circle}, layers: CadLayer[] = []) {
		super(data, layers);
		this.center = Array.isArray(data.center) ? new Vector3(...data.center) : new Vector3();
		this.radius = data.radius || 0;
	}

	transform({translate, flip, rotate}: CadTransform) {
		const center = new Point(this.center.x, this.center.y);
		if (translate) {
			this.center[0] += translate[0];
			this.center[1] += translate[1];
		}
		if (flip) {
			center.flip(flip.vertical, flip.horizontal, new Point(flip.anchor));
		}
		if (rotate) {
			center.rotate(rotate.angle, new Point(rotate.anchor));
		}
		this.center = new Vector3(center.x, center.y);
	}

	export() {
		return Object.assign(super.export(), {
			center: this.center.toArray(),
			radius: this.radius
		});
	}
}

export class CadArc extends CadEntity {
	center: Vector3;
	radius: number;
	start_angle: number;
	end_angle: number;
	clockwise: boolean;
	constructor(data: any = {type: cadTypes.arc}, layers: CadLayer[] = []) {
		super(data, layers);
		this.center = Array.isArray(data.center) ? new Vector3(...data.center) : new Vector3();
		this.radius = data.radius || 0;
		this.start_angle = data.start_angle || 0;
		this.end_angle = data.end_angle || 0;
		this.clockwise = data.clockwise || false;
	}

	transform({translate, flip, rotate}: CadTransform) {
		const start = new Angle(this.start_angle, "deg");
		const end = new Angle(this.end_angle, "deg");
		const center = new Point(this.center.x, this.center.y);
		const arc = new Arc(center, this.radius, start, end, this.clockwise);
		if (translate) {
			arc.center.add(translate[0], translate[1]);
		}
		if (flip) {
			arc.flip(flip.vertical, flip.horizontal, new Point(flip.anchor));
		}
		if (rotate) {
			arc.rotate(rotate.angle, new Point(rotate.anchor));
		}
		this.center = new Vector3(center.x, center.y);
		this.start_angle = arc.startAngle.deg;
		this.end_angle = arc.endAngle.deg;
		this.clockwise = arc.clockwise;
	}

	export() {
		return Object.assign(super.export(), {
			center: this.center.toArray(),
			radius: this.radius,
			start_angle: this.start_angle,
			end_angle: this.end_angle,
			clockwise: this.clockwise
		});
	}
}

export class CadMtext extends CadEntity {
	insert: Vector3;
	font_size: number;
	text: string;
	anchor: Vector3;
	constructor(data: any = {type: cadTypes.mtext}, layers: CadLayer[] = []) {
		super(data, layers);
		this.insert = Array.isArray(data.insert) ? new Vector3(...data.insert) : new Vector3();
		this.font_size = data.font_size || 16;
		this.text = data.text || "";
		this.anchor = Array.isArray(data.anchor) ? new Vector3(...data.anchor) : new Vector3();
	}

	export() {
		return Object.assign(super.export(), {
			insert: this.insert.toArray(),
			font_size: this.font_size,
			text: this.text,
			anchor: this.anchor.toArray()
		});
	}
}

export class CadDimension extends CadEntity {
	font_size: number;
	dimstyle: string;
	axis: "x" | "y";
	entity1?: {
		id: string;
		location: "start" | "end" | "center";
	};
	entity2?: {
		id: string;
		location: "start" | "end" | "center";
	};
	distance: number;
	cad1?: string;
	cad2?: string;
	mingzi?: string;
	qujian?: string;
	constructor(data: any = {type: cadTypes.dimension}, layers: CadLayer[] = []) {
		super(data, layers);
		this.font_size = data.font_size || 16;
		this.dimstyle = data.dimstyle || "";
		["entity1", "entity2"].forEach((field) => {
			if (data[field]) {
				this[field] = {id: "", location: "center"};
				if (typeof data[field].id === "string") {
					this[field].id = data[field].id;
				}
				if (["start", "end", "center"].includes(data[field].location)) {
					this[field].location = data[field].location;
				}
			} else {
				this[field] = null;
			}
		});
		this.axis = data.axis || "x";
		this.distance = data.distance || 16;
		this.cad1 = data.cad1 || "";
		this.cad2 = data.cad2 || "";
		this.mingzi = data.mingzi || "";
		this.qujian = data.qujian || "";
	}

	export() {
		return Object.assign(super.export(), {
			dimstyle: this.dimstyle,
			font_size: this.font_size,
			axis: this.axis,
			entity1: {...this.entity1},
			entity2: {...this.entity2},
			distance: this.distance,
			cad1: this.cad1,
			cad2: this.cad2,
			mingzi: this.mingzi,
			qujian: this.qujian
		});
	}
}

export class CadHatch extends CadEntity {
	paths: {
		edges: {
			start: Vector3;
			end: Vector3;
		}[];
		vertices: Vector3[];
	}[];
	constructor(data: any = {type: cadTypes.hatch}, layers: CadLayer[] = []) {
		super(data, layers);
		this.paths = [];
		if (Array.isArray(data.paths)) {
			data.paths.forEach((path) => {
				const edges: CadHatch["paths"][0]["edges"] = [];
				const vertices: CadHatch["paths"][0]["vertices"] = [];
				if (Array.isArray(path.edges)) {
					path.edges.forEach((edge) => {
						const start = Array.isArray(edge.start) ? new Vector3(...edge.start) : new Vector3();
						const end = Array.isArray(edge.end) ? new Vector3(...edge.end) : new Vector3();
						edges.push({start, end});
					});
				}
				if (Array.isArray(path.vertices)) {
					path.vertices.forEach((vertice) => {
						vertices.push(new Vector3(...vertice));
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
		return Object.assign(super.export(), {paths});
	}
}

export class CadLayer {
	id: string;
	color: number;
	name: string;
	_indexColor: number;
	constructor(data: any = {}) {
		this.color = index2RGB(data.color, "number") || 0;
		this.name = data.name || "";
		this.id = data.id || MathUtils.generateUUID();
		this.color = 0;
		if (data._indexColor && typeof data.color === "number") {
			this._indexColor = data._indexColor;
			this.color = data.color;
		} else {
			this._indexColor = data.color;
			this.color = index2RGB(data.color, "number");
		}
	}

	export() {
		return {id: this.id, color: this._indexColor, name: this.name};
	}
}

export class CadBaseLine {
	name: string;
	idX: string;
	idY: string;
	valueX: number;
	valueY: number;
	constructor(data: any = {}) {
		this.name = data.name || "";
		this.idX = data.idX || "";
		this.idY = data.idY || "";
		this.valueX = data.valueX || NaN;
		this.valueY = data.valueY || NaN;
	}
}

export class CadJointPoint {
	name: string;
	valueX: number;
	valueY: number;
	constructor(data: any = {}) {
		this.name = data.name || "";
		this.valueX = data.valueX || NaN;
		this.valueY = data.valueY || NaN;
	}
}

export class CadOption {
	name: string;
	value: string;
	constructor(name = "", value = "") {
		this.name = name;
		this.value = value;
	}
}

export interface Connection {
	names: string[];
	lines: string[];
	space: string;
	position: "absolute" | "relative";
	axis?: "x" | "y";
	offset?: {
		x?: number;
		y?: number;
	};
}
export class Components {
	data: CadData[];
	connections: Connection[];
	constructor(data: any = {}) {
		if (typeof data !== "object") {
			throw new Error("Invalid data.");
		}
		this.data = [];
		if (Array.isArray(data.data)) {
			data.data.forEach((d) => {
				this.data.push(new CadData(d));
			});
		}
		this.connections = data.connections || [];
	}

	export() {
		const result = {data: [], connections: this.connections};
		this.data.forEach((v) => result.data.push(v.export()));
		return result;
	}
}
