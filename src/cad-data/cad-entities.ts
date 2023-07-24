import {getTypeOf, MatrixLike, ObjectOf, Rectangle} from "@lucilor/utils";
import {v4} from "uuid";
import {mergeArray, separateArray} from "../cad-utils";
import {CadData} from "./cad-data";
import {
  CadArc,
  CadCircle,
  CadDimension,
  CadDimensionEntity,
  CadEntity,
  CadHatch,
  CadLeader,
  CadLine,
  CadLineLike,
  CadMtext,
  CadSpline
} from "./cad-entity";
import {CadDimensionLinear} from "./cad-entity/cad-dimension-linear";
import {CadImage} from "./cad-entity/cad-image";
import {CadInsert} from "./cad-entity/cad-insert";
import {CadLayer} from "./cad-layer";
import {CadDimensionType} from "./cad-styles";
import {EntityType, EntityTypeKey, entityTypesKey, entityTypesMap} from "./cad-types";

export const DEFAULT_LENGTH_TEXT_SIZE = 24;

export const getCadEntity = <T extends CadEntity = AnyCadEntity>(
  data: any = {},
  layers: CadLayer[] = [],
  resetId = false,
  type?: EntityType
) => {
  let entity: CadEntity | undefined;
  if (type === undefined) {
    type = data.type;
  } else if (data.type && data.type !== type) {
    throw new Error(`entity type is not match: ${type} !== ${data.type}`);
  }
  if (type === "ARC") {
    entity = new CadArc(data, layers, resetId);
  } else if (type === "CIRCLE") {
    entity = new CadCircle(data, layers, resetId);
  } else if (type === "DIMENSION") {
    const dimType: CadDimensionType = data.dimType;
    if (dimType === "linear" || !dimType) {
      entity = new CadDimensionLinear(data, layers, resetId);
    } else {
      throw new Error(`unsupported dimension type: ${dimType}`);
    }
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
  } else if (type === "INSERT") {
    entity = new CadInsert(data, layers, resetId);
  } else if (type === "IMAGE") {
    entity = new CadImage(data, layers, resetId);
  } else {
    throw new Error(`unsupported entity type: ${type}`);
  }
  return entity as T;
};

export type AnyCadEntity = CadLine & CadMtext & CadDimension & CadArc & CadCircle & CadHatch & CadSpline & CadLeader & CadInsert & CadImage;
export class CadEntities {
  root: CadData | null = null;
  line: CadLine[] = [];
  circle: CadCircle[] = [];
  arc: CadArc[] = [];
  mtext: CadMtext[] = [];
  dimension: CadDimension[] = [];
  hatch: CadHatch[] = [];
  spline: CadSpline[] = [];
  leader: CadLeader[] = [];
  insert: CadInsert[] = [];
  image: CadImage[] = [];
  idMap: ObjectOf<string>;

  get length() {
    let result = 0;
    this.forEachType((array) => (result += array.length));
    return result;
  }

  constructor(data: ObjectOf<any> = {}, layers: CadLayer[] = [], resetIds = false) {
    if (getTypeOf(data) !== "object") {
      data = {};
    }
    this.idMap = {};
    const tryGetCadEntity = (data2: any, type?: EntityType) => {
      try {
        return getCadEntity(data2, layers, resetIds, type);
      } catch (error) {
        console.groupCollapsed("failed to create entity");
        if (error instanceof Error) {
          console.warn(error.message);
        } else {
          console.warn(error);
        }
        console.warn(data2);
        console.groupEnd();
        return null;
      }
    };
    entityTypesKey.forEach((key) => {
      const group: CadEntity[] | ObjectOf<any> = data[key];
      const type = entityTypesMap[key];
      if (Array.isArray(group)) {
        group.forEach((e) => {
          if (!(e instanceof CadEntity)) {
            const e2 = tryGetCadEntity(e, type);
            if (!e2) {
              return;
            }
            e = e2;
          }
          const eNew = e.clone() as AnyCadEntity;
          eNew.root = this;
          this[key].push(eNew);
        });
      } else if (group && typeof group === "object") {
        Object.values(group).forEach((e) => {
          const eNew = tryGetCadEntity(e, type);
          if (!eNew) {
            return;
          }
          eNew.root = this;
          this[key].push(eNew);
        });
      }
    });
    if (resetIds) {
      this.resetIds();
    }
  }

  merge(entities: CadEntities) {
    entityTypesKey.forEach((key) => {
      this[key] = mergeArray<any>(this[key] as any, entities[key] as any, "id");
      this[key].forEach((e) => this._setEntityRootToThis(e));
    });
    return this;
  }

  separate(entities: CadEntities) {
    entityTypesKey.forEach((key) => {
      this[key] = separateArray<any>(this[key] as any, entities[key] as any, "id");
      entities[key].forEach((e) => this._setEntityRootToNull(e));
    });
    return this;
  }

  find(callback?: string | ((value: CadEntity, index: number, array: CadEntity[]) => boolean)): CadEntity | null {
    if (!callback) {
      return null;
    }
    for (const key of entityTypesKey) {
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
    let i = 0;
    this.dimension.forEach((e) => {
      if (!e.mingzi) {
        e.mingzi = "活动标注" + ++i;
      }
    });
    const result: ObjectOf<any> = {};
    for (const key of entityTypesKey) {
      result[key] = {};
      this[key].forEach((e: CadEntity) => {
        result[key][e.id] = e.export();
      });
    }
    return result;
  }

  clone(resetIds = false) {
    const result = new CadEntities(this.export(), [], resetIds);
    result.root = this.root;
    return result;
  }

  resetIds() {
    this.idMap = {};
    const idMap = this.idMap;
    this.forEach((e) => {
      const id = v4();
      idMap[e.id] = id;
      e.id = id;
    });
    this.dimension.forEach((e) => {
      if (e instanceof CadDimensionLinear) {
        const e1Id = idMap[e.entity1.id];
        const e2Id = idMap[e.entity2.id];
        if (e1Id) {
          e.entity1.id = e1Id;
        }
        if (e2Id) {
          e.entity2.id = e2Id;
        }
      }
    });
  }

  transform(matrix: MatrixLike, alter: boolean) {
    this.forEach((e) => e.transform(matrix, alter));
    return this;
  }

  forEachType(callback: (array: CadEntity[], type: EntityTypeKey) => void) {
    entityTypesKey.forEach((key) => {
      callback(this[key], key);
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

  toArray(recursive = false) {
    const result: CadEntity[] = [];
    this.forEach((e) => result.push(e), recursive);
    return result;
  }

  private _setEntityRootToThis(entity: CadEntity) {
    if (entity.root?.root && !this.root) {
      return;
    }
    entity.root = this;
  }

  private _setEntityRootToNull(entity: CadEntity) {
    if (entity.root?.root && !this.root) {
      return;
    }
    entity.root = null;
  }

  add(...entities: CadEntity[]): this {
    entities.forEach((entity) => {
      if (entity instanceof CadEntity) {
        this.forEachType((array, type) => {
          if (entityTypesMap[type] === entity.type) {
            if (!array.find((e) => e.id === entity.id)) {
              array.push(entity);
            }
            this._setEntityRootToThis(entity);
          }
        });
      }
    });
    return this;
  }

  remove(...entities: CadEntity[]): this {
    entities.forEach((entity) => {
      if (entity instanceof CadEntity) {
        const id = entity.id;
        this._setEntityRootToNull(entity);
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

  empty(): this {
    this.forEachType((array) => (array.length = 0));
    return this;
  }

  getDimensionPoints(dimension: CadDimension) {
    if (!(dimension instanceof CadDimensionLinear)) {
      return [];
    }
    const {entity1, entity2, distance, axis, distance2, ref, defPoints} = dimension;
    if (defPoints?.length === 3) {
      const [p0, p1, p2] = defPoints;
      const p3 = p0.clone();
      const p4 = p0.clone();
      if (axis === "x") {
        if (Math.abs(p0.x - p1.x) < Math.abs(p0.x - p2.x)) {
          p4.x += p2.x - p1.x;
        } else {
          p3.x += p1.x - p2.x;
        }
      } else if (axis === "y") {
        if (Math.abs(p0.y - p1.y) < Math.abs(p0.y - p2.y)) {
          p4.y += p2.y - p1.y;
        } else {
          p3.y += p1.y - p2.y;
        }
      } else {
        return [];
      }
      return [p1, p2, p3, p4];
    }
    let entity: CadDimensionEntity | undefined;
    const line1 = this.find(entity1.id) as CadLineLike;
    const line2 = this.find(entity2.id) as CadLineLike;
    if (!(line1 instanceof CadLineLike) || !(line2 instanceof CadLineLike)) {
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
    const getPoint = (e: CadLineLike, location: CadDimensionEntity["location"]) => {
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
    const p = entity.id === entity1.id ? p1.clone() : p2.clone();
    if (axis === "x") {
      p3.y = p4.y = p.y + distance;
      if (p3.x > p4.x) {
        [p3, p4] = [p4, p3];
        [p1, p2] = [p2, p1];
      }
    } else if (axis === "y") {
      p3.x = p4.x = p.x + distance;
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

  getBoundingRect(recursive = true) {
    if (this.length < 1) {
      return new Rectangle(0, 0);
    }
    const rect = Rectangle.min;
    this.forEach((e) => {
      if (e.calcBoundingRectForce || (e.visible && e.calcBoundingRect)) {
        const eRect = e.boundingRect;
        const {isFinite, width, height} = eRect;
        if (isFinite && (width > 0 || height > 0)) {
          rect.expandByRect(eRect);
        }
      }
    }, recursive);
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
