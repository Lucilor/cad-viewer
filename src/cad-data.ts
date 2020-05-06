import {MathUtils, Vector2, ArcCurve, Vector3, Box3} from "three";
import {index2RGB, Line, Point, Angle, Arc} from "@lucilor/utils";
import _ from "lodash";

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
	components: CadComponents;
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
		if (Array.isArray(data.partners)) {
			(data.partners as []).forEach((v) => this.partners.push(new CadData(v)));
		}
		this.components = new CadComponents(data.components || {});
		this.updatePartners();
		this.updateComponents();
		this.visible = data.visible === false ? false : true;
	}

	export() {
		this.updateBaseLines();
		const exLayers = {};
		this.layers.forEach((v) => {
			exLayers[v.id] = v.export();
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
			baseLines: this.baseLines.map((v) => v.export()).filter((v) => v.idX && v.idY),
			jointPoints: this.jointPoints.map((v) => v.export()),
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
		const partners = this.partners.slice();
		this.partners.length = 0;
		partners.forEach((v) => this.addPartner(v));
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

	updateComponents() {
		const data = this.components.data.slice();
		const connections = this.components.connections.slice();
		this.components.data.length = 0;
		this.components.connections.length = 0;
		data.forEach((v) => this.addComponent(v));
		this.partners.forEach((v) => v.updateComponents());
		this.components.data.forEach((v) => v.updateComponents());
	}

	assembleComponents(connection: CadConnection) {
		const {names, lines, space, position, offset} = connection;
		const components = this.components;
		let c1: CadData;
		let c2: CadData;
		for (const c of components.data) {
			if (c.name === names[0]) {
				c1 = c;
			}
			if (c.name === names[1]) {
				c2 = c;
			}
			if (c1 && c2) {
				break;
			}
		}
		if (!c1 || !c2) {
			throw new Error("未找到配件");
		}
		let axis: "x" | "y";
		const getLine = (e: CadCircle, l: Line) => {
			if (!(e instanceof CadCircle)) {
				throw new Error("不支持的实体");
			}
			const o = new Point(e.center.toArray());
			if (!isFinite(l.slope)) {
				return new Line(o, o.clone().add(new Point(0, 1)));
			}
			if (l.slope === 0) {
				return new Line(o, o.clone().add(new Point(1, 0)));
			}
		};
		const translate = [0, 0];
		// if (typeof offset === "object") {
		// 	["x", "y"].forEach(a => {
		// 		if (typeof offset[a] === "number") {
		// 			translate[a] += offset[a];
		// 		}
		// 	});
		// }
		if (position === "absolute") {
			const e1 = c1.findEntity(lines[0]);
			const e2 = c2.findEntity(lines[1]);
			if (!e1 || !e2) {
				throw new Error("未找到对应实体");
			}
			let spaceNum = Number(space);
			if (isNaN(spaceNum)) {
				spaceNum = 20;
			}
			let l1: Line;
			let l2: Line;
			if (e1 instanceof CadLine) {
				const start = new Point(e1.start.toArray());
				const end = new Point(e1.end.toArray());
				l1 = new Line(start, end);
			}
			if (e2 instanceof CadLine) {
				const start = new Point(e2.start.toArray());
				const end = new Point(e2.end.toArray());
				l2 = new Line(start, end);
			}
			if (!l1 && !l2) {
				throw new Error("至少需要一条直线");
			}
			if (!l1) {
				l1 = getLine(e1 as CadCircle, l2);
			}
			if (!l2) {
				l2 = getLine(e2 as CadCircle, l1);
			}
			if (l1.slope === l2.slope) {
				if (!isFinite(l1.slope)) {
					translate[0] = l1.start.x - l2.start.x + spaceNum;
					axis = "x";
				} else if (l1.slope === 0) {
					translate[1] = l1.start.y - l2.start.y + spaceNum;
					axis = "y";
				} else {
					throw new Error("两条线不是横线或者竖线");
				}
			} else {
				throw new Error("两条线不平行");
			}
			this.moveComponent(c2, translate, c1);
		} else if (position === "relative") {
			const match = space.match(/([0-9]*)(\+|-)?([0-9]*)/);
			if (!match) {
				throw new Error("相对定位的距离格式错误");
			}
			const spParent = Number(match[1]) / 100;
			const op = match[2];
			const spChildren = Number(match[3]) / 100;
			if (["+", "-"].includes(op) && isNaN(spChildren)) {
				throw new Error("相对定位的距离格式错误");
			}
			if (isNaN(spParent)) {
				throw new Error("相对定位的距离格式错误");
			}
			const e1 = this.findEntity(lines[0]);
			const e2 = this.findEntity(lines[1]);
			const e3 = this.findEntity(lines[2]);
			if (!e1 || !e2 || !e3) {
				throw new Error("未找到对应实体");
			}
			if (!(e1 instanceof CadLine) || !(e2 instanceof CadLine)) {
				throw new Error("必须先选两条直线");
			}
			const l1: Line = new Line(new Point(e1.start.toArray()), new Point(e1.end.toArray()));
			const l2: Line = new Line(new Point(e2.start.toArray()), new Point(e2.end.toArray()));
			let l3: Line;
			if (e3 instanceof CadLine) {
				const start = new Point(e3.start.toArray());
				const end = new Point(e3.end.toArray());
				l3 = new Line(start, end);
			}
			if (e3.type === CadTypes.Circle) {
				l3 = getLine(e3 as CadCircle, l1);
			}
			if (!(l1.slope === l2.slope && l2.slope === l3.slope)) {
				throw new Error("三条线必须相互平行");
			}
			const rect = c2.entities.getBounds();
			if (!isFinite(l1.slope)) {
				const d = (l2.start.x - l1.start.x) * spParent;
				translate[0] = l1.start.x + d - l3.start.x;
				if (op === "+") {
					translate[0] += rect.width * spChildren;
				}
				if (op === "-") {
					translate[0] -= rect.width * spChildren;
				}
				axis = "x";
			} else if (l1.slope === 0) {
				const d = (l2.start.y - l1.start.y) * spParent;
				translate[1] = l1.start.y + d - l3.start.y;
				if (op === "+") {
					translate[1] += rect.height * spChildren;
				}
				if (op === "-") {
					translate[1] -= rect.height * spChildren;
				}
				axis = "y";
			} else {
				throw new Error("三条线不是横线或者竖线");
			}
			this.moveComponent(c2, translate, c1);
		}

		const toRemove = [];
		const connectedToC1: string[] = [];
		const connectedToC2: string[] = [];
		components.connections.forEach((conn) => {
			if (conn.names[0] === c1.name) {
				connectedToC1.push(conn.names[1]);
			}
			if (conn.names[1] === c1.name) {
				connectedToC1.push(conn.names[0]);
			}
			if (conn.names[0] === c2.name) {
				connectedToC2.push(conn.names[1]);
			}
			if (conn.names[1] === c2.name) {
				connectedToC2.push(conn.names[0]);
			}
		});
		const connectedToBoth = _.intersection(connectedToC1, connectedToC2);
		components.connections.forEach((conn, i) => {
			const arr = _.intersection(conn.names, [c1.name, c2.name]);
			if (conn.names.includes(c2.name) && _.intersection(conn.names, connectedToBoth).length) {
				toRemove.push(i);
			}
			if (arr.length === 2 && conn.axis === axis) {
				toRemove.push(i);
			}
		});
		components.connections = components.connections.filter((v, i) => !toRemove.includes(i));
		connection.axis = axis;
		connection.space = connection.space ? connection.space : "0";
		components.connections.push(_.cloneDeep(connection));

		this.sortComponents();
		return this;
	}

	sortComponents() {
		this.components.data.sort((a, b) => {
			const rect1 = a.getAllEntities().getBounds();
			const rect2 = b.getAllEntities().getBounds();
			return rect1.x - rect2.x;
		});
	}

	moveComponent(curr: CadData, translate: number[], prev?: CadData) {
		curr.transform({translate});
		const map: object = {};
		this.components.connections.forEach((conn) => {
			if (conn.names.includes(curr.name)) {
				conn.names.forEach((n) => {
					if (n !== curr.name && n !== prev?.name) {
						if (!map[n]) {
							map[n] = {};
						}
						map[n][conn.axis] = conn.space;
						if (typeof conn.offset !== "object") {
							conn.offset = {};
						}
						if (conn.axis === "x") {
							if (typeof conn.offset.y === "number") {
								conn.offset.y += translate[1];
							} else {
								conn.offset.y = translate[1];
							}
						}
						if (conn.axis === "y") {
							if (typeof conn.offset.x === "number") {
								conn.offset.x += translate[0];
							} else {
								conn.offset.x = translate[0];
							}
						}
					}
				});
			}
		});
		for (const name in map) {
			const next = this.components.data.find((v) => v.name === name);
			if (next) {
				const newTranslate = translate.slice();
				if (map[name].x === undefined) {
					newTranslate[0] = 0;
				}
				if (map[name].y === undefined) {
					newTranslate[1] = 0;
				}
				this.moveComponent(next, newTranslate, curr);
			}
		}
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
		const box = new Box3();
		this.line.forEach((entity) => {
			if (entity.visible) {
				box.expandByPoint(entity.start);
				box.expandByPoint(entity.end);
			}
		});
		this.arc.forEach((entity) => {
			if (entity.visible) {
				const {center, radius, start_angle, end_angle, clockwise} = entity;
				const arc = new ArcCurve(
					center.x,
					center.y,
					radius,
					MathUtils.degToRad(start_angle),
					MathUtils.degToRad(end_angle),
					clockwise
				);
				const start = arc.getPoint(0);
				const end = arc.getPoint(1);
				box.expandByPoint(new Vector3(start.x, start.y));
				box.expandByPoint(new Vector3(end.x, end.y));
			}
		});
		this.circle.forEach((entity) => {
			if (entity.visible) {
				const {center, radius} = entity;
				box.expandByPoint(center.addScalar(radius));
				box.expandByPoint(center.subScalar(radius));
			}
		});
		const center = new Vector3();
		const size = new Vector3();
		box.getCenter(center);
		box.getSize(size);
		return {x: center.x, y: center.y, width: size.x, height: size.y};
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
	entity1: {
		id: string;
		location: "start" | "end" | "center";
	};
	entity2: {
		id: string;
		location: "start" | "end" | "center";
	};
	distance: number;
	cad1: string;
	cad2: string;
	mingzi: string;
	qujian: string;
	constructor(data: any = {type: cadTypes.dimension}, layers: CadLayer[] = []) {
		super(data, layers);
		this.font_size = data.font_size || 16;
		this.dimstyle = data.dimstyle || "";
		["entity1", "entity2"].forEach((field) => {
			this[field] = {id: "", location: "center"};
			if (data[field]) {
				if (typeof data[field].id === "string") {
					this[field].id = data[field].id;
				}
				if (["start", "end", "center"].includes(data[field].location)) {
					this[field].location = data[field].location;
				}
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

	export() {
		return {name: this.name, idX: this.idX, idY: this.idY, valueX: this.valueX, valueY: this.valueY};
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

	export() {
		return {name: this.name, valueX: this.valueX, valueY: this.valueY};
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

export interface CadConnection {
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
export class CadComponents {
	data: CadData[];
	connections: CadConnection[];
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
