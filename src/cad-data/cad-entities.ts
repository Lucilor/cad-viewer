import {MatrixLike, ObjectOf, Point, Rectangle} from "@utils";
import {mergeArray, separateArray} from "../cad-utils";
import {CadLayer} from "./cad-layer";
import {cadTypesKey, CadTypeKey, CadType} from "./cad-types";
import {
    CadArc,
    CadCircle,
    CadDimension,
    CadDimensionEntity,
    CadEntity,
    CadHatch,
    CadLeader,
    CadLine,
    CadMtext,
    CadSpline
} from "./cad-entity";
import {v4} from "uuid";

export const DEFAULT_LENGTH_TEXT_SIZE = 24;

export const getCadEntity = <T extends CadEntity>(data: any = {}, layers: CadLayer[] = [], resetId = false) => {
    let entity: CadEntity | undefined;
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
    } else if (type === "SPLINE") {
        entity = new CadSpline(data, layers, resetId);
    } else if (type === "LEADER") {
        entity = new CadLeader(data, layers, resetId);
    } else {
        throw new Error(`unsupported entity type: ${type}`);
    }
    return entity as T;
};

export type AnyCadEntity = CadLine & CadMtext & CadDimension & CadArc & CadCircle & CadHatch & CadSpline & CadLeader;
export class CadEntities {
    line: CadLine[] = [];
    circle: CadCircle[] = [];
    arc: CadArc[] = [];
    mtext: CadMtext[] = [];
    dimension: CadDimension[] = [];
    hatch: CadHatch[] = [];
    spline: CadSpline[] = [];
    leader: CadLeader[] = [];

    get length() {
        let result = 0;
        this.forEachType((array) => (result += array.length));
        return result;
    }

    constructor(data: any = {}, layers: CadLayer[] = [], resetIds = false) {
        if (typeof data !== "object") {
            throw new Error("Invalid data.");
        }
        const idMap: ObjectOf<string> = {};
        cadTypesKey.forEach((key) => {
            const group: CadEntity[] | ObjectOf<any> = data[key];
            if (Array.isArray(group)) {
                group.forEach((e) => {
                    if (!(e instanceof CadEntity)) {
                        try {
                            e = getCadEntity(e, layers, resetIds);
                        } catch (error) {
                            console.warn("failed to create entity: \n" + JSON.stringify(e));
                            return;
                        }
                    }
                    const eNew = e.clone(resetIds) as AnyCadEntity;
                    eNew.root = this;
                    this[key].push(eNew);
                    if (resetIds) {
                        idMap[e.id] = eNew.id;
                    }
                });
            } else if (typeof group === "object") {
                Object.values(group).forEach((e) => {
                    const eNew = getCadEntity(e, layers, resetIds) as AnyCadEntity;
                    eNew.root = this;
                    this[key].push(eNew);
                    if (resetIds) {
                        idMap[e.id] = eNew.id;
                    }
                });
            }
        });
        if (resetIds) {
            this.dimension.forEach((e) => {
                const e1Id = idMap[e.entity1.id];
                const e2Id = idMap[e.entity2.id];
                if (e1Id) {
                    e.entity1.id = e1Id;
                }
                if (e2Id) {
                    e.entity2.id = e2Id;
                }
            });
        }
    }

    merge(entities: CadEntities) {
        cadTypesKey.forEach((key) => {
            this[key] = mergeArray<any>(this[key] as any, entities[key] as any, "id");
        });
        return this;
    }

    separate(entities: CadEntities) {
        cadTypesKey.forEach((key) => {
            this[key] = separateArray<any>(this[key] as any, entities[key] as any, "id");
        });
        return this;
    }

    find(callback?: string | ((value: CadEntity, index: number, array: CadEntity[]) => boolean)): CadEntity | null {
        if (!callback) {
            return null;
        }
        for (const key of cadTypesKey) {
            for (let i = 0; i < this[key].length; i++) {
                const e = this[key][i];
                if (typeof callback === "string") {
                    if (e.id === callback) {
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
        const result: ObjectOf<any> = {};
        for (const key of cadTypesKey) {
            result[key] = {};
            this[key].forEach((e: CadEntity) => {
                result[key][e.id] = e.export();
            });
        }
        return result;
    }

    clone(resetIds = false) {
        return new CadEntities(this.export(), [], resetIds);
    }

    resetIds() {
        const idMap: ObjectOf<string> = {};
        this.forEach((e) => {
            const id = v4();
            idMap[e.id] = id;
            e.id = id;
        });
        this.dimension.forEach((e) => {
            const e1Id = idMap[e.entity1.id];
            const e2Id = idMap[e.entity2.id];
            if (e1Id) {
                e.entity1.id = e1Id;
            }
            if (e2Id) {
                e.entity2.id = e2Id;
            }
        });
    }

    transform(matrix: MatrixLike, alter = false) {
        this.forEach((e) => e.transform(matrix, alter));
    }

    forEachType(callback: (array: CadEntity[], type: CadTypeKey, TYPE: CadType) => void) {
        cadTypesKey.forEach((key) => {
            callback(this[key], key, key.toUpperCase() as CadType);
        });
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
        this.forEachType((group) => (group.length = 0));
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
        let entity: CadDimensionEntity | undefined;
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
                throw new Error("Invalid ref: " + ref);
        }
        const getPoint = (e: CadLine, location: CadDimensionEntity["location"]) => {
            const {start, end, middle, swapped} = e.clone();
            if (location === "start") {
                return swapped ? end : start;
            } else if (location === "end") {
                return swapped ? start : end;
            } else if (location === "center") {
                return middle;
            } else if (location === "min") {
                if (axis === "x") {
                    return start.y < end.y ? start : end;
                } else if (axis === "y") {
                    return start.x < end.x ? start : end;
                } else {
                    return middle;
                }
            } else if (location === "max") {
                if (axis === "x") {
                    return start.y > end.y ? start : end;
                } else if (axis === "y") {
                    return start.x > end.x ? start : end;
                } else {
                    return middle;
                }
            } else if (location === "minX") {
                return start.x < end.x ? start : end;
            } else if (location === "maxX") {
                return start.x > end.x ? start : end;
            } else if (location === "minY") {
                return start.y < end.y ? start : end;
            } else if (location === "maxY") {
                return start.y > end.y ? start : end;
            } else {
                return middle;
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
            [p3, p4].forEach((pn) => (pn.y = distance2));
        }

        return [p1, p2, p3, p4];
    }

    getBoundingRect() {
        const rect = new Rectangle(new Point(Infinity, Infinity), new Point(-Infinity, -Infinity));
        this.forEach((e) => {
            if (e.calcBoundingPoints) {
                e.boundingPoints.forEach((p) => rect.expand(p));
            }
        }, true);
        if (!isFinite(rect.width) || !isFinite(rect.height)) {
            return new Rectangle();
        }
        return rect;
    }

    // * 实体的偏移, 目前只实现的直线和弧线
    offset(direction: number, distance: number) {
        if (!(direction > 0) && !(direction < 0)) {
            throw new Error("ERROR: direction must be a number that greater than 0 or less than 0.");
        }
        this.forEach((e) => {
            if (e instanceof CadArc) {
                if (direction < 0 === e.clockwise) {
                    e.radius -= distance;
                } else {
                    e.radius += distance;
                }
            } else if (e instanceof CadLine) {
                let dx = 0;
                let dy = 0;
                const theta = e.theta.rad;
                if (direction < 0) {
                    dx = distance * Math.sin(theta);
                    dy = -distance * Math.cos(theta);
                } else {
                    dx = -distance * Math.sin(theta);
                    dy = distance * Math.cos(theta);
                }
                e.start.add(dx, dy);
                e.end.add(dx, dy);
            }
        });
    }
}
