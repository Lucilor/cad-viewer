import {Point, Rectangle} from "@lucilor/utils";
import {MatrixAlias} from "@svgdotjs/svg.js";
import {CadLine, CadCircle, CadArc, CadMtext, CadDimension, CadHatch, getCadEntity, CadEntity, CadDimensionEntity} from "./cad-entity";
import {CadLayer} from "./cad-layer";
import {cadTypesKey, CadTypeKey, CadType, cadTypes} from "./cad-types";
import {mergeArray, separateArray} from "./utils";

export class CadEntities {
	line: CadLine[] = [];
	circle: CadCircle[] = [];
	arc: CadArc[] = [];
	mtext: CadMtext[] = [];
	dimension: CadDimension[] = [];
	hatch: CadHatch[] = [];

	get length() {
		let result = 0;
		this.forEachType((array) => (result += array.length));
		return result;
	}

	constructor(data: any = {}, layers: CadLayer[] = [], resetIds = false) {
		if (typeof data !== "object") {
			throw new Error("Invalid data.");
		}
		cadTypesKey.forEach((key) => {
			const group = data[key];
			if (Array.isArray(group)) {
				group.forEach((v) => this[key].push(v.clone(resetIds)));
			} else if (typeof group === "object") {
				Object.values(group).forEach((v) => this[key].push(getCadEntity(v, layers, resetIds)));
			}
		});
	}

	merge(entities: CadEntities) {
		cadTypesKey.forEach((key: string) => {
			this[key] = mergeArray(this[key], entities[key], "id");
		});
		return this;
	}

	separate(entities: CadEntities) {
		cadTypesKey.forEach((key: string) => {
			this[key] = separateArray(this[key], entities[key], "id");
		});
		return this;
	}

	find(callback: string | ((value: CadEntity, index: number, array: CadEntity[]) => boolean)) {
		for (const key of cadTypesKey) {
			for (let i = 0; i < this[key].length; i++) {
				const e = this[key][i];
				if (typeof callback === "string") {
					if (e.id === callback || e.originalId === callback) {
						return e;
					}
				} else {
					if (callback(e, i, this[key])) {
						return e;
					}
				}
				const found = e.children.find(callback);
				if (found) {
					return found;
				}
			}
		}
		return null;
	}

	export() {
		const result = {line: {}, circle: {}, arc: {}, mtext: {}, dimension: {}, hatch: {}};
		for (const key of cadTypesKey) {
			this[key].forEach((e: CadEntity) => {
				if (e instanceof CadDimension) {
					if (e.entity1.id && e.entity2.id) {
						result[key][e.id] = e.export();
					}
				} else {
					result[key][e.id] = e.export();
				}
			});
		}
		return result;
	}

	clone(resetIds = false) {
		return new CadEntities(this, [], resetIds);
	}

	transform(matrix: MatrixAlias) {
		this.forEach((e) => e.transform(matrix));
	}

	forEachType(callback: (array: CadEntity[], type: CadTypeKey, TYPE: CadType) => void, recursive = false) {
		for (let i = 0; i < cadTypes.length; i++) {
			const arr = this[cadTypesKey[i]];
			callback(arr, cadTypesKey[i], cadTypes[i]);
		}
	}

	forEach(callback: (value: CadEntity, index: number, array: CadEntity[]) => void, recursive = false) {
		this.forEachType((array) => {
			array.forEach((v, i, a) => {
				callback(v, i, a);
				if (recursive) {
					v.children.forEach(callback);
				}
			});
		});
	}

	filter(callback: (value: CadEntity, index: number, array: CadEntity[]) => boolean, recursive = false) {
		const result = new CadEntities();
		this.forEachType((array) => {
			array.forEach((v, i, a) => {
				if (callback(v, i, a)) {
					result.add(v);
				} else if (recursive) {
					v.children.forEach((vv, ii, aa) => {
						if (callback(vv, ii, aa)) {
							result.add(vv);
						}
					});
				}
			});
		});
		return result;
	}

	fromArray(array: CadEntity[]) {
		this.forEachType((array) => (array.length = 0));
		array.forEach((e) => this.add(e));
		return this;
	}

	toArray() {
		const result: CadEntity[] = [];
		this.forEach((e) => result.push(e));
		return result;
	}

	add(...entities: CadEntity[]) {
		entities.forEach((entity) => {
			if (entity instanceof CadEntity) {
				this.forEachType((array, type, TYPE) => {
					if (TYPE === entity.type) {
						array.push(entity);
					}
				});
			}
		});
		return this;
	}

	remove(...entities: CadEntity[]) {
		entities.forEach((entity) => {
			if (entity instanceof CadEntity) {
				const id = entity.id;
				this.forEachType((array) => {
					const index = array.findIndex((e) => e.id === id);
					if (index > -1) {
						array.splice(index, 1);
					}
				});
			}
		});

		return this;
	}

	getDimensionPoints(dimension: CadDimension) {
		const {entity1, entity2, distance, axis, distance2, ref} = dimension;
		let entity: CadDimensionEntity;
		const line1 = this.find(entity1.id) as CadLine;
		const line2 = this.find(entity2.id) as CadLine;
		if (!(line1 instanceof CadLine) || !(line2 instanceof CadLine)) {
			return [];
		}
		switch (ref) {
			case "entity1":
				entity = entity1;
				break;
			case "entity2":
				entity = entity2;
				break;
			case "maxLength":
				entity = line2.length > line1.length ? entity2 : entity1;
				break;
			case "minLength":
				entity = line2.length > line1.length ? entity1 : entity2;
				break;
			case "maxX":
				entity = line2.maxX > line1.maxX ? entity2 : entity1;
				break;
			case "maxY":
				entity = line2.maxY > line1.maxY ? entity2 : entity1;
				break;
			case "minX":
				entity = line2.minX < line1.minX ? entity2 : entity1;
				break;
			case "minY":
				entity = line2.minY < line1.minY ? entity2 : entity1;
				break;
			default:
				break;
		}
		const getPoint = (e: CadLine, location: CadDimensionEntity["location"]) => {
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
		};
		let p1 = getPoint(line1, entity1.location);
		let p2 = getPoint(line2, entity2.location);
		if (!p1 || !p2) {
			return [];
		}
		let p3 = p1.clone();
		let p4 = p2.clone();
		let p: Point;
		if (entity.id === entity1.id) {
			p = getPoint(line1, entity1.location);
		} else {
			p = getPoint(line2, entity2.location);
		}
		if (axis === "x") {
			p3.y = p.y + distance;
			p4.y = p.y + distance;
			if (p3.x > p4.x) {
				[p3, p4] = [p4, p3];
				[p1, p2] = [p2, p1];
			}
		}
		if (axis === "y") {
			p3.x = p.x + distance;
			p4.x = p.x + distance;
			if (p3.y < p4.y) {
				[p3, p4] = [p4, p3];
				[p1, p2] = [p2, p1];
			}
		}
		if (distance2 !== undefined) {
			[p3, p4].forEach((p) => (p.y = distance2));
		}

		const p5 = p3.clone();
		const p6 = p3.clone();
		const p7 = p4.clone();
		const p8 = p4.clone();
		const arrowSize = Math.max(1, Math.min(8, p3.distanceTo(p4) / 20));
		const arrowLength = arrowSize * Math.sqrt(3);
		if (axis === "x") {
			p5.add(new Point(arrowLength, -arrowSize));
			p6.add(new Point(arrowLength, arrowSize));
			p7.add(new Point(-arrowLength, -arrowSize));
			p8.add(new Point(-arrowLength, arrowSize));
		}
		if (axis === "y") {
			p5.add(new Point(-arrowSize, -arrowLength));
			p6.add(new Point(arrowSize, -arrowLength));
			p7.add(new Point(-arrowSize, arrowLength));
			p8.add(new Point(arrowSize, arrowLength));
		}

		return [p1, p2, p3, p4, p5, p6, p7, p8];
	}

	getBoundingRect(entities = this) {
		const rect = new Rectangle(new Point(Infinity, Infinity), new Point(-Infinity, -Infinity));
		entities.forEach((e) => {
			if (!e.visible) {
				return;
			}
			if (e instanceof CadCircle) {
				const {center, radius} = e;
				rect.expand(center.clone().add(radius));
				rect.expand(center.clone().sub(radius));
			} else if (e instanceof CadArc) {
				const curve = e.curve;
				rect.expand(curve.getPoint(0));
				rect.expand(curve.getPoint(0.5));
				rect.expand(curve.getPoint(1));
			} else if (e instanceof CadDimension) {
				this.getDimensionPoints(e).forEach((p) => rect.expand(p));
			} else if (e instanceof CadLine) {
				rect.expand(e.start);
				rect.expand(e.end);
			}
		});
		if (!isFinite(rect.width) || !isFinite(rect.height)) {
			return new Rectangle();
		}
		return rect;
	}
}
