import {SVG, Svg, CoordinateXY, Element, G} from "@svgdotjs/svg.js";
import {EventEmitter} from "events";
import {cloneDeep} from "lodash";
import {Point} from "@lucilor/utils";
import {CadData} from "./cad-data/cad-data";
import {CadEntities} from "./cad-data/cad-entities";
import {CadEntity, CadArc, CadCircle, CadDimension, CadHatch, CadLine, CadMtext} from "./cad-data/cad-entity";
import {CadType} from "./cad-data/cad-types";
import {getVectorFromArray} from "./cad-data/utils";
import {CadStyle, CadStylizer} from "./cad-stylizer";
import {CadEvents, controls} from "./cad-viewer-controls";
import {drawArc, drawCircle, drawDimension, drawLine, drawShape, drawText} from "./draw";

export interface CadViewerConfig {
	width: number; // 宽
	height: number; // 高
	backgroundColor: string; // 背景颜色, 写法与css相同
	padding: number[] | number; // 内容居中时的内边距, 写法与css相同
	reverseSimilarColor: boolean; // 实体颜色与背景颜色相近时是否反相
	validateLines: boolean; // 是否验证线段
	selectMode: "none" | "single" | "multiple"; // 实体选取模式
	dragAxis: "" | "x" | "y" | "xy"; // 限制整体内容可向x或y方向拖动
	entityDraggable: boolean; // 实体是否可拖动
	hideDimensions: boolean; // 是否隐藏标注
	lineLength: number; // 显示线长度的字体大小, ≤0时不显示
	lineGongshi: number; // 显示线公式的字体大小, ≤0时不显示
	hideLineLength: boolean; // 是否隐藏线长度(即使lineLength>0)
	hideLineGongshi: boolean; // 是否隐藏线公式(即使lineGongshi>0)
	minLinewidth: number; // 所有线的最小宽度(调大以便选中)
}

function getConfigProxy(config?: Partial<CadViewerConfig>) {
	const defalutConfig: CadViewerConfig = {
		width: 300,
		height: 150,
		backgroundColor: "white",
		padding: 0,
		reverseSimilarColor: true,
		validateLines: false,
		selectMode: "multiple",
		dragAxis: "xy",
		entityDraggable: true,
		hideDimensions: false,
		lineLength: 0,
		lineGongshi: 0,
		hideLineLength: false,
		hideLineGongshi: false,
		minLinewidth: 1
	};
	for (const key in config) {
		if (key in defalutConfig) {
			defalutConfig[key] = config[key];
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
				target[key] = value;
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

	constructor(data: CadData, config: Partial<CadViewerConfig> = {}) {
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
		this.config(config).center();
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
			const success = Reflect.set(this._config, key, config[key]);
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
					case "lineLength":
					case "lineGongshi":
					case "hideLineLength":
					case "hideLineGongshi":
					case "reverseSimilarColor":
					case "validateLines":
						needsRender = true;
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
		return this.render();
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

	zoom(level?: number, point?: CoordinateXY) {
		// ? .zoom() method is somehow hidden
		const result = (this.draw as any).zoom(level, point);
		if (isNaN(result)) {
			return 1;
		}
		return result;
	}

	resize(width?: number, height?: number) {
		const {draw, _config} = this;
		if (width > 0) {
			_config.width = width;
		} else {
			width = _config.width;
		}
		if (height > 0) {
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
		return this.render();
	}

	drawEntity(entity: CadEntity, style: CadStyle = {}) {
		const {draw, stylizer} = this;
		const {color, linewidth} = stylizer.get(entity, style);
		if (!entity.visible) {
			entity.el?.remove();
			entity.el = null;
			return this;
		}
		let el = entity.el;
		if (!el) {
			const typeLayer = draw.find(`[type="${entity.type}"]`)[0] as G;
			if (!typeLayer) {
				draw.group().attr("type", entity.type);
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
		if (entity.needsTransform) {
			entity.transform(entity.el.transform());
			entity.el.transform({});
			entity.needsTransform = false;
		}
		let drawResult: Element[];
		if (entity instanceof CadArc) {
			const {center, radius, start_angle, end_angle, clockwise} = entity;
			drawResult = drawArc(el, center, radius, start_angle, end_angle, clockwise);
		} else if (entity instanceof CadCircle) {
			const {center, radius} = entity;
			drawResult = drawCircle(el, center, radius);
		} else if (entity instanceof CadDimension) {
			const {mingzi, qujian, font_size, axis, renderStyle} = entity;
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
			drawResult = drawDimension(el, renderStyle, points, text, axis, font_size);
		} else if (entity instanceof CadHatch) {
			const {paths} = entity;
			drawResult = [];
			paths.forEach((path) => {
				const {edges, vertices} = path;
				const edgePoints = edges.map((v) => v.start);
				drawResult = drawResult.concat(drawShape(el, edgePoints, "fill", 0));
				drawResult = drawResult.concat(drawShape(el, vertices, "fill", drawResult.length));
			});
			if (!drawResult.length) {
				drawResult = null;
			}
		} else if (entity instanceof CadLine) {
			const {start, end} = entity;
			drawResult = drawLine(el, start, end);
		} else if (entity instanceof CadMtext) {
			const parent = entity.parent;
			if (parent instanceof CadLine || parent instanceof CadArc) {
				const {lineLength, lineGongshi, hideLineLength, hideLineGongshi} = this._config;
				let offset: Point;
				if (entity.info.isLengthText) {
					entity.text = Math.round(parent.length).toString();
					entity.font_size = lineLength;
					if (hideLineLength) {
						el.remove();
						entity.el = null;
					}
					offset = getVectorFromArray(entity.info.offset);
				}
				if (entity.info.isGongshiText) {
					entity.text = parent.gongshi;
					entity.font_size = lineGongshi;
					offset = getVectorFromArray(entity.info.offset);
					if (hideLineGongshi) {
						el.remove();
						entity.el = null;
					}
				}
				if (offset) {
					if (Math.abs(offset.x) >= 150 || Math.abs(offset.y) >= 150) {
						offset.set(0, 0);
						entity.info.offset = offset.toArray();
					}
					entity.insert.copy(offset.add(parent.middle));
				}
			}
			const {text, insert, font_size, anchor} = entity;
			drawResult = drawText(el, text, font_size, insert, anchor);
		}
		if (!drawResult) {
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

	render(entities?: CadEntity | CadEntities | CadEntity[], style: CadStyle = {}) {
		if (!entities) {
			entities = this.data.getAllEntities();
		}
		if (entities instanceof CadEntity) {
			entities = [entities];
		}
		if (Array.isArray(entities)) {
			entities = new CadEntities().fromArray(entities);
		}
		entities.dimension.forEach((e) => (e.visible = !this._config.hideDimensions));
		entities.forEach((e) => this.drawEntity(e, style));
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
		let outterWidth = width + padding[1] + padding[3];
		let outterHeight = height + padding[0] + padding[2];
		const ratio = outerWidth / outerHeight;
		if (ratio > outterWidth / outterHeight) {
			outterWidth = outterHeight * ratio;
			width = outterWidth - padding[1] - padding[3];
		} else {
			outterHeight = outterWidth / ratio;
			height = outterHeight - padding[0] - padding[2];
		}
		x = x - width / 2 - padding[3];
		y = y - height / 2 - padding[2];
		this.draw.viewbox(x, y, outterWidth, outterHeight);
		this.draw.transform({a: 1, b: 0, c: 0, d: -1, e: 0, f: 0});
		return this;
	}

	selected() {
		return this.data.getAllEntities().filter((e) => e.selected, true);
	}

	unselected() {
		return this.data.getAllEntities().filter((e) => !e.selected, true);
	}

	select(entities: CadEntities | CadEntity | CadEntity[]): this {
		if (entities instanceof CadEntity) {
			return this.select(new CadEntities().add(entities));
		}
		if (Array.isArray(entities)) {
			return this.select(new CadEntities().fromArray(entities));
		}
		entities.forEach((e) => (e.selected = true));
		this.emit("entitiesselect", null, entities);
		return this;
	}

	unselect(entities: CadEntities | CadEntity | CadEntity[]): this {
		if (entities instanceof CadEntity) {
			return this.unselect(new CadEntities().add(entities));
		}
		if (Array.isArray(entities)) {
			return this.unselect(new CadEntities().fromArray(entities));
		}
		entities.forEach((e) => (e.selected = false));
		this.emit("entitiesunselect", null, entities);
		return this;
	}

	selectAll() {
		return this.select(this.data.getAllEntities());
	}

	unselectAll() {
		return this.unselect(this.data.getAllEntities());
	}

	remove(entities: CadEntities | CadEntity | CadEntity[]): this {
		if (entities instanceof CadEntity) {
			return this.remove(new CadEntities().add(entities));
		}
		if (Array.isArray(entities)) {
			return this.remove(new CadEntities().fromArray(entities));
		}
		if (entities instanceof CadEntities) {
			const data = new CadData();
			data.entities = entities;
			entities.forEach((e) => {
				e.parent?.remove(e);
				e.el?.remove();
				e.el = null;
				e.children.forEach((c) => c.el?.remove());
			});
			this.data.separate(data);
			this.emit("entitiesremove", null, entities);
		}
		return this;
	}

	add(entities: CadEntities | CadEntity | CadEntity[]): this {
		if (entities instanceof CadEntity) {
			return this.add(new CadEntities().add(entities));
		}
		if (Array.isArray(entities)) {
			return this.add(new CadEntities().fromArray(entities));
		}
		if (entities instanceof CadEntities) {
			this.emit("entitiesadd", null, entities);
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

	emit<K extends keyof CadEvents>(type: K, event: CadEvents[K][0], entities?: CadEvents[K][1]): boolean;
	emit(type: string | symbol, ...args: any[]): boolean;
	emit<K extends keyof CadEvents>(type: K, event: CadEvents[K][0], entities?: CadEvents[K][1]) {
		return super.emit(type, event, entities);
	}

	on<K extends keyof CadEvents>(type: K, listener: (event: CadEvents[K][0], entity?: CadEvents[K][1]) => void): this;
	on(type: string | symbol, listener: (...args: any[]) => void): this;
	on<K extends keyof CadEvents>(type: K, listener: (event: CadEvents[K][0], entity?: CadEvents[K][1]) => void) {
		return super.on(type, listener);
	}

	off<K extends keyof CadEvents>(
		type: K,
		listener: (event: CadEvents[K][0], entity?: CadEvents[K][1], object?: CadEvents[K][2]) => void
	) {
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
				ctx.drawImage(img, 0, 0);
				resolve(canvas);
			};
		});
	}

	traverse(callback: (e: CadEntity) => void) {
		this.data.getAllEntities().forEach((e) => callback(e));
		return this;
	}

	destroy() {
		this.data = new CadData();
		this.dom.remove();
		this.dom = null;
		return this;
	}

	reset(data?: CadData) {
		this.draw.clear();
		const types: CadType[] = ["DIMENSION", "HATCH", "MTEXT", "CIRCLE", "ARC", "LINE"];
		types.forEach((t) => {
			this.draw.group().attr("type", t);
		});
		if (data instanceof CadData) {
			this.data = data;
		}
		this.traverse((e) => {
			e.el = null;
			e.children.forEach((c) => (c.el = null));
		});
		this.dom.focus();
		return this.render().center();
	}

	// ? move entities efficiently
	moveEntities(toMove: CadEntities, notToMove: CadEntities, x: number, y: number) {
		const move = (es: CadEntities, x: number, y: number) => {
			es.forEach((e) => {
				e.el?.translate(x, y);
				e.needsTransform = true;
				if (e.children.length) {
					move(e.children, x, y);
				}
			});
		};
		if (toMove.length <= notToMove.length) {
			move(toMove, x, y);
		} else {
			this.move(x, y);
			move(notToMove, -x, -y);
		}
	}
}
