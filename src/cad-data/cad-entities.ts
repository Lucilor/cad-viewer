import {CadLine} from "./cad-entity/cad-line";
import {CadCircle} from "./cad-entity/cad-circle";
import {CadArc} from "./cad-entity/cad-arc";
import {CadMtext} from "./cad-entity/cad-mtext";
import {CadDimension} from "./cad-entity/cad-dimension";
import {CadHatch} from "./cad-entity/cad-hatch";
import {CadLayer} from "./cad-layer";
import {CAD_TYPES, CadTypes} from "./cad-types";
import {CadEntity} from "./cad-entity/cad-entity";
import {CadTransformation} from "./cad-transformation";
import {Box2, ArcCurve, MathUtils, Vector2} from "three";
import {mergeArray, separateArray} from "./utils";
import {uniqWith, intersection} from "lodash";

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
		this.updateDimensions();
	}

	merge(entities: CadEntities) {
		Object.keys(CAD_TYPES).forEach((type) => {
			this[type] = mergeArray(this[type], entities[type], "id");
		});
	}

	separate(entities: CadEntities) {
		Object.keys(CAD_TYPES).forEach((type) => {
			this[type] = separateArray(this[type], entities[type], "id");
		});
	}

	find(id: string) {
		for (const type in CAD_TYPES) {
			const result = (this[type] as CadEntity[]).find((e) => e.id === id || e.originalId === id);
			if (result) {
				return result;
			}
		}
		return null;
	}

	filter(callback: (value: CadEntity, index: number, array: CadEntity[]) => boolean) {
		const result = new CadEntities();
		for (const type in CAD_TYPES) {
			result[type] = (this[type] as CadEntity[]).filter(callback);
		}
		return result;
	}

	export() {
		const result = {line: {}, circle: {}, arc: {}, mtext: {}, dimension: {}, hatch: {}};
		for (const key in CAD_TYPES) {
			const type = key as keyof CadTypes;
			this[type].forEach((e: CadEntity) => {
				if (e instanceof CadDimension) {
					if (e.entity1.id && e.entity2.id) {
						result[type][e.id] = e.export();
					}
				} else {
					result[type][e.id] = e.export();
				}
			});
		}
		return result;
	}

	clone(resetIds = false) {
		const result = new CadEntities(this.export());
		if (resetIds) {
			result.forEach((e) => {
				e.originalId = e.id;
				e.id = MathUtils.generateUUID();
			});
		}
		return result;
	}

	transform(trans: CadTransformation) {
		for (const type in CAD_TYPES) {
			(this[type] as CadEntity[]).forEach((e) => e.transform(trans));
		}
	}

	getBoundingBox() {
		const box = new Box2();
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
				box.expandByPoint(new Vector2(start.x, start.y));
				box.expandByPoint(new Vector2(end.x, end.y));
			}
		});
		this.circle.forEach((entity) => {
			if (entity.visible) {
				const {center, radius} = entity;
				box.expandByPoint(center.clone().addScalar(radius));
				box.expandByPoint(center.clone().subScalar(radius));
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

	forEachType(callback: (array: CadEntity[], type: keyof CadTypes, TYPE: string) => void, include?: (keyof CadTypes)[]) {
		for (const type in CAD_TYPES) {
			if (!include || include?.includes(type as keyof CadTypes)) {
				callback(this[type], type as keyof CadTypes, CAD_TYPES[type]);
			}
		}
	}

	forEach(callback: (value: CadEntity, index: number, array: CadEntity[]) => void, include?: (keyof CadTypes)[]) {
		this.forEachType((array) => array.forEach(callback), include);
	}

	add(entity: CadEntity) {
		if (entity instanceof CadEntity) {
			this.forEachType((array, type, TYPE) => {
				if (TYPE === entity.type) {
					array.push(entity);
				}
			});
		}
		return this;
	}

	remove(entity: CadEntity) {
		if (entity instanceof CadEntity) {
			const id = entity.id;
			this.forEachType((array) => {
				const index = array.findIndex((e) => e.id === id);
				if (index > -1) {
					array.splice(index, 1);
				}
			});
		}
		return this;
	}

	updateDimensions() {
		this.dimension = uniqWith(this.dimension, (a, b) => {
			const aIds = [a.entity1.id, a.entity2.id];
			const bIds = [b.entity1.id, b.entity2.id];
			return intersection(aIds, bIds).length === 2 || a.id === b.id;
		});
	}
}
