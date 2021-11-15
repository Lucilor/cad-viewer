import {CoordinateXY, Element, G, SVG, Svg} from "@svgdotjs/svg.js";
import {calc, loadImage, ObjectOf, Point, SessionStorage} from "@utils";
import {EventEmitter} from "events";
import {cloneDeep} from "lodash";
import {CadData} from "./cad-data/cad-data";
import {CadEntities} from "./cad-data/cad-entities";
import {CadArc, CadCircle, CadDimension, CadEntity, CadHatch, CadLeader, CadLine, CadMtext, CadSpline} from "./cad-data/cad-entity";
import {CadInsert} from "./cad-data/cad-entity/cad-insert";
import {CadType, cadTypes} from "./cad-data/cad-types";
import {CadStyle, CadStylizer} from "./cad-stylizer";
import {getVectorFromArray, toFixedTrim} from "./cad-utils";
import {CadEventCallBack, CadEvents, controls} from "./cad-viewer-controls";
import {drawArc, drawArrow, drawCircle, drawDimension, drawLine, drawShape, drawText} from "./draw";

export interface CadViewerFont {
    name: string;
    url: string;
}

export interface CadViewerConfig {
    width: number; // 宽
    height: number; // 高
    backgroundColor: string; // 背景颜色, 写法与css相同
    padding: number[]; // 内容居中时的内边距, 写法与css相同
    reverseSimilarColor: boolean; // 实体颜色与背景颜色相近时是否反相
    validateLines: boolean; // 是否验证线段
    selectMode: "none" | "single" | "multiple"; // 实体选取模式
    dragAxis: "" | "x" | "y" | "xy"; // 限制整体内容可向x或y方向拖动
    entityDraggable: boolean | CadType[]; // 实体是否可拖动
    hideDimensions: boolean; // 是否隐藏标注
    lineGongshi: number; // 显示线公式的字体大小, ≤0时不显示
    hideLineLength: boolean; // 是否隐藏线长度(即使lineLength>0)
    hideLineGongshi: boolean; // 是否隐藏线公式(即使lineGongshi>0)
    minLinewidth: number; // 所有线的最小宽度(调大以便选中)
    fontFamily: string; // 设置字体,
    fontWeight: string; // 设置字体粗细
    enableZoom: boolean; // 是否启用缩放
    dashedLinePadding: number | number[]; // 虚线前后留白
}

const getConfigProxy = (config: Partial<CadViewerConfig> = {}) => {
    const defalutConfig: CadViewerConfig = {
        width: 300,
        height: 150,
        backgroundColor: "white",
        padding: [0],
        reverseSimilarColor: true,
        validateLines: false,
        selectMode: "multiple",
        dragAxis: "xy",
        entityDraggable: true,
        hideDimensions: false,
        lineGongshi: 0,
        hideLineLength: false,
        hideLineGongshi: false,
        minLinewidth: 1,
        fontFamily: "",
        fontWeight: "normal",
        enableZoom: true,
        dashedLinePadding: 2
    };
    for (const key in config) {
        if (key in defalutConfig) {
            (defalutConfig as any)[key] = config[key as keyof CadViewerConfig];
        }
    }
    return new Proxy(defalutConfig, {
        set: (target, key, value) => {
            if (key === "padding") {
                if (typeof value === "number") {
                    value = [value, value, value, value];
                } else if (!Array.isArray(value) || value.length === 0) {
                    value = [0, 0, 0, 0];
                } else if (value.length === 1) {
                    value = [value[0], value[0], value[0], value[0]];
                } else if (value.length === 2) {
                    value = [value[0], value[1], value[0], value[1]];
                } else if (value.length === 3) {
                    value = [value[0], value[1], value[0], value[2]];
                }
            }
            if (key in target) {
                (target as any)[key] = value;
                return true;
            }
            return false;
        }
    });
};

const session = new SessionStorage("cadViewer");

export class CadViewer extends EventEmitter {
    data: CadData;
    dom: HTMLDivElement;
    draw: Svg;
    stylizer: CadStylizer;
    entitiesCopied?: CadEntities;
    private _config: CadViewerConfig;
    private _fonts: CadViewerFont[] = [];
    get fonts() {
        return cloneDeep(this._fonts);
    }

    constructor(data = new CadData(), config: Partial<CadViewerConfig> = {}) {
        super();
        this.data = data;

        const dom = document.createElement("div");
        dom.classList.add("cad-viewer");
        this.dom = dom;
        this.draw = SVG().addTo(dom).size("100%", "100%");
        this.stylizer = new CadStylizer(this);

        dom.addEventListener("wheel", controls.onWheel.bind(this));
        dom.addEventListener("click", controls.onClick.bind(this));
        dom.addEventListener("pointerdown", controls.onPointerDown.bind(this));
        dom.addEventListener("pointermove", controls.onPointerMove.bind(this));
        dom.addEventListener("pointerup", controls.onPointerUp.bind(this));
        dom.addEventListener("pointerleave", controls.onPointerUp.bind(this));
        dom.addEventListener("keydown", controls.onKeyDown.bind(this));
        dom.tabIndex = 0;
        dom.focus();

        this._config = getConfigProxy();
        cadTypes.forEach((t) => this.draw.group().attr("group", t));
        this.config({...this._config, ...config}).center();
    }

    config(): CadViewerConfig;
    config<T extends keyof CadViewerConfig>(key: T): CadViewerConfig[T];
    config(config: Partial<CadViewerConfig>): this;
    config<T extends keyof CadViewerConfig>(key: T, value: CadViewerConfig[T]): this;
    config<T extends keyof CadViewerConfig>(config?: T | Partial<CadViewerConfig>, value?: CadViewerConfig[T]) {
        if (!config) {
            const result = cloneDeep(this._config);
            result["fontFamily"] = this.config("fontFamily");
            return result;
        }
        if (typeof config === "string") {
            if (value === undefined) {
                if (config === "fontFamily") {
                    const fontNames = this._fonts.length > 0 ? this._fonts.map((v) => v.name) : [];
                    const fontFamily = this._config["fontFamily"];
                    if (fontFamily) {
                        fontNames.push(fontFamily);
                    }
                    return fontNames.join(", ");
                }
                return this._config[config];
            } else {
                const tmp: Partial<CadViewerConfig> = {};
                tmp[config] = value;
                return this.config(tmp);
            }
        }
        let needsResize = false;
        let needsSetBg = false;
        let needsRender = false;
        for (const key in config) {
            const newValue = config[key as keyof CadViewerConfig];
            const success = Reflect.set(this._config, key, newValue);
            if (success) {
                switch (key as keyof CadViewerConfig) {
                    case "width":
                    case "height":
                        needsResize = true;
                        break;
                    case "backgroundColor":
                        needsSetBg = true;
                        break;
                    case "hideDimensions":
                    case "lineGongshi":
                    case "hideLineLength":
                    case "hideLineGongshi":
                    case "reverseSimilarColor":
                    case "validateLines":
                        needsRender = true;
                        break;
                    case "fontFamily":
                        this.dom.style.fontFamily = this.config("fontFamily");
                        break;
                    case "selectMode":
                        if (config.selectMode === "none") {
                            this.unselectAll();
                        } else if (config.selectMode === "single") {
                            const selected = this.selected().toArray();
                            selected.pop();
                            this.unselect(selected);
                        }
                        break;
                }
            }
        }
        if (needsResize) {
            this.resize();
        }
        if (needsSetBg) {
            this.setBackgroundColor();
        }
        if (needsRender) {
            this.render();
        }
        return this;
    }

    appendTo(container: HTMLElement) {
        container.appendChild(this.dom);
        return this;
    }

    width(): number;
    width(value: number | string): this;
    width(value?: number | string) {
        if (value === undefined) {
            return this.draw.attr("width") as number;
        }
        this.draw.attr("width", value);
        return this;
    }

    height(): number;
    height(value: number | string): this;
    height(value?: number | string) {
        if (value === undefined) {
            return this.draw.attr("height") as number;
        }
        this.draw.attr("height", value);
        return this;
    }

    // TODO: get/set cad position

    moveX(dx: number) {
        const box = this.draw.viewbox();
        box.x -= dx;
        this.draw.viewbox(box);
        return this;
    }

    moveY(dy: number) {
        const box = this.draw.viewbox();
        box.y -= dy;
        this.draw.viewbox(box);
        return this;
    }

    move(dx: number, dy: number) {
        const box = this.draw.viewbox();
        box.x -= dx;
        box.y -= dy;
        this.draw.viewbox(box);
        return this;
    }

    zoom(): number;
    zoom(level: number, point?: CoordinateXY): this;
    zoom(level?: number, point?: CoordinateXY) {
        // ? .zoom() method is somehow hidden
        if (typeof level === "number") {
            (this.draw as any).zoom(level, point);
            this.emit("zoom");
            return this;
        } else {
            return (this.draw as any).zoom(level, point) as number;
        }
    }

    resize(width?: number, height?: number) {
        const {draw, _config} = this;
        if (width && width > 0) {
            _config.width = width;
        } else {
            width = _config.width;
        }
        if (height && height > 0) {
            _config.height = height;
        } else {
            height = _config.height;
        }
        draw.attr({width, height});
        this.dom.style.width = width + "px";
        this.dom.style.height = height + "px";
        const viewbox = this.draw.viewbox();
        const r1 = width / height;
        const r2 = viewbox.w / viewbox.h;
        if (r1 > r2) {
            viewbox.w = viewbox.width = viewbox.h * r1;
        } else {
            viewbox.h = viewbox.height = viewbox.w / r1;
        }
        this.draw.viewbox(viewbox);
        return this;
    }

    setBackgroundColor(color?: string) {
        if (typeof color !== "string") {
            color = this._config.backgroundColor;
        } else {
            this._config.backgroundColor = color;
        }
        this.draw.css("background-color" as any, color.toString());
    }

    drawEntity(entity: CadEntity, style: Partial<CadStyle> = {}) {
        const {draw, stylizer} = this;
        const {color, linewidth, fontStyle} = stylizer.get(entity, style);
        if (!entity.visible) {
            entity.el?.remove();
            entity.el = null;
            return [];
        }
        entity.update();
        let el = entity.el;
        if (!el) {
            let typeLayer = draw.find(`[group="${entity.type}"]`)[0] as G;
            if (!typeLayer) {
                typeLayer = draw.group().attr("group", entity.type);
            }
            el = typeLayer.group().addClass("selectable");
            entity.el = el;
            el.node.onclick = (event) => {
                controls.onEntityClick.call(this, event, entity);
            };
            el.node.onpointerdown = (event) => {
                controls.onEntityPointerDown.call(this, event, entity);
            };
            el.node.onpointermove = (event) => {
                controls.onEntityPointerMove.call(this, event, entity);
            };
            el.node.onpointerup = (event) => {
                controls.onEntityPointerUp.call(this, event, entity);
            };
        }
        let drawResult: (Element | null)[] = [];
        if (entity instanceof CadArc) {
            const {center, radius, start_angle, end_angle, clockwise} = entity;
            drawResult = drawArc(el, center, radius, start_angle, end_angle, clockwise);
        } else if (entity instanceof CadCircle) {
            const {center, radius} = entity;
            drawResult = drawCircle(el, center, radius);
        } else if (entity instanceof CadDimension) {
            const {mingzi, qujian, axis, xiaoshuchuli} = entity;
            const renderStyle = entity.hideDimLines ? -1 : entity.renderStyle;
            const points = this.data.getDimensionPoints(entity);
            let text = "";
            if (mingzi) {
                text = mingzi;
            }
            if (qujian) {
                text = qujian;
            }
            drawResult = drawDimension(el, renderStyle, points, text, fontStyle, axis, xiaoshuchuli);
        } else if (entity instanceof CadHatch) {
            const {paths} = entity;
            drawResult = [];
            for (const path of paths) {
                const {edges, vertices} = path;
                const edgePoints = edges.map((v) => v.start);
                drawResult = drawResult.concat(drawShape(el, edgePoints, "fill", 0));
                drawResult = drawResult.concat(drawShape(el, vertices, "fill", drawResult.length));
            }
            if (!drawResult.length) {
                drawResult = [];
            }
        } else if (entity instanceof CadLine) {
            const {start, end, dashArray} = entity;
            drawResult = drawLine(el, start, end, {dashArray, padding: this.config("dashedLinePadding")});
        } else if (entity instanceof CadMtext) {
            const parent = entity.parent;
            const {insert, anchor, text} = entity;
            if (parent instanceof CadLine || parent instanceof CadArc) {
                const {lineGongshi, hideLineLength, hideLineGongshi} = this._config;
                let foundOffset: Point | undefined;
                if (entity.info.isLengthText) {
                    if (hideLineLength || parent.hideLength) {
                        el.remove();
                        entity.el = null;
                    } else {
                        let length = parent.length;
                        let prefix = "";
                        if (parent.显示线长) {
                            const length2 = calc(parent.显示线长, {线长: length});
                            if (!isNaN(length2)) {
                                length = length2;
                            }
                        } else if (parent instanceof CadArc && (parent.圆弧显示 === "半径" || parent.圆弧显示 === "R+半径")) {
                            length = parent.radius;
                            prefix = "R";
                        }
                        entity.text = prefix + toFixedTrim(length);
                        entity.font_size = parent.lengthTextSize;
                        foundOffset = getVectorFromArray(entity.info.offset);
                    }
                } else if (entity.info.isGongshiText) {
                    if (hideLineGongshi) {
                        el.remove();
                        entity.el = null;
                    } else {
                        if (parent.gongshi) {
                            entity.text = `${parent.mingzi}=${parent.gongshi}`;
                        } else {
                            entity.text = parent.mingzi;
                        }
                        let varName = "";
                        const root = parent.root?.root;
                        if (root && root.info.vars) {
                            for (const name in root.info.vars) {
                                if (root.info.vars[name] === parent.id) {
                                    varName = `可改${name}`;
                                }
                            }
                        }
                        if (entity.text) {
                            if (varName) {
                                entity.text += "," + varName;
                            }
                        } else {
                            entity.text = varName;
                        }
                        entity.font_size = lineGongshi;
                        foundOffset = getVectorFromArray(entity.info.offset);
                    }
                } else if (entity.info.isBianhuazhiText) {
                    if (hideLineGongshi) {
                        el.remove();
                        entity.el = null;
                    } else {
                        if (parent instanceof CadLine && parent.guanlianbianhuagongshi) {
                            entity.text = `变化值=${parent.guanlianbianhuagongshi}`;
                        } else {
                            entity.text = "";
                        }
                        entity.font_size = lineGongshi - 3;
                        foundOffset = getVectorFromArray(entity.info.offset);
                    }
                }
                const middle = parent.middle;
                if (foundOffset) {
                    if (Math.abs(foundOffset.x) >= 60 || Math.abs(foundOffset.y) >= 60) {
                        foundOffset.set(0, 0);
                        entity.info.offset = foundOffset.toArray();
                    }
                    entity.insert.copy(foundOffset.add(middle));
                }

                if (entity.el && entity.el.width()) {
                    // * 计算文字尺寸
                    const size = new Point(entity.el.width() as number, entity.el.height() as number);
                    entity.info.size = size.toArray();

                    // * 重新计算锚点
                    const x = insert.x - anchor.x * size.x;
                    const y = insert.y + anchor.y * size.y;
                    const points = [
                        [0, 0],
                        [1, 0],
                        [1, 1],
                        [0, 1],
                        [0, 0.5],
                        [0.5, 0],
                        [1, 0.5],
                        [0.5, 1]
                    ].map((v) => [new Point(x + v[0] * size.x, y - v[1] * size.y), new Point(v)]);
                    let minD = Infinity;
                    let index = -1;
                    points.forEach((p, i) => {
                        const d = middle.distanceTo(p[0]);
                        if (d < minD) {
                            minD = d;
                            index = i;
                        }
                    });
                    if (index >= 0) {
                        entity.anchor.copy(points[index][1]);
                        const offset2 = points[index][0].clone().sub(middle);
                        entity.info.offset = offset2.toArray();
                        entity.info.anchorOverwrite = entity.anchor.toArray();
                        entity.insert.copy(offset2.add(middle));
                    }
                }
            }
            drawResult = drawText(el, text, fontStyle, insert, anchor);
        } else if (entity instanceof CadSpline) {
            // TODO
        } else if (entity instanceof CadLeader) {
            const start = entity.vertices[1];
            const end = entity.vertices[0];
            drawResult = drawArrow(el, start, end, {size: entity.size, double: false});
        }
        if (!drawResult || drawResult.length < 1) {
            entity.el?.remove();
            entity.el = null;
            return drawResult;
        }
        el.attr({id: entity.id, type: entity.type});
        el.children().forEach((c) => {
            if (c.hasClass("fill")) {
                c.fill(color);
            }
            if (c.hasClass("stroke")) {
                c.stroke({width: linewidth, color});
                c.attr("vector-effect", "non-scaling-stroke");
            }
        });
        entity.update();
        entity.children.forEach((c) => this.drawEntity(c, style), true);
        return drawResult;
    }

    render(entities?: CadEntity | CadEntities | CadEntity[], style: Partial<CadStyle> = {}) {
        if (!entities) {
            entities = this.data.getAllEntities();
        }
        if (entities instanceof CadEntity) {
            entities = [entities];
        }
        if (Array.isArray(entities)) {
            entities = new CadEntities().fromArray(entities);
        }
        if (entities.length) {
            entities.dimension.forEach((e) => (e.visible = !this._config.hideDimensions));
            entities.forEach((entity) => {
                if (entity instanceof CadInsert) {
                    // const block = this.data.blocks[entity.name];
                    // block?.forEach((v) => console.log(this.drawEntity(v.clone().transform({translate: entity.insert}, true), style)));
                    // TODO: draw blocks
                } else {
                    this.drawEntity(entity, style);
                }
            }, true);
            this.emit("render", entities);
        }
        return this;
    }

    // FIXME: 需要调用两次才能正确居中
    center() {
        let {width, height, x, y} = this.data.getBoundingRect();
        if (!isFinite(width) || !isFinite(height)) {
            width = height = x = y = 0;
        }
        const outerWidth = this.width();
        const outerHeight = this.height();
        const padding = cloneDeep(this._config.padding) as number[];
        const scaleX = (outerWidth - padding[1] - padding[3]) / width;
        const scaleY = (outerHeight - padding[0] - padding[2]) / height;
        const scale = Math.min(scaleX, scaleY);
        for (let i = 0; i < padding.length; i++) {
            padding[i] /= scale;
        }
        let outerWidth2 = width + padding[1] + padding[3];
        let outerHeight2 = height + padding[0] + padding[2];
        const ratio = outerWidth / outerHeight;
        if (ratio > outerWidth2 / outerHeight2) {
            outerWidth2 = outerHeight2 * ratio;
            width = outerWidth2 - padding[1] - padding[3];
        } else {
            outerHeight2 = outerWidth2 / ratio;
            height = outerHeight2 - padding[0] - padding[2];
        }
        x = x - width / 2 - padding[3];
        y = y - height / 2 - padding[2];
        outerWidth2 = Math.max(0, outerWidth2);
        outerHeight2 = Math.max(0, outerHeight2);
        this.draw.viewbox(x, y, outerWidth2, outerHeight2);
        this.draw.transform({a: 1, b: 0, c: 0, d: -1, e: 0, f: 0});
        return this;
    }

    selected() {
        return this.data.getAllEntities().filter((e) => !!e.selected, true);
    }

    unselected() {
        return this.data.getAllEntities().filter((e) => !e.selected, true);
    }

    select(entities?: CadEntities | CadEntity | CadEntity[]): this {
        let multi = true;
        if (!entities) {
            return this;
        } else if (entities instanceof CadEntity) {
            multi = false;
            entities = new CadEntities().add(entities);
        } else if (Array.isArray(entities)) {
            entities = new CadEntities().fromArray(entities);
        }
        if (entities.length) {
            entities.forEach((e) => (e.selected = true));
            this.emit("entitiesselect", entities, multi);
        }
        return this;
    }

    unselect(entities?: CadEntities | CadEntity | CadEntity[]): this {
        let multi = true;
        if (!entities) {
            return this;
        } else if (entities instanceof CadEntity) {
            multi = false;
            entities = new CadEntities().add(entities);
        } else if (Array.isArray(entities)) {
            entities = new CadEntities().fromArray(entities);
        }
        if (entities.length) {
            entities.forEach((e) => (e.selected = false));
            this.emit("entitiesunselect", entities, multi);
        }
        return this;
    }

    selectAll() {
        return this.select(this.data.getAllEntities());
    }

    unselectAll() {
        return this.unselect(this.data.getAllEntities());
    }

    remove(entities?: CadEntities | CadEntity | CadEntity[]): this {
        if (!entities) {
            return this;
        } else if (entities instanceof CadEntity) {
            return this.remove(new CadEntities().add(entities));
        }
        if (Array.isArray(entities)) {
            return this.remove(new CadEntities().fromArray(entities));
        }
        if (entities instanceof CadEntities) {
            const data = new CadData();
            data.entities = entities;
            entities.forEach((e) => {
                if (e instanceof CadMtext && e.info.isLengthText) {
                    const parent = e.parent;
                    if (parent instanceof CadLine || parent instanceof CadArc) {
                        parent.hideLength = true;
                        this.render(e);
                    }
                } else {
                    e.parent?.removeChild(e);
                    e.el?.remove();
                    e.el = null;
                    e.children.forEach((c) => c.el?.remove());
                }
            });
            this.data.separate(data);
            this.emit("entitiesremove", entities);
            this.render();
        }
        return this;
    }

    add(entities?: CadEntities | CadEntity | CadEntity[]): this {
        if (!entities) {
            return this;
        } else if (entities instanceof CadEntity) {
            return this.add(new CadEntities().add(entities));
        }
        if (Array.isArray(entities)) {
            return this.add(new CadEntities().fromArray(entities));
        }
        if (entities instanceof CadEntities) {
            this.emit("entitiesadd", entities);
            entities.forEach((e) => this.data.entities.add(e));
            this.render(entities);
        }
        return this;
    }

    getWorldPoint(x: number, y: number) {
        const {height} = this.draw.node.getBoundingClientRect();
        const box = this.draw.viewbox();
        const result = new Point();
        const zoom = this.zoom();
        result.x = x / zoom + box.x;
        result.y = (height - y) / zoom + box.y;
        return result;
    }

    getScreenPoint(x: number, y: number) {
        const {height} = this.draw.node.getBoundingClientRect();
        const box = this.draw.viewbox();
        const result = new Point();
        const zoom = this.zoom();
        result.x = (x - box.x) * zoom;
        result.y = height - (y - box.y) * zoom;
        return result;
    }

    emit<T extends keyof CadEvents>(type: T, ...params: CadEvents[T]) {
        return super.emit(type, ...params);
    }

    on<T extends keyof CadEvents>(type: T, listener: CadEventCallBack<T>) {
        return super.on(type, listener as (...args: any[]) => void);
    }

    off<T extends keyof CadEvents>(type: T, listener: CadEventCallBack<T>) {
        return super.off(type, listener as (...args: any[]) => void);
    }

    toBase64() {
        let str = new XMLSerializer().serializeToString(this.draw.node);
        str = unescape(encodeURIComponent(str));
        return "data:image/svg+xml;base64," + window.btoa(str);
    }

    async toCanvas() {
        const img = await loadImage(this.toBase64());
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0);
        return canvas;
    }

    traverse(callback: (e: CadEntity) => void, recursive = false) {
        this.data.getAllEntities().forEach((e) => callback(e), recursive);
        return this;
    }

    destroy() {
        this.data = new CadData();
        this.dom.remove();
        return this;
    }

    reset(data?: CadData) {
        this.draw.find("g").forEach((v) => v.remove());
        cadTypes.forEach((t) => this.draw.group().attr("group", t));
        if (data instanceof CadData) {
            this.data = data;
        }
        this.dom.id = this.data.id;
        this.dom.setAttribute("name", this.data.name);
        this.traverse((e) => {
            e.el = null;
            e.children.forEach((c) => (c.el = null));
        });
        this.dom.focus();
        return this;
    }

    // ? move entities efficiently
    // * call render() after moving
    moveEntities(toMove: CadEntities, notToMove: CadEntities, x: number, y: number) {
        if (toMove.length <= notToMove.length) {
            toMove.transform({translate: [x, y]}, false);
        } else {
            this.move(x, y);
            notToMove.transform({translate: [-x, -y]}, false);
        }
        this.emit("moveentities", toMove);
    }

    async loadFont(font: CadViewerFont) {
        const {name, url} = font;
        const loadedFont = this._fonts.find((v) => v.name === name);
        if (loadedFont && loadedFont.url === url) {
            return;
        }
        const fontCache = session.load<ObjectOf<string>>("fontCache") || {};
        let dataUrl = fontCache[url] || null;
        if (!dataUrl) {
            const response = await fetch(url);
            const blob = await response.blob();
            dataUrl = await new Promise<string | null>((resolve, reject) => {
                const fileReader = new FileReader();
                fileReader.readAsDataURL(blob);
                fileReader.onload = () => {
                    const result = fileReader.result;
                    if (typeof result === "string") {
                        resolve(result);
                    } else {
                        resolve(null);
                    }
                };
                fileReader.onerror = () => resolve(null);
            });
        }
        if (!dataUrl) {
            return;
        }
        fontCache[url] = dataUrl;
        session.save("fontCache", fontCache);
        const style = document.createElement("style");
        style.innerHTML = `
            @font-face {
                font-family: "${name}";
                src: url("${dataUrl}");
            }
        `;
        style.setAttribute("name", name);
        this.draw.defs().node.append(style);
        this._fonts.push(cloneDeep(font));
        fontCache[name] = dataUrl;
    }
}
