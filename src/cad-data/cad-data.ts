import {keysOf, Matrix, MatrixLike, ObjectOf, Point} from "@utils";
import {cloneDeep, uniqWith, intersection} from "lodash";
import {v4} from "uuid";
import {getArray, getObject, mergeArray, mergeObject, separateArray, separateObject, getVectorFromArray, purgeObject} from "../cad-utils";
import {CadEntities, getCadEntity} from "./cad-entities";
import {CadCircle, CadDimension, CadEntity, CadLine} from "./cad-entity";
import {CadLayer} from "./cad-layer";
import {isLinesParallel} from "./cad-lines";

export interface CadDataInfo {
    [key: string]: any;
    唯一码?: string;
    修改包边正面宽规则?: string;
    锁边自动绑定可搭配铰边?: string;
    version?: CadVersion;
    vars?:ObjectOf<string>;
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

export class CadData {
    entities = new CadEntities();
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
    bianxingfangshi: "自由" | "高比例变形" | "宽比例变形" | "宽高比例变形" = "自由";
    bancaiwenlifangxiang: "垂直" | "水平" | "不限" | "指定垂直" | "指定水平" | "指定不限" = "垂直";
    huajianwenlifangxiang?: "垂直" | "水平" = "垂直";
    kailiaopaibanfangshi: "自动排版" | "不排版" | "必须排版" = "自动排版";
    morenkailiaobancai = "";
    gudingkailiaobancai = "";
    suanliaochuli: "算料+显示展开+开料" | "算料+开料" | "算料+显示展开" | "算料" = "算料+显示展开+开料";
    showKuandubiaozhu = false;
    info: CadDataInfo = {};
    attributes: ObjectOf<string> = {};
    bancaihoudufangxiang: "none" | "gt0" | "lt0" = "none";
    zhankai: CadZhankai[] = [];
    suanliaodanxianshibancai = true;
    needsHuajian = true;
    kedulibancai = false;
    shuangxiangzhewan = false;
    suanliaodanxianshi = "展开宽+展开高+板材";
    zhidingweizhipaokeng: string[][] = [];
    suanliaodanZoom = 1.5;
    企料前后宽同时改变 = true;
    主CAD = false;
    算料单展开显示位置: "CAD上面" | "CAD下面" = "CAD下面";
    属于门框门扇: "未区分" | "门框" | "门扇" = "未区分";
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

    constructor(data?: ObjectOf<any>) {
        this.init(data);
    }

    init(data?: ObjectOf<any>) {
        if (typeof data !== "object") {
            data = {};
        }
        this.id = data.id ?? v4();
        this.numId = data.numId ?? 0;
        this.name = data.name ?? "";
        this.xianshimingzi = data.xianshimingzi ?? "";
        this.type = data.type ?? "";
        this.type2 = data.type2 ?? "";
        this.layers = [];
        if (typeof data.layers === "object") {
            for (const id in data.layers) {
                this.layers.push(new CadLayer(data.layers[id]));
            }
        } else {
            this.layers = [];
        }
        this.entities = new CadEntities(data.entities || {}, this.layers);
        this.entities.root = this;
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
        this.conditions = getArray(data.conditions);
        this.options = getObject(data.options);
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
        this.components = new CadComponents(getObject(data.components));
        this.updateComponents();
        this.huajian = data.huajian ?? "";
        this.xinghaohuajian = getObject(data.xinghaohuajian);
        this.mubanfangda = data.mubanfangda ?? true;
        this.kailiaoshibaokeng = data.kailiaoshibaokeng ?? false;
        this.bianxingfangshi = data.bianxingfangshi ?? "自由";
        this.bancaiwenlifangxiang = data.bancaiwenlifangxiang ?? "垂直";
        this.huajianwenlifangxiang = data.huajianwenlifangxiang;
        this.kailiaopaibanfangshi = data.kailiaopaibanfangshi ?? "自动排版";
        this.morenkailiaobancai = data.morenkailiaobancai ?? "";
        this.gudingkailiaobancai = data.gudingkailiaobancai ?? "";
        this.suanliaochuli = data.suanliaochuli ?? "算料+显示展开+开料";
        this.showKuandubiaozhu = data.showKuandubiaozhu ?? false;
        this.info = getObject(data.info);
        this.attributes = getObject(data.attributes);
        this.bancaihoudufangxiang = data.bancaihoudufangxiang ?? "none";
        if (Array.isArray(data.zhankai) && data.zhankai.length > 0) {
            this.zhankai = data.zhankai.map((v) => new CadZhankai(v));
        } else {
            this.zhankai = [new CadZhankai()];
        }
        if (data.kailiaomuban && !this.zhankai[0].kailiaomuban) {
            this.zhankai[0].kailiaomuban = data.kailiaomuban;
        }
        this.suanliaodanxianshibancai = data.suanliaodanxianshibancai ?? true;
        this.needsHuajian = data.needsHuajian ?? true;
        this.kedulibancai = data.kedulibancai ?? false;
        this.shuangxiangzhewan = data.shuangxiangzhewan ?? false;
        this.suanliaodanxianshi = data.suanliaodanxianshi ?? "展开宽+展开高+板材";
        this.zhidingweizhipaokeng = data.zhidingweizhipaokeng ?? [];
        this.suanliaodanZoom = data.suanliaodanZoom ?? 1.5;
        this.企料前后宽同时改变 = data.企料前后宽同时改变 ?? true;
        this.主CAD = data.主CAD ?? false;
        this.算料单展开显示位置 = data.算料单展开显示位置 ?? "CAD下面";
        this.属于门框门扇 = data.属于门框门扇 ?? "未区分";
        this.内开做分体 = data.内开做分体 ?? false;
        this.板材绑定选项 = data.板材绑定选项 ?? "";
        this.算料单线长显示的最小长度 = data.算料单线长显示的最小长度 ?? null;
        this.检查企料厚度 = data.检查企料厚度 ?? true;
        this.对应门扇厚度 = data.对应门扇厚度 ?? 0;
        this.跟随CAD开料板材 = data.跟随CAD开料板材 ?? null;
        this.算料特殊要求 = data.算料特殊要求 ?? null;
        this.正面宽差值 = data.正面宽差值 ?? 0;
        this.墙厚差值 = data.墙厚差值 ?? 0;
        this.企料翻转 = data.企料翻转 ?? false;
        this.装配位置 = data.装配位置 ?? "";
        this.企料包边门框配合位增加值 = data.企料包边门框配合位增加值 ?? 0;
        this.updateDimensions();
        return this;
    }

    copy(data: CadData) {
        return this.init(data);
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
        return purgeObject({
            layers: exLayers,
            entities: this.entities.export(),
            blocks,
            id: this.id,
            numId: this.numId,
            name: this.name,
            xianshimingzi: this.xianshimingzi,
            type: this.type,
            type2: this.type2,
            conditions: this.conditions.filter((v) => v),
            options,
            baseLines: this.baseLines.map((v) => v.export()).filter((v) => v.name && v.idX && v.idY),
            jointPoints: this.jointPoints.map((v) => v.export()),
            parent: this.parent,
            partners: this.partners.map((v) => v.export()),
            components: this.components.export(),
            huajian: this.huajian,
            xinghaohuajian: this.xinghaohuajian,
            mubanfangda: this.mubanfangda,
            kailiaoshibaokeng: this.kailiaoshibaokeng,
            bianxingfangshi: this.bianxingfangshi,
            bancaiwenlifangxiang: this.bancaiwenlifangxiang,
            huajianwenlifangxiang: this.huajianwenlifangxiang,
            kailiaopaibanfangshi: this.kailiaopaibanfangshi,
            morenkailiaobancai: this.morenkailiaobancai,
            gudingkailiaobancai: this.gudingkailiaobancai,
            suanliaochuli: this.suanliaochuli,
            showKuandubiaozhu: this.showKuandubiaozhu,
            info: this.info,
            attributes: this.attributes,
            bancaihoudufangxiang: this.bancaihoudufangxiang,
            zhankai: this.zhankai.map((v) => v.export()),
            suanliaodanxianshibancai: this.suanliaodanxianshibancai,
            needsHuajian: this.needsHuajian,
            kedulibancai: this.kedulibancai,
            shuangxiangzhewan: this.shuangxiangzhewan,
            suanliaodanxianshi: this.suanliaodanxianshi,
            zhidingweizhipaokeng: this.zhidingweizhipaokeng,
            suanliaodanZoom: this.suanliaodanZoom,
            企料前后宽同时改变: this.企料前后宽同时改变,
            主CAD: this.主CAD,
            算料单展开显示位置: this.算料单展开显示位置,
            属于门框门扇: this.属于门框门扇,
            内开做分体: this.内开做分体,
            板材绑定选项: this.板材绑定选项,
            算料单线长显示的最小长度: this.算料单线长显示的最小长度,
            检查企料厚度: this.检查企料厚度,
            对应门扇厚度: this.对应门扇厚度,
            跟随CAD开料板材: this.跟随CAD开料板材,
            算料特殊要求: this.算料特殊要求,
            正面宽差值: this.正面宽差值,
            墙厚差值: this.墙厚差值,
            企料翻转: this.企料翻转,
            装配位置: this.装配位置,
            企料包边门框配合位增加值: this.企料包边门框配合位增加值
        });
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
        const data = new CadData(this.export());
        if (resetIds) {
            data.layers.forEach((v) => (v.id = v4()));
            for (const name in data.blocks) {
                data.blocks[name].forEach((v) => (v.id = v4()));
            }
            data.entities = data.entities.clone(true);
            data.partners = data.partners.map((v) => v.clone(true));
            data.components.data = data.components.data.map((v) => v.clone(true));
        }
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
        return this;
    }

    merge(data: CadData) {
        this.layers = this.layers.concat(data.layers);
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
        const rect1 = this.getBoundingRect();
        if (rect1.width && rect1.height) {
            const rect2 = component.getBoundingRect();
            const translate = new Point(rect1.x - rect2.x, rect1.y - rect2.y);
            const matrix = new Matrix();
            if (Math.abs(translate.x) > 1500 || Math.abs(translate.y) > 1500) {
                translate.x += (rect1.width + rect2.width) / 2 + 15;
                matrix.transform({translate});
            }
            component.transform(matrix, true);
        }
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
            if (e.mingzi === "宽度标注") {
                e.distance2 = rect.y + rect.height / 2 + 40;
            }
        });
        this.entities.dimension = tmp;

        const children = [...this.partners, ...this.components.data];
        this.entities.dimension.forEach((e) => {
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
        this.moveComponent(c2, translate, c1, true);
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

    moveComponent(curr: CadData, translate: Point, prev?: CadData, alter = false) {
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
                this.moveComponent(next, newTranslate, curr, alter);
            }
        }
    }

    directAssemble(component: CadData, accuracy = 1) {
        ["x", "y"].forEach((axis) => {
            const conn = new CadConnection({axis, position: "absolute"});
            conn.ids = [this.id, component.id];
            conn.names = [this.name, component.name];
            const rect1 = this.entities.getBoundingRect();
            const rect2 = component.getBoundingRect();
            const p1 = [rect1.left, rect1.top];
            const p2 = [rect2.left, rect2.top];
            if (axis === "x") {
                conn.value = p1[0] - p2[0];
            }
            if (axis === "y") {
                conn.value = p1[1] - p2[1];
            }
            this.assembleComponents(conn, accuracy);
        });
    }

    getDimensionPoints(dimension: CadDimension) {
        return this.getAllEntities().getDimensionPoints(dimension);
    }

    getBoundingRect() {
        return this.getAllEntities().getBoundingRect();
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

    constructor(data: ObjectOf<any> = {}) {
        if (typeof data !== "object") {
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
    }

    export() {
        return cloneDeep({
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
    }
}
