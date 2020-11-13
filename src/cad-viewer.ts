import {SVG, Svg, CoordinateXY, Element, G} from "@svgdotjs/svg.js";
import {EventEmitter} from "events";
import {cloneDeep} from "lodash";
import {Point, timeout} from "@lucilor/utils";
import {getVectorFromArray, isBetween} from "./cad-data/utils";
import {drawArc, drawCircle, drawDimension, drawLine, drawShape, drawText} from "./draw";
import {CadData, CadType, CadEntity, CadArc, CadCircle, CadDimension, CadHatch, CadLine, CadMtext, CadEntities} from ".";
import {CadStylizer, CadStyle} from "./cad-stylizer";
import {controls, CadEvents, CadEventCallBack} from "./cad-viewer-controls";

export interface CadViewerConfig {
    width: number; // 宽
    height: number; // 高
    backgroundColor: string; // 背景颜色, 写法与css相同
    padding: number[]; // 内容居中时的内边距, 写法与css相同
    reverseSimilarColor: boolean; // 实体颜色与背景颜色相近时是否反相
    validateLines: boolean; // 是否验证线段
    selectMode: "none" | "single" | "multiple"; // 实体选取模式
    dragAxis: "" | "x" | "y" | "xy"; // 限制整体内容可向x或y方向拖动
    entityDraggable: boolean; // 实体是否可拖动
    hideDimensions: boolean; // 是否隐藏标注
    lineGongshi: number; // 显示线公式的字体大小, ≤0时不显示
    hideLineLength: boolean; // 是否隐藏线长度(即使lineLength>0)
    hideLineGongshi: boolean; // 是否隐藏线公式(即使lineGongshi>0)
    minLinewidth: number; // 所有线的最小宽度(调大以便选中)
    fontFamily: string; // 设置字体
    enableZoom: boolean; // 是否启用缩放
    renderStep: number; // 渲染时每次渲染的实体个数
}

function getConfigProxy(config: Partial<CadViewerConfig> = {}) {
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
        fontFamily: "微软雅黑",
        enableZoom: true,
        renderStep: 10
    };
    for (const key in config) {
        if (key in defalutConfig) {
            (defalutConfig as any)[key] = config[key as keyof CadViewerConfig];
        }
    }
    return new Proxy(defalutConfig, {
        set(target, key, value) {
            if (key === "padding") {
                if (typeof value === "number") {
                    value = [value, value, value, value];
                } else if (!Array.isArray(value) || value.length === 0) {
                    value = [0, 0, 0, 0];
                } else if (value.length === 0) {
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
}

export class CadViewer extends EventEmitter {
    data: CadData;
    dom: HTMLDivElement;
    draw: Svg;
    stylizer: CadStylizer;
    private _config: CadViewerConfig;

    constructor(data = new CadData(), config: Partial<CadViewerConfig> = {}) {
        super();
        this.data = data;

        const dom = document.createElement("div");
        dom.id = data.id;
        dom.setAttribute("name", data.name);
        dom.classList.add("cad-viewer");
        dom.id = data.id;
        dom.setAttribute("name", data.name);
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
        const types: CadType[] = ["DIMENSION", "HATCH", "MTEXT", "CIRCLE", "ARC", "LINE"];
        types.forEach((t) => {
            this.draw.group().attr("type", t);
        });
        this.config({...this._config, ...config}).center();
    }

    config(): CadViewerConfig;
    config<T extends keyof CadViewerConfig>(key: T): CadViewerConfig[T];
    config(config: Partial<CadViewerConfig>): this;
    config<T extends keyof CadViewerConfig>(key: T, value: CadViewerConfig[T]): this;
    config<T extends keyof CadViewerConfig>(config?: T | Partial<CadViewerConfig>, value?: CadViewerConfig[T]) {
        if (!config) {
            return cloneDeep(this._config);
        }
        if (typeof config === "string") {
            if (value === undefined) {
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
                        this.dom.style.fontFamily = config.fontFamily as string;
                        break;
                    case "selectMode":
                        if (config.selectMode === "none") {
                            this.unselectAll();
                        } else if (config.selectMode === "single") {
                            const selected = this.selected().toArray().pop();
                            this.unselectAll().select(selected);
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

        return this;
    }

    setBackgroundColor(color?: string) {
        if (typeof color !== "string") {
            color = this._config.backgroundColor;
        } else {
            this._config.backgroundColor = color;
        }
        this.draw.css("background-color", color.toString());
    }

    drawEntity(entity: CadEntity, style: Partial<CadStyle> = {}) {
        const {draw, stylizer} = this;
        const {color, linewidth, fontSize, fontFamily} = stylizer.get(entity, style);
        if (!entity.visible) {
            entity.el?.remove();
            entity.el = null;
            return this;
        }
        let el = entity.el;
        if (!el) {
            let typeLayer = draw.find(`[type="${entity.type}"]`)[0] as G;
            if (!typeLayer) {
                typeLayer = draw.group().attr("type", entity.type);
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
        entity.update();
        let drawResult: (Element | null)[] = [];
        if (entity instanceof CadArc) {
            const {center, radius, start_angle, end_angle, clockwise} = entity;
            drawResult = drawArc(el, center, radius, start_angle, end_angle, clockwise);
        } else if (entity instanceof CadCircle) {
            const {center, radius} = entity;
            drawResult = drawCircle(el, center, radius);
        } else if (entity instanceof CadDimension) {
            const {mingzi, qujian, axis, renderStyle} = entity;
            const points = this.data.getDimensionPoints(entity);
            let text = "";
            if (mingzi) {
                text = mingzi;
            }
            if (qujian) {
                text = qujian;
            }
            if (text === "") {
                text = "<>";
            }
            drawResult = drawDimension(el, renderStyle, points, text, axis, fontSize, fontFamily);
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
            const {start, end} = entity;
            drawResult = drawLine(el, start, end);
        } else if (entity instanceof CadMtext) {
            const parent = entity.parent;
            if (parent instanceof CadLine || parent instanceof CadArc) {
                const {lineGongshi, hideLineLength, hideLineGongshi} = this._config;
                let offset: Point | undefined;
                if (entity.info.isLengthText) {
                    entity.text = Math.round(parent.length).toString();
                    entity.font_size = parent.lengthTextSize;
                    if (hideLineLength || parent.hideLength) {
                        el.remove();
                        entity.el = null;
                    }
                    offset = getVectorFromArray(entity.info.offset);
                } else if (entity.info.isGongshiText) {
                    if (parent.gongshi) {
                        entity.text = `${parent.mingzi}=${parent.gongshi}`;
                    } else {
                        entity.text = parent.mingzi;
                    }
                    entity.font_size = lineGongshi;
                    offset = getVectorFromArray(entity.info.offset);
                    if (hideLineGongshi) {
                        el.remove();
                        entity.el = null;
                    }
                }
                const middle = parent.middle;
                if (offset) {
                    if (Math.abs(offset.x) >= 60 || Math.abs(offset.y) >= 60) {
                        offset.set(0, 0);
                        entity.info.offset = offset.toArray();
                    }
                    entity.insert.copy(offset.add(middle));
                }

                if (entity.el && entity.el.width()) {
                    // * 计算文字尺寸
                    const size = new Point(entity.el.width(), entity.el.height());
                    entity.info.size = size.toArray();

                    // * 重新计算锚点
                    const {insert, anchor} = entity;
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
                        const offset = points[index][0].clone().sub(middle);
                        entity.info.offset = offset.toArray();
                        entity.info.anchorOverwrite = entity.anchor.toArray();
                        entity.insert.copy(offset.add(middle));
                    }
                }
            }
            const {insert, anchor} = entity;
            let text = entity.text;
            const offset = new Point(0, 0);
            // * 算料单特殊逻辑
            if (this.data.info.算料单) {
                // ? 调整字体的玄学数字
                const offsetYfactor = -0.1;

                if (anchor.y === 0) {
                    offset.y = offsetYfactor * fontSize;
                }
            }

            // * 自动换行
            if (text.match(/花件信息/)) {
                let lines = this.data.getAllEntities().line;
                lines = lines.filter((e) => e.isVertical() && isBetween(insert.y, e.minY, e.maxY) && insert.x < e.start.x);
                let dMin = Infinity;
                for (const e of lines) {
                    const d = e.start.x - insert.x - 1;
                    if (dMin > d) {
                        dMin = d;
                    }
                }
                if (el.width() > dMin) {
                    const originalText = text.replace(/\n/g, "");
                    const wrappedText: string[] = [];
                    let start = 0;
                    let end = 1;
                    const tmpEl = new G();
                    while (end < originalText.length) {
                        const tmpText = originalText.slice(start, end);
                        drawText(tmpEl, tmpText, fontSize, insert.clone().add(offset), anchor, fontFamily);
                        if (tmpEl.width() < dMin) {
                            end++;
                        } else {
                            wrappedText.push(originalText.slice(start, end - 1));
                            start = end;
                            end = start + 1;
                        }
                    }
                    tmpEl.remove();
                    text = entity.text = wrappedText.join("\n");
                }
            }

            drawResult = drawText(el, text, fontSize, insert.clone().add(offset), anchor, fontFamily);
        }
        if (!drawResult || drawResult.length < 1) {
            entity.el?.remove();
            entity.el = null;
            return this;
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
        entity.children.forEach((c) => this.drawEntity(c, style));
        return this;
    }

    async render(entities?: CadEntity | CadEntities | CadEntity[], style: Partial<CadStyle> = {}) {
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
            const entitiesArr = entities.toArray();
            const step = this.config("renderStep");
            for (let i = 0; i < entitiesArr.length; i += step) {
                const tmpEntities = new CadEntities().fromArray(entitiesArr.slice(i, i + step));
                tmpEntities.dimension.forEach((e) => (e.visible = !this._config.hideDimensions));
                tmpEntities.forEach((e) => this.drawEntity(e, style));
                await timeout();
            }
            this.emit("render", null, {entities});
        }
        return this;
    }

    center() {
        let {width, height, x, y} = this.data.getBoundingRect();
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
        if (!entities) {
            return this;
        } else if (entities instanceof CadEntity) {
            return this.select(new CadEntities().add(entities));
        } else if (Array.isArray(entities)) {
            return this.select(new CadEntities().fromArray(entities));
        }
        if (entities.length) {
            entities.forEach((e) => (e.selected = true));
            this.emit("entitiesselect", null, {entities});
        }
        return this;
    }

    unselect(entities?: CadEntities | CadEntity | CadEntity[]): this {
        if (!entities) {
            return this;
        } else if (entities instanceof CadEntity) {
            return this.unselect(new CadEntities().add(entities));
        }
        if (Array.isArray(entities)) {
            return this.unselect(new CadEntities().fromArray(entities));
        }
        if (entities.length) {
            entities.forEach((e) => (e.selected = false));
            this.emit("entitiesunselect", null, {entities});
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
            this.emit("entitiesremove", null, {entities});
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
            this.emit("entitiesadd", null, {entities});
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

    emit<T extends keyof CadEvents>(type: T, event: CadEvents[T][0], params: CadEvents[T][1]): boolean;
    emit<T extends keyof CadEvents>(type: T, event: CadEvents[T][0], params: CadEvents[T][1]) {
        return super.emit(type, event, params);
    }

    on<T extends keyof CadEvents>(type: T, listener: CadEventCallBack<T>): this;
    on<T extends keyof CadEvents>(type: T, listener: CadEventCallBack<T>) {
        return super.on(type, listener);
    }

    off<T extends keyof CadEvents>(type: T, listener: CadEventCallBack<T>) {
        return super.off(type, listener);
    }

    toBase64() {
        let str = new XMLSerializer().serializeToString(this.draw.node);
        str = unescape(encodeURIComponent(str));
        return "data:image/svg+xml;base64," + window.btoa(str);
    }

    toCanvas() {
        const img = new Image();
        img.src = this.toBase64();
        return new Promise<HTMLCanvasElement>((resolve) => {
            img.onload = () => {
                const canvas = document.createElement("canvas");
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext("2d");
                ctx?.drawImage(img, 0, 0);
                resolve(canvas);
            };
        });
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
        this.draw.clear();
        if (data instanceof CadData) {
            this.data = data;
        }
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
            toMove.transform({translate: [x, y]});
        } else {
            this.move(x, y);
            notToMove.transform({translate: [-x, -y]});
        }
    }
}
