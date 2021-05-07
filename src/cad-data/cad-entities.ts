import {Angle, Arc, index2RGB, Line, Matrix, MatrixLike, ObjectOf, Point, Rectangle, RGB2Index} from "@lucilor/utils";
import {G, Matrix as Matrix2, Svg} from "@svgdotjs/svg.js";
import Color from "color";
import {cloneDeep} from "lodash";
import {v4} from "uuid";
import {lineweight2linewidth, linewidth2lineweight, getVectorFromArray, mergeArray, separateArray} from "../utils";
import {CadLayer} from "./cad-layer";
import {cadTypesKey, CadTypeKey, CadType, cadTypes} from "./cad-types";

export const DEFAULT_LENGTH_TEXT_SIZE = 24;

export abstract class CadEntity {
    id: string;
    type: CadType = "";
    layer: string;
    color: Color;
    info: ObjectOf<any>;
    _indexColor: number | null;
    parent?: CadEntity;
    children: CadEntities;
    el?: G | null;
    needsUpdate = false;
    calcBoundingPoints = true;
    abstract get boundingPoints(): Point[];
    root?: CadEntities;

    get scale() {
        if (this.el) {
            for (const parent of this.el.parents()) {
                if (parent instanceof Svg) {
                    return (parent as any).zoom();
                }
            }
        }
        return NaN;
    }

    private _selectable?: boolean;
    get selectable() {
        if (this.el) {
            return this.el.hasClass("selectable");
        } else {
            return typeof this._selectable === "boolean" ? this._selectable : false;
        }
    }
    set selectable(value) {
        if (this.el) {
            if (value) {
                this.el.addClass("selectable");
            } else {
                this.el.removeClass("selectable");
            }
        } else {
            this._selectable = value;
        }
        this.children.forEach((c) => (c.selectable = value));
    }

    private _selected?: boolean;
    get selected() {
        if (this.el) {
            return this.el.hasClass("selected") && this.selectable;
        } else {
            return typeof this._selected === "boolean" ? this._selected : false;
        }
    }
    set selected(value) {
        if (this.el) {
            if (value && this.selectable) {
                this.el.addClass("selected");
                this.el.children().forEach((c, i) => {
                    if (c.hasClass("stroke")) {
                        if (this instanceof CadDimension) {
                            if (this.renderStyle === 1) {
                                c.css("stroke-dasharray", "20, 7");
                            } else if (this.renderStyle === 2 && i === 2) {
                                c.css("stroke-dasharray", "20, 7");
                            }
                        } else {
                            c.css("stroke-dasharray", "20, 7");
                        }
                    }
                    if (this instanceof CadDimension) {
                        // pass
                    } else {
                        if (c.hasClass("fill")) {
                            c.css("fill", "#ffca1c");
                        }
                    }
                });
            } else {
                this.el.removeClass("selected").css("stroke-dasharray", "");
                this.el.children().forEach((c) => {
                    c.css("stroke-dasharray", "");
                    c.css("fill", "");
                });
            }
        } else {
            this._selected = value;
        }
        this.children.forEach((c) => (c.selected = value));
    }

    private _opacity?: number;
    get opacity() {
        if (this.el) {
            return Number(this.el.css("opacity") ?? 1);
        } else {
            return typeof this._opacity === "number" ? this._opacity : 0;
        }
    }
    set opacity(value) {
        if (this.el) {
            this.el.css("opacity", value);
        } else {
            this._opacity = value;
        }
        this.children.forEach((c) => (c.opacity = value));
    }

    private _visible?: boolean;
    get visible() {
        if (this.el) {
            return this.el.css("display") !== "none";
        } else {
            return typeof this._visible === "boolean" ? this._visible : true;
        }
    }
    set visible(value) {
        if (this.el) {
            this.el.css("display", value ? "" : "none");
        } else {
            this._visible = value;
        }
        this.children.forEach((c) => (c.visible = value));
    }

    constructor(data: any = {}, layers: CadLayer[] = [], resetId = false) {
        if (typeof data !== "object") {
            throw new Error("Invalid data.");
        }
        if (cadTypes.includes(data.type)) {
            this.type = data.type;
        }
        if (typeof data.id === "string" && !resetId) {
            this.id = data.id;
        } else {
            this.id = v4();
        }
        this.layer = data.layer ?? "0";
        this.color = new Color();
        if (typeof data.color === "number") {
            this._indexColor = data.color;
            if (data.color === 256) {
                const layer = layers.find((l) => l.name === this.layer);
                if (layer) {
                    this.color = new Color(layer.color);
                }
            } else {
                this.color = new Color(index2RGB(data.color, "num"));
            }
        } else {
            if (data.color instanceof Color) {
                this.color = new Color(data.color);
            }
            this._indexColor = RGB2Index(this.color.hex());
        }
        if (typeof data.info === "object" && !Array.isArray(data.info)) {
            this.info = cloneDeep(data.info);
        } else {
            this.info = {};
        }
        this.children = new CadEntities(data.children || {}, [], false);
        this.children.forEach((c) => (c.parent = this));
        this.selectable = data.selectable ?? true;
        this.selected = data.selected ?? false;
        if (data.parent instanceof CadEntity) {
            this.parent = data.parent;
        }
        this.visible = data.visible ?? true;
        this.opacity = data.opacity ?? 1;
    }

    transform(matrix: MatrixLike, alter = false, _parent?: CadEntity) {
        this.el?.attr("stroke", "red");
        if (!alter) {
            if (this.el) {
                const oldMatrix = new Matrix2(this.el.transform());
                this.el.transform(oldMatrix.transform(new Matrix(matrix)));
            }
            this.needsUpdate = true;
        }
        this.children.forEach((e) => e.transform(matrix, alter, this));
        return this;
    }

    update() {
        if (this.el) {
            if (typeof this._selectable === "boolean") {
                this.selectable = this._selectable;
                delete this._selectable;
            }
            if (typeof this._selected === "boolean") {
                this.selected = this._selected;
                delete this._selected;
            }
            if (typeof this._opacity === "number") {
                this.opacity = this._opacity;
                delete this._opacity;
            }
            if (typeof this._visible === "boolean") {
                this.visible = this._visible;
                delete this._visible;
            }
            if (this.needsUpdate) {
                const newMatrix = new Matrix2(this.el.transform()).decompose();
                if (typeof newMatrix.rotate === "number") {
                    newMatrix.rotate = new Angle(newMatrix.rotate, "deg").rad;
                }
                this.transform(newMatrix, true);
                this.needsUpdate = false;
                this.el.transform({});
            }
        }
    }

    export(): ObjectOf<any> {
        this._indexColor = RGB2Index(this.color.hex());
        this.update();
        return cloneDeep({
            id: this.id,
            layer: this.layer,
            type: this.type,
            color: this._indexColor,
            children: this.children.export(),
            info: this.info
        });
    }

    addChild(...children: CadEntity[]) {
        children.forEach((e) => {
            if (e instanceof CadEntity) {
                e.parent = this;
                this.children.add(e);
            }
        });
        return this;
    }

    removeChild(...children: CadEntity[]) {
        children.forEach((e) => {
            if (e instanceof CadEntity) {
                this.children.remove(e);
            }
        });
        return this;
    }

    remove() {
        this.el?.remove();
        this.el = null;
        this.parent?.removeChild(this);
        return this;
    }

    abstract clone(resetId?: boolean): CadEntity;

    equals(entity: CadEntity) {
        const info1 = this.export();
        const info2 = entity.export();
        delete info1.id;
        delete info2.id;
        return JSON.stringify(info1) === JSON.stringify(info2);
    }

    // abstract getBoundingRect(): Rectangle;
}

export abstract class CadLineLike extends CadEntity {
    abstract get start(): Point;
    abstract get end(): Point;
    abstract get middle(): Point;
    abstract get length(): number;
    swapped: boolean;
    linewidth: number;
    _lineweight: number;
    mingzi: string;
    qujian: string;
    gongshi: string;
    hideLength: boolean;
    lengthTextSize: number;
    nextZhewan: "自动" | "无" | "1mm" | "6mm";
    betweenZhewan: "自动" | "无" | "1mm" | "6mm";
    zhewanOffset: number;
    zhewanValue: number;
    zidingzhankaichang: string;
    zhankaifangshi: "自动计算" | "使用线长" | "指定长度";
    zhankaixiaoshuchuli: "不处理" | "舍去小数" | "小数进一" | "四舍五入";
    kailiaoshishanchu: boolean;

    constructor(data: any = {}, layers: CadLayer[] = [], resetId = false) {
        super(data, layers, resetId);
        this.swapped = data.swapped === true;
        this.mingzi = data.mingzi ?? "";
        this.qujian = data.qujian ?? "";
        this.gongshi = data.gongshi ?? "";
        this.hideLength = data.hideLength === true;
        this.lengthTextSize = data.lengthTextSize ?? DEFAULT_LENGTH_TEXT_SIZE;
        this.nextZhewan = data.nextZhewan ?? "自动";
        this.betweenZhewan = data.betweenZhewan ?? "自动";
        this.zhewanOffset = data.zhewanOffset ?? 0;
        this.zhewanValue = data.zhewanValue ?? 0;
        this.zidingzhankaichang = data.zidingzhankaichang ?? "";
        if (typeof data.kailiaofangshi === "string" && data.kailiaofangshi) {
            this.zhankaifangshi = data.kailiaofangshi;
        } else if (typeof data.zhankaifangshi === "string") {
            this.zhankaifangshi = data.zhankaifangshi;
        } else {
            const zidingzhankaichangNum = Number(this.zidingzhankaichang);
            if (!isNaN(zidingzhankaichangNum) && zidingzhankaichangNum > 0) {
                this.zhankaifangshi = "指定长度";
            } else {
                this.zhankaifangshi = "自动计算";
            }
        }
        this.zhankaixiaoshuchuli = data.zhankaixiaoshuchuli ?? "不处理";
        this.kailiaoshishanchu = !!data.kailiaoshishanchu;
        this.linewidth = data.linewidth ?? 1;
        this._lineweight = -3;
        if (typeof data.lineweight === "number") {
            this._lineweight = data.lineweight;
            if (data.lineweight >= 0) {
                this.linewidth = lineweight2linewidth(data.lineweight);
            } else if (data.lineweight === -1) {
                const layer = layers.find((l) => l.name === this.layer);
                if (layer) {
                    this.linewidth = layer.linewidth;
                }
            }
        }
    }

    export(): ObjectOf<any> {
        return {
            ...super.export(),
            lineweight: linewidth2lineweight(this.linewidth),
            mingzi: this.mingzi,
            qujian: this.qujian,
            gongshi: this.gongshi,
            hideLength: this.hideLength,
            lengthTextSize: this.lengthTextSize,
            nextZhewan: this.nextZhewan,
            betweenZhewan: this.betweenZhewan,
            zhewanOffset: this.zhewanOffset,
            zhewanValue: this.zhewanValue,
            zidingzhankaichang: this.zidingzhankaichang,
            zhankaifangshi: this.zhankaifangshi,
            zhankaixiaoshuchuli: this.zhankaixiaoshuchuli,
            kailiaoshishanchu: this.kailiaoshishanchu
        };
    }
}

export class CadArc extends CadLineLike {
    center: Point;
    radius: number;
    start_angle: number;
    end_angle: number;
    clockwise: boolean;

    get start() {
        return this.curve.getPoint(0);
    }
    get end() {
        return this.curve.getPoint(1);
    }
    get middle() {
        return this.curve.getPoint(0.5);
    }
    get curve() {
        const {center, radius, start_angle, end_angle, clockwise} = this;
        return new Arc(center, radius, new Angle(start_angle, "deg"), new Angle(end_angle, "deg"), clockwise);
    }
    get length() {
        return this.curve.length;
    }
    get boundingPoints() {
        const curve = this.curve;
        const result: Point[] = [];
        if (curve.radius) {
            result.push(curve.getPoint(0), curve.getPoint(0.5), curve.getPoint(1));
        }
        return result;
    }

    constructor(data: any = {}, layers: CadLayer[] = [], resetId = false) {
        super(data, layers, resetId);
        this.type = "ARC";
        this.center = getVectorFromArray(data.center);
        this.radius = data.radius ?? 0;
        this.start_angle = data.start_angle ?? 0;
        this.end_angle = data.end_angle ?? 0;
        this.clockwise = data.clockwise ?? false;
    }

    transform(matrix: MatrixLike, alter = false, parent?: CadEntity) {
        matrix = new Matrix(matrix);
        super.transform(matrix, alter, parent);
        if (alter) {
            const curve = this.curve;
            curve.transform(matrix);
            this.center = curve.center;
            this.radius = curve.radius;
            this.start_angle = curve.startAngle.deg;
            this.end_angle = curve.endAngle.deg;
            const [scaleX, scaleY] = matrix.scale();
            if (scaleX && scaleY && scaleX * scaleY < 0) {
                this.clockwise = !this.clockwise;
            }
        }
        return this;
    }

    export(): ObjectOf<any> {
        return {
            ...super.export(),
            center: this.center.toArray(),
            radius: this.radius,
            start_angle: this.start_angle,
            end_angle: this.end_angle,
            clockwise: this.clockwise
        };
    }

    clone(resetId = false) {
        return new CadArc(this, [], resetId);
    }

    equals(entity: CadArc) {
        return this.curve.equals(entity.curve);
    }
}

export class CadCircle extends CadEntity {
    center: Point;
    radius: number;

    get curve() {
        const {center, radius} = this;
        return new Arc(center, radius, new Angle(0, "deg"), new Angle(360, "deg"), true);
    }
    get length() {
        return this.curve.length;
    }
    get boundingPoints() {
        const {center, radius} = this;
        const p1 = center.clone().add(radius);
        const p2 = center.clone().sub(radius);
        return [p1, p2];
    }

    constructor(data: any = {}, layers: CadLayer[] = [], resetId = false) {
        super(data, layers, resetId);
        this.type = "CIRCLE";
        this.center = getVectorFromArray(data.center);
        this.radius = data.radius ?? 0;
    }

    transform(matrix: Matrix, alter = false, parent?: CadEntity) {
        super.transform(matrix, alter, parent);
        if (alter) {
            this.center.transform(matrix);
        }
        return this;
    }

    export(): ObjectOf<any> {
        return {
            ...super.export(),
            center: this.center.toArray(),
            radius: this.radius
        };
    }

    clone(resetId = false) {
        return new CadCircle(this, [], resetId);
    }

    equals(entity: CadCircle) {
        return this.radius === entity.radius && this.center.equals(entity.center);
    }
}

export interface CadDimensionEntity {
    id: string;
    location: "start" | "end" | "center" | "min" | "max" | "minX" | "maxX" | "minY" | "maxY";
    defPoint?: number[];
}

export class CadDimension extends CadEntity {
    font_size: number;
    dimstyle: string;
    axis: "x" | "y";
    entity1: CadDimensionEntity;
    entity2: CadDimensionEntity;
    distance: number;
    distance2?: number;
    cad1: string;
    cad2: string;
    mingzi: string;
    qujian: string;
    ref?: "entity1" | "entity2" | "minX" | "maxX" | "minY" | "maxY" | "minLength" | "maxLength";
    quzhifanwei: string;
    xianshigongshiwenben: string;

    private _renderStyle = 1;
    get renderStyle() {
        return this._renderStyle;
    }
    set renderStyle(value) {
        if (this._renderStyle !== value) {
            this.el?.remove();
            this.el = null;
        }
        this._renderStyle = value;
    }

    private _hideDimLines = false;
    get hideDimLines() {
        return this._hideDimLines;
    }
    set hideDimLines(value) {
        if (this._hideDimLines !== value) {
            this.el?.remove();
            this.el = null;
        }
        this._hideDimLines = value;
    }

    get boundingPoints() {
        if (this.root) {
            return this.root.getDimensionPoints(this);
        }
        return [];
    }

    constructor(data: any = {}, layers: CadLayer[] = [], resetId = false) {
        super(data, layers, resetId);
        this.type = "DIMENSION";
        this.font_size = data.font_size || 16;
        if (this.font_size === 2.5) {
            this.font_size = 36;
        }
        this.dimstyle = data.dimstyle || "";
        this.entity1 = {id: "", location: "center"};
        this.entity2 = {id: "", location: "center"};
        (["entity1", "entity2"] as ("entity1" | "entity2")[]).forEach((field) => {
            if (data[field]) {
                if (typeof data[field].id === "string") {
                    this[field].id = data[field].id;
                }
                this[field].location = data[field].location ?? "center";
            }
        });
        this.axis = data.axis ?? "x";
        this.distance = data.distance ?? 20;
        this.cad1 = data.cad1 ?? "";
        this.cad2 = data.cad2 ?? "";
        this.mingzi = data.mingzi ?? "";
        this.qujian = data.qujian ?? "";
        this.ref = data.ref ?? "entity1";
        this.quzhifanwei = data.quzhifanwei ?? "";
        this.renderStyle = data.renderStyle ?? 1;
        this.hideDimLines = data.hideDimLines === true;
        this.xianshigongshiwenben = data.xianshigongshiwenben ?? "";
    }

    transform(matrix: Matrix, alter = false, parent?: CadEntity) {
        super.transform(matrix, alter, parent);
        return this;
    }

    export(): ObjectOf<any> {
        return cloneDeep({
            ...super.export(),
            dimstyle: this.dimstyle,
            font_size: this.font_size,
            axis: this.axis,
            entity1: this.entity1,
            entity2: this.entity2,
            distance: this.distance,
            cad1: this.cad1,
            cad2: this.cad2,
            mingzi: this.mingzi,
            qujian: this.qujian,
            ref: this.ref,
            quzhifanwei: this.quzhifanwei,
            renderStyle: this.renderStyle,
            hideDimLines: this.hideDimLines,
            xianshigongshiwenben: this.xianshigongshiwenben
        });
    }

    clone(resetId = false) {
        return new CadDimension(this, [], resetId);
    }
}

export class CadHatch extends CadEntity {
    bgcolor: number[];
    paths: {
        edges: {
            start: Point;
            end: Point;
        }[];
        vertices: Point[];
    }[];

    get boundingPoints() {
        return [];
    }

    constructor(data: ObjectOf<any> = {}, layers: CadLayer[] = [], resetId = false) {
        super(data, layers, resetId);
        this.type = "HATCH";
        this.bgcolor = Array.isArray(data.bgcolor) ? data.bgcolor : [0, 0, 0];
        this.paths = [];
        if (Array.isArray(data.paths)) {
            data.paths.forEach((path) => {
                const edges: CadHatch["paths"][0]["edges"] = [];
                const vertices: CadHatch["paths"][0]["vertices"] = [];
                if (Array.isArray(path.edges)) {
                    path.edges.forEach((edge: any) => {
                        const start = getVectorFromArray(edge.start);
                        const end = getVectorFromArray(edge.end);
                        edges.push({start, end});
                    });
                }
                if (Array.isArray(path.vertices)) {
                    path.vertices.forEach((vertice: any) => {
                        vertices.push(getVectorFromArray(vertice));
                    });
                }
                this.paths.push({edges, vertices});
            });
        }
    }

    export(): ObjectOf<any> {
        const paths: any[] = [];
        this.paths.forEach((path) => {
            const edges: any[] = [];
            const vertices: any[] = [];
            path.edges.forEach((edge) => edges.push({start: edge.start.toArray(), end: edge.end.toArray()}));
            path.vertices.forEach((vertice) => vertices.push(vertice.toArray()));
            paths.push({edges, vertices});
        });
        return {...super.export(), paths};
    }

    transform(matrix: Matrix, alter = false, parent?: CadEntity) {
        super.transform(matrix, alter, parent);
        if (alter) {
            this.paths.forEach((path) => {
                path.edges.forEach((edge) => {
                    edge.start.transform(matrix);
                    edge.end.transform(matrix);
                });
                path.vertices.forEach((vertice) => vertice.transform(matrix));
            });
        }
        return this;
    }

    clone(resetId = false) {
        return new CadHatch(this, [], resetId);
    }
}

export class CadLine extends CadLineLike {
    start: Point;
    end: Point;
    guanlianbianhuagongshi: string;
    kongwei: string;
    tiaojianquzhi: {
        key: string;
        level: number;
        type: "选择" | "数值";
        data: {
            name: string;
            value: number;
            input: boolean;
        }[];
    }[];
    shiyongchazhi: string;

    get curve() {
        return new Line(this.start, this.end);
    }
    get length() {
        return this.curve.length;
    }
    get slope() {
        return this.curve.slope;
    }
    get theta() {
        return this.curve.theta;
    }
    get middle() {
        return this.curve.middle;
    }
    get maxX() {
        return Math.max(this.start.x, this.end.x);
    }
    get maxY() {
        return Math.max(this.start.y, this.end.y);
    }
    get minX() {
        return Math.min(this.start.x, this.end.x);
    }
    get minY() {
        return Math.min(this.start.y, this.end.y);
    }
    get boundingPoints() {
        return [this.start, this.end];
    }

    constructor(data: any = {}, layers: CadLayer[] = [], resetId = false) {
        super(data, layers, resetId);
        this.type = "LINE";
        this.start = getVectorFromArray(data.start);
        this.end = getVectorFromArray(data.end);
        this.guanlianbianhuagongshi = data.guanlianbianhuagongshi ?? "";
        this.kongwei = data.kongwei ?? "";
        this.tiaojianquzhi = data.tiaojianquzhi ?? [];
        this.tiaojianquzhi.forEach((v) => {
            if ((v.type as any) === "选项") {
                v.type = "选择";
            }
        });
        this.shiyongchazhi = data.shiyongchazhi ?? "";
    }

    transform(matrix: MatrixLike, alter = false, parent?: CadEntity) {
        super.transform(matrix, alter, parent);
        if (alter) {
            this.start.transform(matrix);
            this.end.transform(matrix);
        }
        return this;
    }

    export(): ObjectOf<any> {
        return {
            ...super.export(),
            start: this.start.toArray(),
            end: this.end.toArray(),
            guanlianbianhuagongshi: this.guanlianbianhuagongshi,
            kongwei: this.kongwei,
            tiaojianquzhi: this.tiaojianquzhi,
            shiyongchazhi: this.shiyongchazhi
        };
    }

    clone(resetId = false) {
        return new CadLine(this, [], resetId);
    }

    equals(entity: CadLine) {
        return this.curve.equals(entity.curve);
    }

    isVertical(accuracy = 0) {
        return Math.abs(this.start.x - this.end.x) <= accuracy;
    }

    isHorizontal(accuracy = 0) {
        return Math.abs(this.start.y - this.end.y) <= accuracy;
    }
}

export class CadMtext extends CadEntity {
    insert: Point;
    font_size: number;
    text: string;
    anchor: Point;
    fontFamily: string;
    fontWeight: string;

    get boundingPoints() {
        const rect = this.el?.node?.getBoundingClientRect();
        const {insert, anchor, scale} = this;
        if (rect && !isNaN(scale)) {
            const width = rect.width / scale;
            const height = rect.height / scale;
            const x = insert.x - anchor.x * width;
            const y = insert.y - (1 - anchor.y) * height;
            return [new Point(x, y), new Point(x + width, y + height)];
        }
        return [];
    }

    constructor(data: any = {}, layers: CadLayer[] = [], resetId = false) {
        super(data, layers, resetId);
        this.type = "MTEXT";
        this.insert = getVectorFromArray(data.insert);
        this.text = data.text ?? "";
        this.anchor = getVectorFromArray(data.anchor);
        this.fontFamily = data.fontFamily ?? "";
        this.fontWeight = data.fontWeight ?? "normal";
        if (this.text.includes("     ")) {
            this.font_size = 36;
            this.insert.y += 11;
            this.insert.x -= 4;
            this.text = this.text.replace("     ", "");
            this.fontFamily = "仿宋";
        } else {
            this.font_size = data.font_size ?? DEFAULT_LENGTH_TEXT_SIZE;
        }
    }

    export(): ObjectOf<any> {
        const anchor = this.anchor.toArray();
        return {
            ...super.export(),
            insert: this.insert.toArray(),
            font_size: this.font_size,
            text: this.text,
            anchor,
            fontFamily: this.fontFamily
        };
    }

    transform(matrix: Matrix, alter = false, parent?: CadEntity) {
        super.transform(matrix, alter, parent);
        if (alter) {
            this.insert.transform(matrix);
            const m = new Matrix(matrix);
            if (this.info.isLengthText || this.info.isGongshiText) {
                if (!Array.isArray(this.info.offset)) {
                    this.info.offset = [0, 0];
                }
                if (!parent) {
                    this.info.offset[0] += m.e;
                    this.info.offset[1] += m.f;
                }
            }
        }
        return this;
    }

    clone(resetId = false) {
        return new CadMtext(this, [], resetId);
    }

    equals(entity: CadMtext) {
        return (
            this.insert.equals(entity.insert) &&
            this.font_size === entity.font_size &&
            this.text === entity.text &&
            this.anchor.equals(entity.anchor)
        );
    }
}

export class CadSpline extends CadEntity {
    fitPoints: Point[] = [];
    controlPoints: Point[] = [];
    degree = 3;
    get boundingPoints() {
        return [];
    }

    constructor(data: any = {}, layers: CadLayer[] = [], resetId = false) {
        super(data, layers, resetId);
        if (Array.isArray(data.fitPoints)) {
            data.fitPoints.forEach((v: any) => this.fitPoints.push(getVectorFromArray(v)));
        }
        if (Array.isArray(data.controlPoints)) {
            data.controlPoints.forEach((v: any) => this.controlPoints.push(getVectorFromArray(v)));
        }
        if (typeof data.degree === "number") {
            this.degree = data.degree;
        }
    }

    export(): ObjectOf<any> {
        return {
            ...super.export(),
            fitPoints: this.fitPoints.map((v) => v.toArray()),
            controlPoints: this.controlPoints.map((v) => v.toArray()),
            degree: this.degree
        };
    }

    clone(resetId = false) {
        return new CadSpline(this, [], resetId);
    }
}

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
    }
    return entity as T;
};

export type AnyCadEntity = CadLine & CadMtext & CadDimension & CadArc & CadCircle & CadHatch & CadSpline;

export class CadEntities {
    line: CadLine[] = [];
    circle: CadCircle[] = [];
    arc: CadArc[] = [];
    mtext: CadMtext[] = [];
    dimension: CadDimension[] = [];
    hatch: CadHatch[] = [];
    spline: CadSpline[] = [];

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
        const result: ObjectOf<any> = {line: {}, circle: {}, arc: {}, mtext: {}, dimension: {}, hatch: {}, spline: {}, point: {}};
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
        return new CadEntities(this.export(), [], resetIds);
    }

    transform(matrix: MatrixLike, alter = false) {
        this.forEach((e) => e.transform(matrix, alter));
    }

    forEachType(callback: (array: CadEntity[], type: CadTypeKey, TYPE: CadType) => void) {
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
