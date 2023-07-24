import {getTypeOf, keysOf, Matrix, MatrixLike, ObjectOf, Point} from "@lucilor/utils";
import {cloneDeep, intersection, uniqWith} from "lodash";
import {v4} from "uuid";
import {getArray, getObject, getVectorFromArray, mergeArray, mergeObject, purgeObject, separateArray, separateObject} from "../cad-utils";
import {CadEntities, getCadEntity} from "./cad-entities";
import {CadCircle, CadDimension, CadEntity, CadLine} from "./cad-entity";
import {CadDimensionLinear} from "./cad-entity/cad-dimension-linear";
import {CadLayer} from "./cad-layer";
import {isLinesParallel} from "./cad-lines";

export interface CadDataInfo {
  [key: string]: any;
  唯一码?: string;
  修改包边正面宽规则?: string;
  锁边自动绑定可搭配铰边?: string;
  version?: CadVersion;
  vars?: ObjectOf<string>;
  激光开料是否翻转?: boolean;
  激光开料标记线?: {ids: string[]; type: string}[];
}

export enum CadVersion {
  DXF9 = "AC1004",
  DXF10 = "AC1006",
  DXF12 = "AC1009",
  DXF13 = "AC1012",
  DXF14 = "AC1014",
  DXF2000 = "AC1015",
  DXF2004 = "AC1018",
  DXF2007 = "AC1021",
  DXF2010 = "AC1024",
  DXF2013 = "AC1027",
  DXF2018 = "AC1032"
}

export const intersectionKeys = ["zhidingweizhipaokeng", "指定分体位置", "指定位置不折"] as const;
export type IntersectionKey = (typeof intersectionKeys)[number];
export const intersectionKeysTranslate: Record<IntersectionKey, string> = {
  zhidingweizhipaokeng: "指定位置刨坑",
  指定分体位置: "指定分体位置",
  指定位置不折: "指定位置不折"
};

const propertyKeys: (keyof CadData)[] = [
  "numId",
  "name",
  "xianshimingzi",
  "type",
  "type2",
  "conditions",
  "options",
  "parent",
  "huajian",
  "xinghaohuajian",
  "mubanfangda",
  "kailiaoshibaokeng",
  "bianxingfangshi",
  "bancaiwenlifangxiang",
  "huajianwenlifangxiang",
  "kailiaopaibanfangshi",
  "morenkailiaobancai",
  "gudingkailiaobancai",
  "suanliaochuli",
  "showKuandubiaozhu",
  "info",
  "attributes",
  "bancaihoudufangxiang",
  "suanliaodanxianshibancai",
  "needsHuajian",
  "kedulibancai",
  "shuangxiangzhewan",
  "suanliaodanxianshi",
  "zhidingweizhipaokeng",
  "指定分体位置",
  "指定位置不折",
  "suanliaodanZoom",
  "企料前后宽同时改变",
  "主CAD",
  "算料单展开显示位置",
  "属于门框门扇",
  "内开做分体",
  "板材绑定选项",
  "算料单线长显示的最小长度",
  "检查企料厚度",
  "对应门扇厚度",
  "跟随CAD开料板材",
  "算料特殊要求",
  "正面宽差值",
  "墙厚差值",
  "企料翻转",
  "装配位置",
  "企料包边门框配合位增加值",
  "企料包边类型",
  "指定封口厚度",
  "显示厚度",
  "拼接料拼接时垂直翻转",
  "必须选择板材",
  "对应计算条数的配件",
  "指定板材分组",
  "拉码碰撞判断",
  "开孔对应名字",
  "切内空对应名字",
  "默认开料材料",
  "默认开料板材厚度",
  "自动生成双折宽双折高公式"
];

export class CadData {
  private _entities: CadEntities;
  get entities() {
    return this._entities;
  }
  set entities(value) {
    this._entities.root = null;
    value.root = this;
    this._entities = value;
  }
  blocks: ObjectOf<CadEntity[]> = {};
  layers: CadLayer[] = [];
  id = "";
  numId = 0;
  name = "";
  xianshimingzi = "";
  type = "";
  type2 = "";
  conditions: string[] = [];
  options: ObjectOf<string> = {};
  baseLines: CadBaseLine[] = [];
  jointPoints: CadJointPoint[] = [];
  parent = "";
  partners: CadData[] = [];
  components = new CadComponents();
  huajian = "";
  xinghaohuajian: ObjectOf<string> = {};
  mubanfangda = true;
  kailiaoshibaokeng = false;
  bianxingfangshi = "";
  bancaiwenlifangxiang = "";
  huajianwenlifangxiang = "";
  kailiaopaibanfangshi = "";
  morenkailiaobancai = "";
  gudingkailiaobancai = "";
  suanliaochuli = "";
  showKuandubiaozhu = false;
  info: CadDataInfo = {};
  attributes: ObjectOf<string> = {};
  bancaihoudufangxiang = "";
  zhankai: CadZhankai[] = [];
  suanliaodanxianshibancai = true;
  needsHuajian = true;
  kedulibancai = false;
  shuangxiangzhewan = false;
  suanliaodanxianshi = "";
  zhidingweizhipaokeng: string[][] = [];
  指定分体位置: string[][] = [];
  指定位置不折: string[][] = [];
  suanliaodanZoom = 1.5;
  企料前后宽同时改变 = true;
  主CAD = false;
  算料单展开显示位置 = "";
  属于门框门扇 = "";
  内开做分体 = false;
  板材绑定选项 = "";
  算料单线长显示的最小长度: number | null = null;
  检查企料厚度 = true;
  对应门扇厚度 = 0;
  跟随CAD开料板材: string | null = null;
  算料特殊要求: string | null = null;
  正面宽差值 = 0;
  墙厚差值 = 0;
  企料翻转 = false;
  装配位置 = "";
  企料包边门框配合位增加值 = 0;
  企料包边类型 = "";
  指定封口厚度 = "";
  显示厚度 = "";
  拼接料拼接时垂直翻转 = false;
  必须选择板材 = false;
  对应计算条数的配件: ObjectOf<string> = {};
  指定板材分组 = "";
  拉码碰撞判断 = true;
  开孔对应名字 = "";
  切内空对应名字 = "";
  默认开料材料 = "";
  默认开料板材厚度 = "";
  自动生成双折宽双折高公式 = true;

  constructor(data?: ObjectOf<any>, resetIds = false) {
    this._entities = new CadEntities();
    this._entities.root = this;
    this.import(data, resetIds);
  }

  import(data: ObjectOf<any> = {}, resetIds = false) {
    if (getTypeOf(data) !== "object") {
      data = {};
    }
    this.id = data.id ?? v4();
    this.layers = [];
    if (typeof data.layers === "object") {
      for (const id in data.layers) {
        this.layers.push(new CadLayer(data.layers[id]));
      }
    } else {
      this.layers = [];
    }
    this.entities = new CadEntities(data.entities || {}, this.layers);
    if (typeof data.blocks === "object") {
      for (const name in data.blocks) {
        const block = data.blocks[name];
        if (Array.isArray(block) && block.length > 0) {
          this.blocks[name] = block.map((v) => getCadEntity(v, this.layers));
        }
      }
    } else {
      this.blocks = {};
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
    this.partners = [];
    this.components = new CadComponents();
    if (Array.isArray(data.partners)) {
      (data.partners as []).forEach((v) => this.partners.push(new CadData(v)));
    }
    this.updatePartners();
    this.components = new CadComponents(getObject(data.components));
    this.updateComponents();
    if (Array.isArray(data.zhankai) && data.zhankai.length > 0) {
      this.zhankai = data.zhankai.map((v) => new CadZhankai(v));
    } else {
      this.zhankai = [new CadZhankai()];
    }
    if (data.kailiaomuban && !this.zhankai[0].kailiaomuban) {
      this.zhankai[0].kailiaomuban = data.kailiaomuban;
    }
    for (const key of propertyKeys) {
      if (!(key in data)) {
        continue;
      }
      const sourceValue = data[key];
      const currentValue = this[key];
      const currentType = getTypeOf(currentValue);
      if (currentType === "array") {
        (this as any)[key] = getArray(sourceValue);
      } else if (currentType === "object") {
        (this as any)[key] = getObject(sourceValue);
      } else {
        (this as any)[key] = cloneDeep(sourceValue);
      }
    }
    this.updateDimensions();
    if (resetIds) {
      this.resetIds();
    }
    return this;
  }

  export(): ObjectOf<any> {
    this.updateBaseLines();
    const exLayers: ObjectOf<any> = {};
    this.layers.forEach((v) => {
      exLayers[v.id] = v.export();
    });
    const options = {...this.options};
    keysOf(options).forEach((k) => {
      if (!k || !options[k]) {
        delete options[k];
      }
    });
    const blocks: ObjectOf<any> = {};
    for (const name in this.blocks) {
      const block = this.blocks[name];
      if (block.length > 0) {
        blocks[name] = block.map((v) => v.export());
      }
    }
    const result: ObjectOf<any> = {
      layers: exLayers,
      entities: this.entities.export(),
      blocks,
      id: this.id,
      baseLines: this.baseLines.map((v) => v.export()).filter((v) => v.name && v.idX && v.idY),
      jointPoints: this.jointPoints.map((v) => v.export()),
      partners: this.partners.map((v) => v.export()),
      components: this.components.export(),
      zhankai: this.zhankai.map((v) => v.export())
    };
    for (const key of propertyKeys) {
      if (key === "conditions") {
        result[key] = this[key].filter(Boolean);
      } else {
        result[key] = this[key];
      }
    }
    return purgeObject(result);
  }

  copy(data: CadData) {
    return this.import(data);
  }

  getAllEntities() {
    const result = new CadEntities();
    result.merge(this.entities);
    this.partners.forEach((p) => {
      result.merge(p.getAllEntities());
    });
    this.components.data.forEach((c) => {
      result.merge(c.getAllEntities());
    });
    return result;
  }

  findEntity(id?: string) {
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

  findChild(id: string): CadData | null {
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
    const data = new CadData(this.export(), resetIds);
    return data;
  }

  resetIds(entitiesOnly = false) {
    if (!entitiesOnly) {
      this.id = v4();
    }
    this.layers.forEach((v) => (v.id = v4()));
    for (const name in this.blocks) {
      this.blocks[name].forEach((v) => (v.id = v4()));
    }
    this.entities.resetIds();
    this.partners.forEach((v) => {
      v.parent = this.id;
      v.resetIds(entitiesOnly);
    });
    this.components.data.forEach((v) => {
      v.parent = this.id;
      v.resetIds(entitiesOnly);
    });
    const idMap = this.entities.idMap;
    for (const key of intersectionKeys) {
      this[key] = this[key].map((v) => v.map((id) => idMap[id] || id));
    }
    if (this.info.激光开料标记线) {
      for (const v of this.info.激光开料标记线) {
        v.ids = v.ids.map((id) => idMap[id] || id);
      }
    }
    return this;
  }

  merge(data: CadData) {
    this.layers = mergeArray(this.layers, data.layers, "name");
    for (const name in data.blocks) {
      if (Array.isArray(this.blocks[name])) {
        this.blocks[name] = this.blocks[name].concat(data.blocks[name]);
      } else {
        this.blocks[name] = data.blocks[name];
      }
    }
    this.entities.merge(data.entities);
    this.conditions = mergeArray(this.conditions, data.conditions, "value");
    this.options = mergeObject(this.options, data.options);
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
    for (const name in data.blocks) {
      delete this.blocks[name];
    }
    this.entities.separate(data.entities);
    this.conditions = separateArray(this.conditions, data.conditions);
    this.options = separateObject(this.options, data.options);
    this.jointPoints = separateArray(this.jointPoints, data.jointPoints, "name");
    this.baseLines = separateArray(this.baseLines, data.baseLines, "name");
    this.partners = separateArray(this.partners, data.partners, "id");
    this.components.connections = separateArray(this.components.connections, data.components.connections);
    this.components.data = separateArray(this.components.data, data.components.data, "id");
    this.partners.forEach((v) => v.separate(data));
    this.components.data.forEach((v) => v.separate(data));
    return this;
  }

  transform(matrix: MatrixLike, alter: boolean) {
    for (const name in this.blocks) {
      this.blocks[name].forEach((v) => v.transform(matrix, alter));
    }
    this.entities.transform(matrix, alter);
    this.partners.forEach((v) => v.transform(matrix, alter));
    this.components.transform(matrix, alter);
    this.baseLines.forEach((v) => {
      const point = new Point(v.valueX, v.valueY);
      point.transform(matrix);
      v.valueX = point.x;
      v.valueY = point.y;
    });
    this.jointPoints.forEach((v) => {
      const point = new Point(v.valueX, v.valueY);
      point.transform(matrix);
      v.valueX = point.x;
      v.valueY = point.y;
    });
    const m = new Matrix(matrix);
    const horizontal = m.a < 0;
    const vertical = m.d < 0;
    this.entities.dimension.forEach((e) => {
      if (e instanceof CadDimensionLinear) {
        if (vertical && e.axis === "x") {
          const [p1, p2] = this.getDimensionPoints(e);
          if (p1 && p2) {
            e.distance = -Math.abs(p1.y - p2.y) - e.distance;
          }
        }
        if (horizontal && e.axis === "y") {
          const [p1, p2] = this.getDimensionPoints(e);
          if (p1 && p2) {
            e.distance = -Math.abs(p1.x - p2.x) - e.distance;
          }
        }
      }
    });
    return this;
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
    let translate: Point | undefined;
    for (const p1 of this.jointPoints) {
      for (const p2 of partner.jointPoints) {
        if (p1.name === p2.name) {
          translate = getVectorFromArray([p1.valueX - p2.valueX, p1.valueY - p2.valueY]);
          break;
        }
      }
    }
    if (!translate) {
      const rect1 = this.getBoundingRect();
      if (rect1.width && rect1.height) {
        const rect2 = partner.getBoundingRect();
        translate = getVectorFromArray([rect1.x - rect2.x, rect1.y - rect2.y]);
        translate.x += (rect1.width + rect2.width) / 2 + 15;
      } else {
        translate = new Point();
      }
    }
    partner.transform({translate}, false);
    const data = this.partners;
    const prev = data.findIndex((v) => v.id === partner.id);
    if (prev > -1) {
      data[prev] = partner;
    } else {
      data.push(partner);
    }
    partner.parent = this.id;
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
    const data = this.components.data;
    const prev = data.findIndex((v) => v.id === component.id);
    if (prev > -1) {
      data[prev] = component;
    } else {
      data.push(component);
    }
    component.parent = this.id;
    return this;
  }

  updateComponents() {
    const data = this.components.data.slice();
    const connections = this.components.connections.slice();
    connections.forEach((v) => {
      const [id1, id2] = v.ids;
      const child1 = this.findChild(id1);
      const child2 = this.findChild(id2);
      if (this.id === id1) {
        v.names[0] = this.name;
      } else if (child1) {
        v.names[0] = child1.name;
      }
      if (this.id === id2) {
        v.names[1] = this.name;
      } else if (child2) {
        v.names[1] = child2.name;
      }
    });
    this.components.data.length = 0;
    this.components.connections.length = 0;
    data.forEach((v) => this.addComponent(v));
    connections.forEach((c) => {
      try {
        this.assembleComponents(c);
      } catch (error) {
        // console.warn(error);
      }
    });
    this.partners.forEach((v) => v.updateComponents());
    this.components.data.forEach((v) => v.updateComponents());
    return this;
  }

  updateDimensions(parentDimensions?: CadDimension[]) {
    if (Array.isArray(parentDimensions)) {
      this.entities.dimension = this.entities.dimension.filter((v) => parentDimensions.every((vv) => !v.equals(vv)));
    }
    this.entities.dimension = uniqWith(this.entities.dimension, (a, b) => a.equals(b));
    const tmp = this.entities.dimension;
    this.entities.dimension = [];
    const rect = this.getBoundingRect();
    this.entities.dimension.forEach((e) => {
      if (e instanceof CadDimensionLinear && e.mingzi === "宽度标注") {
        e.distance2 = rect.y + rect.height / 2 + 40;
      }
    });
    this.entities.dimension = tmp;

    const children = [...this.partners, ...this.components.data];
    this.entities.dimension.forEach((e) => {
      if (e instanceof CadDimensionLinear) {
        let cad1Changed = false;
        let cad2Changed = false;
        if (this.entities.find(e.entity1.id)) {
          e.cad1 = this.name;
          cad1Changed = true;
        }
        if (this.entities.find(e.entity2.id)) {
          e.cad2 = this.name;
          cad2Changed = true;
        }
        if (!(cad1Changed && cad2Changed)) {
          for (const child of children) {
            if (!cad1Changed && child.findEntity(e.entity1.id)) {
              e.cad1 = child.name;
              cad1Changed = true;
              break;
            }
            if (!cad2Changed && child.findEntity(e.entity2.id)) {
              e.cad2 = child.name;
              cad2Changed = true;
              break;
            }
          }
        }
      }
    });

    this.partners.forEach((v) => v.updateDimensions(this.entities.dimension));
    this.components.data.forEach((v) => v.updateDimensions(this.entities.dimension));
    return this;
  }

  assembleComponents(connection: CadConnection, accuracy = 1) {
    const {ids, lines, space, position, value} = connection;
    const components = this.components;
    let c1: CadData | undefined;
    let c2: CadData | undefined;
    for (const c of components.data) {
      if (c.id === ids[0]) {
        c1 = c;
      }
      if (c.id === ids[1]) {
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
      lines.unshift(lines.pop() as string);
      ids.unshift(ids.pop() as string);
    }
    let axis: "x" | "y" | undefined;
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
    const translate = new Point();
    if (position === "absolute") {
      const spaceNum = Number(space);
      const e1 = c1.findEntity(lines[0]);
      const e2 = c2.findEntity(lines[1]);
      let l1: CadLine | undefined;
      let l2: CadLine | undefined;
      if (e1 && e2) {
        if (e1 instanceof CadLine) {
          l1 = e1;
        }
        if (e2 instanceof CadLine) {
          l2 = e2;
        }
        if (!l1 && l2) {
          l1 = getLine(e1 as CadCircle, l2);
        }
        if (!l2 && l1) {
          l2 = getLine(e2 as CadCircle, l1);
        }
      }
      if (!l1 || !l2) {
        if (typeof value === "number") {
          const rect1 = c1.getBoundingRect();
          const rect2 = c2.getBoundingRect();
          axis = connection.axis;
          if (axis === "x") {
            translate.x = rect1.left - value - rect2.left;
          } else if (axis === "y") {
            translate.y = rect1.top - value - rect2.top;
          }
        } else {
          throw new Error("未找到对应直线");
        }
      } else {
        if (isLinesParallel([l1, l2], accuracy)) {
          if (l1.isVertical(accuracy)) {
            translate.x = l1.start.x - l2.start.x + spaceNum;
            axis = "x";
          } else if (l1.isHorizontal(accuracy)) {
            translate.y = l1.start.y - l2.start.y + spaceNum;
            axis = "y";
          } else {
            throw new Error("两条线不是横线或者竖线");
          }
        } else {
          throw new Error("两条线不平行");
        }
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
      let l3: CadLine | undefined;
      if (e3 instanceof CadLine) {
        l3 = e3;
      }
      if (e3 instanceof CadCircle) {
        l3 = getLine(e3, l1);
      }
      if (!l3) {
        throw new Error("缺少第三条线");
      }
      if (!isLinesParallel([l1, l2, l3], accuracy)) {
        throw new Error("三条线必须相互平行");
      }
      const tmpData = new CadData();
      tmpData.entities = c2.entities;
      const rect = tmpData.getBoundingRect();
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

    const toRemove: number[] = [];
    const connectedToC1: string[] = [];
    const connectedToC2: string[] = [];
    if (!c1 || !c2) {
      throw new Error("计算出错");
    }
    for (const conn of components.connections) {
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
    }
    if (!axis) {
      throw new Error("无法计算方向");
    }
    connection.axis = axis;
    connection.space = connection.space ? connection.space : "0";
    const connectedToBoth = intersection(connectedToC1, connectedToC2);
    for (let i = 0; i < components.connections.length; i++) {
      const conn = components.connections[i];
      const arr = intersection(conn.ids, [c1.id, c2.id, this.id]);
      if (conn.ids.includes(c2.id) && intersection(conn.ids, connectedToBoth).length) {
        toRemove.push(i);
      }
      if (arr.length === 2 && conn.axis === axis) {
        toRemove.push(i);
      }
    }
    components.connections = components.connections.filter((v, i) => !toRemove.includes(i));
    this.moveComponent(c2, translate, true, c1);
    components.connections.push(cloneDeep(connection));
    return this;
  }

  sortComponents() {
    this.components.data.sort((a, b) => {
      const rect1 = a.getBoundingRect();
      const rect2 = b.getBoundingRect();
      return rect1.x - rect2.x + rect2.y - rect1.y;
    });
  }

  moveComponent(curr: CadData, translate: Point, alter: boolean, prev?: CadData) {
    const map: ObjectOf<any> = {};
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
    curr.transform({translate}, alter);
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
        this.moveComponent(next, newTranslate, alter, curr);
      }
    }
  }

  directAssemble(component: CadData, accuracy = 1) {
    const rect1 = this.entities.getBoundingRect();
    const rect2 = component.getBoundingRect();
    ["x", "y"].forEach((axis) => {
      const conn = new CadConnection({axis, position: "absolute"});
      conn.ids = [this.id, component.id];
      conn.names = [this.name, component.name];
      if (axis === "x") {
        conn.value = rect1.left - rect2.left;
      }
      if (axis === "y") {
        conn.value = rect1.top - rect2.top;
      }
      this.assembleComponents(conn, accuracy);
    });
  }

  getDimensionPoints(dimension: CadDimension) {
    return this.getAllEntities().getDimensionPoints(dimension);
  }

  getBoundingRect(recursive = true) {
    return this.getAllEntities().getBoundingRect(recursive);
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

export class CadConnection {
  ids: string[];
  names: string[];
  lines: string[];
  space: string;
  position: "absolute" | "relative";
  axis: "x" | "y";
  value: number;

  constructor(data: any = {}) {
    this.ids = Array.isArray(data.ids) ? data.ids : [];
    this.names = Array.isArray(data.names) ? data.names : [];
    this.lines = Array.isArray(data.lines) ? data.lines : [];
    this.space = data.space || "0";
    this.position = data.position || "absolute";
    this.axis = data.axis || "x";
    this.value = data.value ?? 0;
  }

  export(): ObjectOf<any> {
    return purgeObject({
      ids: this.ids,
      names: this.names,
      lines: this.lines,
      space: this.space,
      position: this.position,
      axis: this.axis,
      value: this.value
    });
  }
}
export class CadComponents {
  data: CadData[];
  connections: CadConnection[];
  constructor(data: ObjectOf<any> = {}) {
    if (getTypeOf(data) !== "object") {
      data = {};
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

  transform(matrix: MatrixLike, alter = false) {
    const m = new Matrix(matrix);
    const [scaleX, scaleY] = m.scale();
    if (scaleX === undefined || scaleY === undefined) {
      return;
    }
    this.connections.forEach((v) => {
      if ((scaleX < 0 && v.axis === "x") || (scaleY && v.axis === "y")) {
        const space = -Number(v.space);
        if (!isNaN(space)) {
          v.space = space.toString();
        }
      }
    });
    this.data.forEach((v) => v.transform(matrix, alter));
  }

  export(): ObjectOf<any> {
    const data: any[] = [];
    const connections: any[] = [];
    this.data.forEach((v) => data.push(v.export()));
    this.connections.forEach((v) => connections.push(v.export()));
    return purgeObject({data, connections});
  }
}

export type FlipType = "" | "v" | "h" | "vh";

export class CadZhankai {
  zhankaikuan: string;
  zhankaigao: string;
  shuliang: string;
  shuliangbeishu: string;
  name: string;
  kailiaomuban: string;
  neikaimuban: string;
  kailiao: boolean;
  conditions: string[];
  chai: boolean;
  flip: {kaiqi: string; chanpinfenlei: string; fanzhuanfangshi: FlipType}[];
  flipChai: ObjectOf<FlipType>;
  neibugongshi: ObjectOf<string>;
  包边正面按分类拼接?: string;

  constructor(data: ObjectOf<any> = {}) {
    if (getTypeOf(data) !== "object") {
      data = {};
    }
    this.zhankaikuan = data.zhankaikuan ?? "ceil(总长)+0";
    this.zhankaigao = data.zhankaigao ?? "";
    this.shuliang = data.shuliang ?? "1";
    this.shuliangbeishu = data.shuliangbeishu ?? "1";
    this.kailiaomuban = data.kailiaomuban ?? "";
    this.neikaimuban = data.neikaimuban ?? "";
    this.name = data.name ?? "";
    this.kailiao = data.kailiao === false ? false : true;
    if (Array.isArray(data.conditions)) {
      this.conditions = data.conditions.map((v) => v ?? "");
    } else {
      this.conditions = [];
    }
    this.chai = data.chai ?? false;
    this.flip = [];
    if (Array.isArray(data.flip)) {
      data.flip.forEach((v) => {
        const item: CadZhankai["flip"][0] = {
          kaiqi: v.kaiqi ?? "",
          chanpinfenlei: v.chanpinfenlei ?? "",
          fanzhuanfangshi: v.fanzhuanfangshi ?? ""
        };
        if (v.fanzhuan === true) {
          item.fanzhuanfangshi = "h";
        }
        this.flip.push(item);
      });
    }
    this.flipChai = getObject(data.flipChai);
    this.neibugongshi = getObject(data.neibugongshi);
    if (data.包边正面按分类拼接) {
      this.包边正面按分类拼接 = data.包边正面按分类拼接;
    }
  }

  export() {
    const result: ObjectOf<any> = cloneDeep({
      zhankaikuan: this.zhankaikuan,
      zhankaigao: this.zhankaigao,
      shuliang: this.shuliang,
      shuliangbeishu: this.shuliangbeishu,
      name: this.name,
      kailiaomuban: this.kailiaomuban,
      neikaimuban: this.neikaimuban,
      kailiao: this.kailiao,
      conditions: this.conditions,
      chai: this.chai,
      flip: this.flip,
      flipChai: this.flipChai,
      neibugongshi: this.neibugongshi
    });
    if (this.包边正面按分类拼接) {
      result.包边正面按分类拼接 = this.包边正面按分类拼接;
    }
    return purgeObject(result);
  }
}
