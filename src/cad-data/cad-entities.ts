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
import {Object3D} from "three";
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

	get objects() {
		const result: Object3D[] = [];
		this.forEach((e) => {
			if (e.object) {
				result.push(e.object);
			}
		});
		return result;
	}

	constructor(data: any = {}, layers: CadLayer[] = [], resetIds = false) {
		if (typeof data !== "object") {
			throw new Error("Invalid data.");
		}
		Object.keys(CAD_TYPES).forEach((type: keyof CadTypes) => {
			const group = data[type];
			if (Array.isArray(group)) {
				group.forEach((v) => this[type].push(v.clone(resetIds)));
			} else if (typeof group === "object") {
				if (type === "arc") {
					Object.values(group).forEach((v) => this[type].push(new CadArc(v, layers, resetIds)));
				} else if (type === "circle") {
					Object.values(group).forEach((v) => this[type].push(new CadCircle(v, layers, resetIds)));
				} else if (type === "dimension") {
					Object.values(group).forEach((v) => this[type].push(new CadDimension(v, layers, resetIds)));
				} else if (type === "hatch") {
					Object.values(group).forEach((v) => this[type].push(new CadHatch(v, layers, resetIds)));
				} else if (type === "line") {
					Object.values(group).forEach((v) => this[type].push(new CadLine(v, layers, resetIds)));
				} else if (type === "mtext") {
					Object.values(group).forEach((v) => this[type].push(new CadMtext(v, layers, resetIds)));
				}
			}
		});
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
		return new CadEntities(this, [], resetIds);
	}

	transform(trans: CadTransformation) {
		for (const type in CAD_TYPES) {
			(this[type] as CadEntity[]).forEach((e) => e.transform(trans));
		}
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

	toArray() {
		const result: CadEntity[] = [];
		this.forEach((e) => result.push(e));
		return result;
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
}
