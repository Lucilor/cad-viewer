import {MathUtils, Vector2, Box2} from "three";
import {intersection, cloneDeep, uniqWith} from "lodash";
import {CadEntities} from "./cad-entities";
import {CadLayer} from "./cad-layer";
import {CadTransformation} from "./cad-transformation";
import {CadLine} from "./cad-entity/cad-line";
import {getVectorFromArray, isLinesParallel, mergeArray, separateArray, ExpressionsParser, Expressions} from "./utils";
import {CadCircle} from "./cad-entity/cad-circle";
import {CadDimension, CadDimensionEntity} from "./cad-entity/cad-dimension";
import {CadArc} from "./cad-entity/cad-arc";

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
	zhankaikuan: string;
	zhankaigao: string;
	shuliang: string;
	shuliangbeishu: string;
	huajian: string;
	needZhankai: boolean;
	mubanfangda: boolean;
	kailiaomuban: string;
	kailiaoshibaokeng: boolean;
	bianxingfangshi: "自由" | "高比例变形" | "宽比例变形" | "宽高比例变形";
	bancaiwenlifangxiang: "垂直" | "水平";
	kailiaopaibanfangshi: "自动排版" | "不排版" | "必须排版";
	readonly visible: boolean;
	constructor(data: any = {}) {
		if (typeof data !== "object") {
			throw new Error("Invalid data.");
		}
		this.id = data.id || MathUtils.generateUUID();
		this.name = data.name ?? "";
		this.type = data.type ?? "";
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
			if (Array.isArray(data.options)) {
				data.options.forEach((v: CadOption) => this.options.push(new CadOption(v)));
			} else {
				for (const key in data.options) {
					this.options.push(new CadOption(key, data.options[key]));
				}
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
		this.parent = data.parent ?? "";
		this.partners = [];
		this.components = new CadComponents();
		if (Array.isArray(data.partners)) {
			(data.partners as []).forEach((v) => this.partners.push(new CadData(v)));
		}
		this.updatePartners();
		this.components = new CadComponents(data.components ?? {});
		this.updateComponents();
		this.visible = data.visible === false ? false : true;
		this.zhankaikuan = data.zhankaikuan ?? "ceil(总长)+0";
		this.zhankaigao = data.zhankaigao ?? "";
		this.shuliang = data.shuliang ?? "1";
		this.shuliangbeishu = data.shuliangbeishu ?? "1";
		this.huajian = data.huajian ?? "";
		this.needZhankai = data.needZhankai ?? true;
		this.mubanfangda = data.mubanfangda ?? true;
		this.kailiaomuban = data.kailiaomuban ?? "";
		this.kailiaoshibaokeng = data.kailiaoshibaokeng ?? false;
		this.bianxingfangshi = data.bianxingfangshi ?? "自由";
		this.bancaiwenlifangxiang = data.bancaiwenlifangxiang ?? "垂直";
		this.kailiaopaibanfangshi = data.kailiaopaibanfangshi ?? "自动排版";
		this.updateDimensions();
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
		return {
			layers: exLayers,
			entities: this.entities.export(),
			id: this.id,
			name: this.name,
			type: this.type,
			conditions: this.conditions.filter((v) => v),
			options: exOptions,
			baseLines: this.baseLines.map((v) => v.export()).filter((v) => v.name && v.idX && v.idY),
			jointPoints: this.jointPoints.map((v) => v.export()),
			parent: this.parent,
			partners: this.partners.map((v) => v.export()),
			components: this.components.export(),
			zhankaikuan: this.zhankaikuan,
			zhankaigao: this.zhankaigao,
			shuliang: this.shuliang,
			shuliangbeishu: this.shuliangbeishu,
			huajian: this.huajian,
			needZhankai: this.needZhankai,
			mubanfangda: this.mubanfangda,
			kailiaomuban: this.kailiaomuban,
			kailiaoshibaokeng: this.kailiaoshibaokeng,
			bianxingfangshi: this.bianxingfangshi,
			bancaiwenlifangxiang: this.bancaiwenlifangxiang,
			kailiaopaibanfangshi: this.kailiaopaibanfangshi
		};
	}

	extractExpressions() {
		const exps: Expressions = {};
		this.getAllEntities().line.forEach((e) => {
			if (e.mingzi && e.gongshi) {
				exps[e.mingzi] = e.gongshi;
			}
		});
		return new ExpressionsParser(exps);
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

	findChildren(ids: string[]) {
		const result: CadData[] = [];
		ids.forEach((id) => {
			const child = this.findChild(id);
			if (child) {
				result.push(child);
			}
		});
		return result;
	}

	findChild(id: string): CadData {
		const children = [...this.partners, ...this.components.data];
		for (const data of children) {
			if (data.id === id) {
				return data;
			} else {
				const result = data.findChild(id);
				if (result) {
					return result;
				}
			}
		}
		return null;
	}

	clone(resetIds = false) {
		const data = new CadData(this);
		if (resetIds) {
			this.layers = this.layers.map((v) => {
				const nv = new CadLayer(v.export());
				nv.id = MathUtils.generateUUID();
				return nv;
			});
			data.entities = data.entities.clone(true);
			data.partners = data.partners.map((v) => v.clone(true));
			data.components.data = data.components.data.map((v) => v.clone(true));
		}
		return data;
	}

	copy(data: CadData) {
		this.separate(this).merge(data.clone());
	}

	merge(data: CadData) {
		this.layers = this.layers.concat(data.layers);
		this.entities.merge(data.entities);
		this.conditions = mergeArray(this.conditions, data.conditions);
		this.options = mergeArray(this.options, data.options, "name");
		this.jointPoints = mergeArray(this.jointPoints, data.jointPoints, "name");
		this.baseLines = mergeArray(this.baseLines, data.baseLines, "name");
		this.partners = mergeArray(this.partners, data.partners, "id");
		this.components.connections = mergeArray(this.components.connections, data.components.connections);
		this.components.data = mergeArray(this.components.data, data.components.data, "id");
		return this;
	}

	separate(data: CadData) {
		const layerIds = data.layers.map((v) => v.id);
		this.layers = this.layers.filter((v) => !layerIds.includes(v.id));
		this.entities.separate(data.entities);
		this.conditions = separateArray(this.conditions, data.conditions);
		this.options = separateArray(this.options, data.options, "name");
		this.jointPoints = separateArray(this.jointPoints, data.jointPoints, "name");
		this.baseLines = separateArray(this.baseLines, data.baseLines, "name");
		this.partners = separateArray(this.partners, data.partners, "id");
		this.components.connections = separateArray(this.components.connections, data.components.connections);
		this.components.data = separateArray(this.components.data, data.components.data, "id");
		this.partners.forEach((v) => v.separate(data));
		this.components.data.forEach((v) => v.separate(data));
		return this;
	}

	transform(trans: CadTransformation) {
		this.entities.transform(trans);
		this.partners.forEach((v) => v.transform(trans));
		this.components.transform(trans);
		const matrix = trans.matrix;
		this.baseLines.forEach((v) => {
			const point = new Vector2(v.valueX, v.valueY);
			point.applyMatrix3(matrix);
			v.valueX = point.x;
			v.valueY = point.y;
		});
		this.jointPoints.forEach((v) => {
			const point = new Vector2(v.valueX, v.valueY);
			point.applyMatrix3(matrix);
			v.valueX = point.x;
			v.valueY = point.y;
		});
		this.entities.dimension.forEach((e) => {
			if (trans.flip.vertical && e.axis === "x") {
				const [p1, p2] = this.getDimensionPoints(e);
				if (p1 && p2) {
					e.distance = -Math.abs(p1.y - p2.y) - e.distance;
				}
			}
			if (trans.flip.horizontal && e.axis === "y") {
				const [p1, p2] = this.getDimensionPoints(e);
				if (p1 && p2) {
					e.distance = -Math.abs(p1.x - p2.x) - e.distance;
				}
			}
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
		let translate: Vector2;
		for (const p1 of this.jointPoints) {
			for (const p2 of partner.jointPoints) {
				if (p1.name === p2.name) {
					translate = getVectorFromArray([p1.valueX - p2.valueX, p1.valueY - p2.valueY]);
					break;
				}
			}
		}
		if (!translate) {
			const rect1 = this.getBounds();
			if (rect1.width && rect1.height) {
				const rect2 = partner.getBounds();
				translate = getVectorFromArray([rect1.x - rect2.x, rect1.y - rect2.y]);
				translate.x += (rect1.width + rect2.width) / 2 + 15;
			} else {
				translate = new Vector2();
			}
		}
		partner.transform(new CadTransformation({translate}));
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
		return this;
	}

	addComponent(component: CadData) {
		const rect1 = this.getBounds();
		if (rect1.width && rect1.height) {
			const rect2 = component.getBounds();
			const translate = new Vector2(rect1.x - rect2.x, rect1.y - rect2.y);
			if (Math.abs(translate.x) > 1500 || Math.abs(translate.y) > 1500) {
				translate.x += (rect1.width + rect2.width) / 2 + 15;
				// offset1[1] += (rect1.height - rect2.height) / 2;
				component.transform(new CadTransformation({translate}));
			}
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
		connections.forEach((c) => {
			try {
				this.assembleComponents(c);
			} catch (error) {
				// TODO: warn error
				// console.warn(error);
			}
		});
		this.partners.forEach((v) => v.updateComponents());
		this.components.data.forEach((v) => v.updateComponents());
		return this;
	}

	updateDimensions(parentDimensions?: CadDimension[]) {
		if (Array.isArray(parentDimensions)) {
			this.entities.dimension = this.entities.dimension.filter((v) => {
				return parentDimensions.every((vv) => !v.equals(vv));
			});
		}
		this.entities.dimension = uniqWith(this.entities.dimension, (a, b) => a.equals(b));
		const tmp = this.entities.dimension;
		this.entities.dimension = [];
		const rect = this.getBounds();
		this.entities.dimension.forEach((e) => {
			if (e.mingzi === "宽度标注") {
				e.distance2 = rect.y + rect.height / 2 + 40;
			}
		});
		this.entities.dimension = tmp;
		this.partners.forEach((v) => v.updateDimensions(this.entities.dimension));
		this.components.data.forEach((v) => v.updateDimensions(this.entities.dimension));
		return this;
	}

	// It is likely to throw an error.
	// TODO: avoid it.
	assembleComponents(connection: CadConnection, accuracy = 1) {
		const {ids, lines, space, position} = connection;
		const components = this.components;
		let c1: CadData;
		let c2: CadData;
		for (const c of components.data) {
			if (c.id === ids[0] || c.id === ids[0]) {
				c1 = c;
			}
			if (c.id === ids[1] || c.id === ids[1]) {
				c2 = c;
			}
			if (c1 && c2) {
				break;
			}
		}
		if (!c1 && !c2) {
			throw new Error("未找到配件");
		}
		if (!c1) {
			c1 = new CadData();
			c1.entities = this.entities;
		}
		if (!c2) {
			c2 = c1;
			c1 = new CadData();
			c1.entities = this.entities;
			lines.unshift(lines.pop());
			ids.unshift(ids.pop());
		}
		let axis: "x" | "y";
		const getLine = (e: CadCircle, l: CadLine) => {
			const result = new CadLine();
			result.start = e.center.clone();
			result.end = e.center.clone();
			if (l.isVertical(accuracy)) {
				result.end.y += 1;
			} else {
				result.end.x += 1;
			}
			return result;
		};
		const translate = new Vector2();
		if (position === "absolute") {
			const e1 = c1.findEntity(lines[0]);
			const e2 = c2.findEntity(lines[1]);
			if (!e1 || !e2) {
				throw new Error("未找到对应实体");
			}
			const spaceNum = Number(space);
			let l1: CadLine;
			let l2: CadLine;
			if (e1 instanceof CadLine) {
				l1 = e1;
			}
			if (e2 instanceof CadLine) {
				l2 = e2;
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
			if (isLinesParallel([l1, l2], accuracy)) {
				if (l1.isVertical(accuracy)) {
					translate.x = l1.start.x - l2.start.x + spaceNum;
					axis = "x";
				} else if (l1.isHorizonal(accuracy)) {
					translate.y = l1.start.y - l2.start.y + spaceNum;
					axis = "y";
				} else {
					throw new Error("两条线不是横线或者竖线");
				}
			} else {
				throw new Error("两条线不平行");
			}
			if (isNaN(spaceNum)) {
				translate.set(0, 0);
			}
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
			const l1 = e1;
			const l2 = e1;
			let l3: CadLine;
			if (e3 instanceof CadLine) {
				l3 = e3;
			}
			if (e3 instanceof CadCircle) {
				l3 = getLine(e3, l1);
			}
			if (!isLinesParallel([l1, l2, l3], accuracy)) {
				throw new Error("三条线必须相互平行");
			}
			const tmpData = new CadData();
			tmpData.entities = c2.entities;
			const rect = tmpData.getBounds();
			if (!isFinite(l1.slope)) {
				const d = (l2.start.x - l1.start.x) * spParent;
				translate.x = l1.start.x + d - l3.start.x;
				if (op === "+") {
					translate.x += rect.width * spChildren;
				}
				if (op === "-") {
					translate.x -= rect.width * spChildren;
				}
				axis = "x";
			} else if (l1.slope === 0) {
				const d = (l2.start.y - l1.start.y) * spParent;
				translate.y = l1.start.y + d - l3.start.y;
				if (op === "+") {
					translate.y += rect.height * spChildren;
				}
				if (op === "-") {
					translate.y -= rect.height * spChildren;
				}
				axis = "y";
			} else {
				throw new Error("三条线不是横线或者竖线");
			}
		}

		const toRemove = [];
		const connectedToC1: string[] = [];
		const connectedToC2: string[] = [];
		components.connections.forEach((conn) => {
			if (conn.ids[0] === c1.id) {
				connectedToC1.push(conn.ids[1]);
			}
			if (conn.ids[1] === c1.id) {
				connectedToC1.push(conn.ids[0]);
			}
			if (conn.ids[0] === c2.id) {
				connectedToC2.push(conn.ids[1]);
			}
			if (conn.ids[1] === c2.id) {
				connectedToC2.push(conn.ids[0]);
			}
		});
		connection.axis = axis;
		connection.space = connection.space ? connection.space : "0";
		const connectedToBoth = intersection(connectedToC1, connectedToC2);
		components.connections.forEach((conn, i) => {
			const arr = intersection(conn.ids, [c1.id, c2.id, this.id]);
			if (conn.ids.includes(c2.id) && intersection(conn.ids, connectedToBoth).length) {
				toRemove.push(i);
			}
			if (arr.length === 2 && conn.axis === axis) {
				toRemove.push(i);
			}
		});
		components.connections = components.connections.filter((v, i) => !toRemove.includes(i));
		this.moveComponent(c2, translate, c1);
		components.connections.push(cloneDeep(connection));

		return this;
	}

	sortComponents() {
		this.components.data.sort((a, b) => {
			const rect1 = a.getBounds();
			const rect2 = b.getBounds();
			return rect1.x - rect2.x + rect2.y - rect1.y;
		});
	}

	moveComponent(curr: CadData, translate: Vector2, prev?: CadData) {
		const map: object = {};
		this.components.connections.forEach((conn) => {
			if (conn.ids.includes(curr.id)) {
				conn.ids.forEach((id) => {
					if (id === this.id) {
						if (conn.axis === "x") {
							translate.x = 0;
						}
						if (conn.axis === "y") {
							translate.y = 0;
						}
					}
					if (id !== curr.id && id !== prev?.id) {
						if (!map[id]) {
							map[id] = {};
						}
						map[id][conn.axis] = conn.space;
					}
				});
			}
		});
		curr.transform(new CadTransformation({translate}));
		for (const id in map) {
			const next = this.components.data.find((v) => v.id === id);
			if (next) {
				const newTranslate = translate.clone();
				if (map[id].x === undefined) {
					newTranslate.x = 0;
				}
				if (map[id].y === undefined) {
					newTranslate.y = 0;
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

	directAssemble(component: CadData, accuracy = 1) {
		const findLines = (entities: CadEntities): {[key: string]: CadLine} => {
			let hLine: CadLine;
			let vLine: CadLine;
			for (const l of entities.line) {
				if (l.length <= accuracy) {
					continue;
				}
				if (l.isHorizonal(accuracy) && (!hLine || hLine.start.y > l.start.y)) {
					hLine = l;
				} else if (l.isVertical(accuracy) && (!vLine || vLine.start.x > l.start.x)) {
					vLine = l;
				}
			}
			if (!hLine || !vLine) {
				throw new Error("缺少水平或垂直的线");
			}
			return {x: vLine, y: hLine};
		};

		const lines = findLines(this.entities);
		if (!lines) {
			return;
		}
		const cLines = findLines(component.getAllEntities());
		if (!cLines) {
			return;
		}
		["x", "y"].forEach((axis) => {
			const conn = new CadConnection({axis, position: "absolute"});
			conn.ids = [this.id, component.id];
			conn.names = [this.name, component.name];
			conn.lines = [lines[axis].originalId, cLines[axis].originalId];
			if (axis === "x") {
				conn.space = (cLines[axis].start.x - lines[axis].start.x).toString();
			}
			if (axis === "y") {
				conn.space = (cLines[axis].start.y - lines[axis].start.y).toString();
			}
			this.assembleComponents(conn, accuracy);
		});
	}

	getDimensionPoints({entity1, entity2, distance, axis, distance2}: CadDimension) {
		const getPoint = ({id, location}: CadDimensionEntity) => {
			const e = this.findEntity(id);
			if (e instanceof CadLine) {
				const {start, end, middle} = e.clone();
				if (location === "start") {
					return start;
				} else if (location === "end") {
					return end;
				} else if (location === "center") {
					return middle;
				} else if (location === "min") {
					if (axis === "x") {
						return start.y < end.y ? start : end;
					} else if (axis === "y") {
						return start.x < end.x ? start : end;
					}
				} else if (location === "max") {
					if (axis === "x") {
						return start.y > end.y ? start : end;
					} else if (axis === "y") {
						return start.x > end.x ? start : end;
					}
				}
			}
			return null;
		};
		let p1 = getPoint(entity1);
		let p2 = getPoint(entity2);
		if (!p1 || !p2) {
			return [];
		}
		let p3 = p1.clone();
		let p4 = p2.clone();
		if (axis === "x") {
			const y = Math.max(p3.y, p4.y);
			p3.y = y + distance;
			p4.y = y + distance;
			if (p3.x > p4.x) {
				[p3, p4] = [p4, p3];
				[p1, p2] = [p2, p1];
			}
		}
		if (axis === "y") {
			const x = Math.max(p3.x, p4.x);
			p3.x = x + distance;
			p4.x = x + distance;
			if (p3.y < p4.y) {
				[p3, p4] = [p4, p3];
				[p1, p2] = [p2, p1];
			}
		}
		if (distance2 !== undefined) {
			[p3, p4].forEach((p) => (p.y = distance2));
		}
		return [p1, p2, p3, p4];
	}

	getBoundingBox() {
		const box = new Box2();
		const entities = this.getAllEntities();
		entities.forEach((e) => {
			if (!e.visible) {
				return;
			}
			if (e instanceof CadLine) {
				box.expandByPoint(e.start);
				box.expandByPoint(e.end);
			}
			if (e instanceof CadCircle) {
				const curve = e.curve;
				if (e instanceof CadArc) {
					box.expandByPoint(curve.getPoint(0));
					box.expandByPoint(curve.getPoint(0.5));
					box.expandByPoint(curve.getPoint(1));
				} else {
					const {center, radius} = e;
					box.expandByPoint(center.clone().addScalar(radius));
					box.expandByPoint(center.clone().subScalar(radius));
				}
			}
			if (e instanceof CadDimension) {
				this.getDimensionPoints(e).forEach((p) => box.expandByPoint(p));
			}
		});
		return box;
	}

	getBounds() {
		const box = this.getBoundingBox();
		const center = new Vector2();
		const size = new Vector2();
		box.getCenter(center);
		box.getSize(size);
		return {x: center.x, y: center.y, width: size.x, height: size.y};
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
	constructor(name: string | CadOption = "", value = "") {
		if (name instanceof CadOption) {
			this.name = name.name;
			this.value = name.value;
		} else {
			this.name = name;
			this.value = value;
		}
	}
}

export class CadConnection {
	ids: string[];
	names: string[];
	lines: string[];
	space: string;
	position: "absolute" | "relative";
	axis: "x" | "y";

	constructor(data: any = {}) {
		this.ids = Array.isArray(data.ids) ? data.ids : [];
		this.names = Array.isArray(data.names) ? data.names : [];
		this.lines = Array.isArray(data.lines) ? data.lines : [];
		this.space = data.space || "0";
		this.position = data.position || "absolute";
		this.axis = data.axis || "x";
	}

	export() {
		return {
			ids: this.ids,
			names: this.names,
			lines: this.lines,
			space: this.space,
			position: this.position,
			axis: this.axis
		};
	}
}
export class CadComponents {
	data: CadData[];
	connections: CadConnection[];
	constructor(data: any = {}) {
		if (typeof data !== "object") {
			throw new Error("Invalid data.");
		}
		this.data = [];
		this.connections = [];
		if (Array.isArray(data.data)) {
			data.data.forEach((d) => this.data.push(new CadData(d)));
		}
		if (Array.isArray(data.connections)) {
			data.connections.forEach((c) => this.connections.push(new CadConnection(c)));
		}
	}

	transform(trans: CadTransformation) {
		const {vertical, horizontal} = trans.flip;
		this.connections.forEach((v) => {
			if ((vertical && v.axis === "y") || (horizontal && v.axis === "x")) {
				const space = -Number(v.space);
				if (!isNaN(space)) {
					v.space = space.toString();
				}
			}
		});
		this.data.forEach((v) => v.transform(trans));
	}

	export() {
		const result = {data: [], connections: []};
		this.data.forEach((v) => result.data.push(v.export()));
		this.connections.forEach((v) => result.connections.push(v.export()));
		return result;
	}
}
