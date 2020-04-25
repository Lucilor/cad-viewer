import * as PIXI from "pixi.js";
import {
	CadEntity,
	CadLine,
	CadMText,
	CadDimension,
	CadData,
	CadTypes,
	CadArc,
	CadCircle,
	Connection,
	CadLWPolyline,
	CadHatch,
	CadEntities
} from "./cad-data";
import {Line, Rectangle, Point, Arc, Angle, RGB2Index, index2RGB} from "@lucilor/utils";
import {EventEmitter} from "events";
import {cloneDeep, intersection} from "lodash";
import {Config, defaultConfig, LineStyle, TextStyle, Events, Tramsform, transformData} from "./cad-viewer.misc";
import * as UUID from "uuid";

function num2Str(number: number, fixed?: number) {
	return Number(number.toFixed(fixed)).toString();
}

declare type DraggingEvent = (event: PointerEvent) => void;
declare type WheelingEvent = (event: WheelEvent) => void;
declare type KeyboardEvent0 = (event: KeyboardEvent) => void;

export class CadViewer {
	app: PIXI.Application;
	containers: {
		outer: PIXI.Container;
		inner: PIXI.Container;
		main: PIXI.Container;
		partners: PIXI.Container;
		components: PIXI.Container;
	};
	private _scale: number;
	private _multiSelector: PIXI.Graphics;
	private _status?: {
		from: Point;
		to: Point;
		isDragging: boolean;
		button: number;
		componentName?: string;
		partners: number[];
	};
	private _renderTimer = {id: null, time: 0};
	private _emitter: EventEmitter;
	private _events: {
		onDragStart: DraggingEvent;
		onDrag: DraggingEvent;
		onDragEnd: DraggingEvent;
		onWheel: WheelingEvent;
		onKeyDown: KeyboardEvent0;
	};

	view: HTMLDivElement;
	data: CadData;
	config: Config;
	constructor(data: CadData, width = 300, height = 150, config: Config = {}) {
		transformData(data, "array");
		let padding = config.padding;
		if (typeof padding === "number") {
			padding = [padding, padding, padding, padding];
		} else if (!Array.isArray(padding) || padding.length === 0) {
			padding = [0, 0, 0, 0];
		} else if (padding.length === 0) {
			padding = [0, 0, 0, 0];
		} else if (padding.length === 1) {
			padding = [padding[0], padding[0], padding[0], padding[0]];
		} else if (padding.length === 2) {
			padding = [padding[0], padding[1], padding[0], padding[1]];
		} else if (padding.length === 3) {
			padding = [padding[0], padding[1], padding[0], padding[2]];
		}
		config.padding = padding;
		this.config = {...defaultConfig, ...config};

		if (this.config.transparent) {
			delete this.config.backgroundColor;
		}
		const {backgroundColor, transparent} = this.config;
		PIXI.utils.skipHello();
		this.app = new PIXI.Application({width, height, antialias: true, backgroundColor, transparent});
		const outer = new PIXI.Container();
		const inner = new PIXI.Container();
		const main = new PIXI.Container();
		const partners = new PIXI.Container();
		const components = new PIXI.Container();
		main.sortableChildren = true;
		this.containers = {outer, inner, main, partners, components};
		this._multiSelector = new PIXI.Graphics();
		this.app.stage.interactive = true;
		this.app.stage.addChild(outer, this._multiSelector);
		outer.addChild(inner);
		inner.addChild(main, partners, components);
		main.sortableChildren = true;
		outer.position.set(width / 2, height / 2);
		this._emitter = new EventEmitter();
		this._status = {from: new Point(), to: new Point(), isDragging: false, button: null, partners: []};
		this._events = {onDragStart: () => {}, onDrag: () => {}, onDragEnd: () => {}, onWheel: () => {}, onKeyDown: () => {}};

		this.data = {
			entities: {line: [], arc: [], circle: [], hatch: [], mtext: [], dimension: []},
			baseLines: [],
			jointPoints: [],
			options: [],
			conditions: [],
			type: "",
			partners: [],
			components: {data: [], connections: []},
			...data
		};
		this._scale = 1;

		const view = document.createElement("div");
		this.view = view;
		if (data.name) {
			view.id = data.name;
		}
		view.classList.add("cad-viewer");
		view.style.width = width + "px";
		view.style.height = height + "px";
		view.appendChild(this.app.view);

		this.reassembleComponents();
		view.addEventListener("pointerdown", (event) => this._events.onDragStart(event));
		view.addEventListener("pointermove", (event) => this._events.onDrag(event));
		["pointercancel", "pointerleave", "pointerout", "pointerup"].forEach((v) => {
			view.addEventListener(v, (event: PointerEvent) => this._events.onDragEnd(event));
		});
		view.addEventListener("wheel", (event) => this._events.onWheel(event));
		view.addEventListener("keydown", (event) => this._events.onKeyDown(event));
		return this;
	}

	drawLine(entity: CadLine, style?: LineStyle, addTo?: PIXI.Container) {
		const line = new Line(new Point(entity.start), new Point(entity.end));
		if (line.length <= 0) {
			return null;
		}
		let container = entity.container as PIXI.Graphics;
		if (!(container instanceof PIXI.Graphics)) {
			container = new PIXI.Graphics();
			if (addTo) {
				addTo.addChild(container);
			} else {
				this.containers.inner.addChild(container);
			}
			entity.container = container;
		}
		let colorRGB = entity.colorRGB;
		if (style && style.color) {
			colorRGB = style.color;
		}
		const lineWidth = style && style.lineWidth ? style.lineWidth : entity.lineWidth;
		container.clear();

		const main = this.containers.main;
		const {showLineLength, drawMTexts} = this.config;
		const name = "lineLength - " + entity.id;
		const texts = drawMTexts ? [entity.gongshi, entity.qujian, entity.mingzi].filter((v) => v) : [];
		const textStyle = new PIXI.TextStyle({align: "center", fontSize: showLineLength * this._scale, fill: this._correctColor(0xffffff)});
		let lineLength = main.children.find((o) => o.name === name) as PIXI.Text;
		if (showLineLength > 0) {
			const lengthText = num2Str(line.length);
			texts.push(lengthText);
			const middle = line.middle;
			if (lineLength) {
				lineLength.style = textStyle;
				lineLength.scale.set(1 / this._scale, -1 / this._scale);
				lineLength.text = texts.join("\n");
				lineLength.position.set(middle.x, middle.y);
			} else {
				lineLength = new PIXI.Text(texts.join("\n"), textStyle);
				lineLength.name = name;
				lineLength.scale.set(1 / this._scale, -1 / this._scale);
				main.addChild(lineLength);
				lineLength.zIndex = -1;
				main.sortChildren();
				lineLength.scale.set(1 / this._scale, -1 / this._scale);
				lineLength.position.set(middle.x, middle.y);
				if (line.slope === 0) {
					lineLength.anchor.set(0.5, 1);
				}
				if (line.slope === Infinity || line.slope === -Infinity) {
					lineLength.anchor.set(1, 0.5);
				}
				lineLength.interactive = true;
				lineLength.on("pointerdown", (event: PIXI.interaction.InteractionEvent) => {
					this._emitter.emit(Events.linelengthclick, event, entity);
				});
			}
		} else {
			lineLength?.destroy();
		}

		let sprite = container.children.find((o) => o.name === "sprite") as PIXI.Sprite;
		if (!sprite) {
			sprite = this._createGhostSprite(entity, new Point(0.5, 0));
			entity.container.addChild(sprite);
		}
		sprite.width = lineWidth / this._scale + 3;
		sprite.height = line.length;
		sprite.rotation = line.theta - Math.PI / 2;
		sprite.position.set(line.start.x, line.start.y);

		container.lineStyle(lineWidth, colorRGB);
		container.moveTo(line.start.x, line.start.y);
		container.lineTo(line.end.x, line.end.y);
		return container;
	}

	drawArc(entity: CadArc, style?: LineStyle, addTo?: PIXI.Container) {
		let container = entity.container as PIXI.Graphics;
		let colorRGB = entity.colorRGB;
		if (style && style.color) {
			colorRGB = style.color;
		}
		const lineWidth = style && style.lineWidth ? style.lineWidth : entity.lineWidth;
		const {center, radius, start_angle, end_angle} = entity;
		const start = new Angle(start_angle, "deg").constrain();
		const end = new Angle(end_angle, "deg").constrain();
		if (!(container instanceof PIXI.Graphics)) {
			container = new PIXI.Graphics();
			if (addTo) {
				addTo.addChild(container);
			} else {
				this.containers.inner.addChild(container);
			}
			entity.container = container;
		}
		container.clear();
		container.lineStyle(lineWidth, colorRGB);
		container.arc(center[0], center[1], radius, start.rad, end.rad, entity.clockwise);

		let sprite = container.children.find((o) => o instanceof PIXI.Sprite) as PIXI.Sprite;
		if (!sprite) {
			sprite = this._createGhostSprite(entity, new Point(0.5, 1));
			entity.container.addChild(sprite);
		}
		const arc = new Arc(new Point(entity.center), entity.radius, start, end, entity.clockwise);
		const line = new Line(arc.startPoint, arc.endPoint);
		const m1 = line.middle;
		const m2 = arc.middle;
		sprite.width = line.length;
		sprite.height = m1.distance(m2);
		sprite.rotation = line.theta;
		sprite.position.set(m1.x, m1.y);
	}

	drawCircle(entity: CadCircle, style?: LineStyle, addTo?: PIXI.Container) {
		let container = entity.container as PIXI.Graphics;
		let colorRGB = entity.colorRGB;
		if (style && style.color) {
			colorRGB = style.color;
		}
		const lineWidth = style && style.lineWidth ? style.lineWidth : entity.lineWidth;
		const {center, radius} = entity;
		if (!(container instanceof PIXI.Graphics)) {
			container = new PIXI.Graphics();
			if (addTo) {
				addTo.addChild(container);
			} else {
				this.containers.inner.addChild(container);
			}
			entity.container = container;
		}
		container.clear();
		container.lineStyle(lineWidth, colorRGB);
		container.drawCircle(center[0], center[1], radius);

		let sprite = container.children.find((o) => o instanceof PIXI.Sprite) as PIXI.Sprite;
		if (!sprite) {
			sprite = this._createGhostSprite(entity, new Point(0.5, 0.5));
			entity.container.addChild(sprite);
		}
		sprite.width = radius * 2;
		sprite.height = radius * 2;
		sprite.position.set(center[0], center[1]);
	}

	drawText(entity: CadMText, style?: TextStyle, addTo?: PIXI.Container) {
		let container = entity.container as PIXI.Text;
		if (!(container instanceof PIXI.Text)) {
			container = new PIXI.Text("");
			if (addTo) {
				addTo.addChild(container);
			} else {
				this.containers.inner.addChild(container);
			}
			entity.container = container;
			container.interactive = true;
			container.on("pointerover", (event) => this._onEntityHover(event, entity));
			container.on("pointerdown", (event) => this._onEntityClick(event, entity));
			container.on("pointerout", (event) => this._onEntityOut(event, entity));
		}
		let position: Point;
		let fontSize = entity.font_size * 1.25;
		if (!fontSize) {
			fontSize = style && style.fontSize ? style.fontSize : this.config.fontSize;
		}
		const color = style && style.color ? style.color : entity.colorRGB;
		if (entity.type === CadTypes.MText) {
			position = new Point((entity as CadMText).insert);
		}
		const text = entity.text;
		if (!text) {
			return;
		}
		container.text = text;
		container.position.set(position.x, position.y);
		if (entity.anchor) {
			container.anchor.set(...entity.anchor);
		} else {
			container.anchor.set(0, 0);
		}
		container.scale.set(1 / this._scale, -1 / this._scale);
		container.style = new PIXI.TextStyle({fontSize: fontSize * this._scale, fill: color});
	}

	drawPolyline(entity: CadLWPolyline, style?: LineStyle, addTo?: PIXI.Container) {
		let container = entity.container as PIXI.Graphics;
		if (!(container instanceof PIXI.Graphics)) {
			container = new PIXI.Graphics();
			if (addTo) {
				addTo.addChild(container);
			} else {
				this.containers.inner.addChild(container);
			}
			entity.container = container;
		}
		let colorRGB = entity.colorRGB;
		if (style && style.color) {
			colorRGB = style.color;
		}
		const lineWidth = style && style.lineWidth ? style.lineWidth : entity.lineWidth;
		container.clear();

		container.lineStyle(lineWidth, colorRGB);
		const startPoint = entity.points[0];
		container.moveTo(startPoint[0], startPoint[1]);
		for (let i = 1; i < entity.points.length; i++) {
			const point = entity.points[i];
			container.lineTo(point[0], point[1]);
		}
		if (entity.closed) {
			container.lineTo(startPoint[0], startPoint[1]);
		}
		return container;
	}

	drawHatch(entity: CadHatch, style?: {color?: number}, addTo?: PIXI.Container) {
		let container = entity.container as PIXI.Graphics;
		if (!(container instanceof PIXI.Graphics)) {
			container = new PIXI.Graphics();
			if (addTo) {
				addTo.addChild(container);
			} else {
				this.containers.inner.addChild(container);
			}
			entity.container = container;
		}

		const color = this._correctColor(0);
		entity.paths.forEach((path) => {
			container.beginFill(color);
			if (Array.isArray(path.edges)) {
				path.edges.forEach((edge, i) => {
					if (i === 0) {
						container.moveTo(edge.end[0], edge.end[1]);
					} else {
						container.lineTo(edge.end[0], edge.end[1]);
					}
				});
			}
			if (Array.isArray(path.vertices) && path.vertices.length === 4) {
				container.moveTo(path.vertices[0][0], path.vertices[0][1]);
				container.lineTo(path.vertices[1][0], path.vertices[1][1]);
				container.lineTo(path.vertices[2][0], path.vertices[2][1]);
				container.lineTo(path.vertices[3][0], path.vertices[3][1]);
			}
			container.closePath();
			container.endFill();
		});
	}

	drawDimension(entity: CadDimension, style?: {color?: number}, addTo?: PIXI.Container) {
		const {mingzi, qujian, axis, distance, font_size} = entity;
		let container = entity.container as PIXI.Graphics;
		if (!(container instanceof PIXI.Graphics)) {
			container = new PIXI.Graphics();
			container.zIndex = -1;
			if (addTo) {
				addTo.addChild(container);
			} else {
				this.containers.inner.addChild(container);
			}
			entity.container = container;
		}
		if (!entity.entity1 || !entity.entity2 || !entity.entity1.id || !entity.entity2.id) {
			return;
		}
		const entity1 = this.findEntity(entity.entity1.id) as CadLine;
		const entity2 = this.findEntity(entity.entity2.id) as CadLine;
		if (!entity1) {
			console.warn(`线段${entity1.id}没找到`);
			return null;
		}
		if (!entity2) {
			console.warn(`线段${entity2.id}没找到`);
			return null;
		}
		if (entity1.type !== CadTypes.Line) {
			console.warn(`实体${entity1.id}不是线段`);
			return null;
		}
		if (entity2.type !== CadTypes.Line) {
			console.warn(`实体${entity2.id}不是线段`);
			return null;
		}
		const line1 = new Line(new Point(entity1.start), new Point(entity1.end));
		const line2 = new Line(new Point(entity2.start), new Point(entity2.end));
		const getPoint = (line: Line, location: string) => {
			if (location === "start") {
				return line.start;
			}
			if (location === "end") {
				return line.end;
			}
			if (location === "center") {
				return line.middle;
			}
		};

		const lineWidth = 1;
		let colorRGB = entity.colorRGB;
		if (style && style.color) {
			colorRGB = style.color;
		}
		const color = this._correctColor(colorRGB);
		let p1 = getPoint(line1, entity.entity1.location);
		let p2 = getPoint(line2, entity.entity2.location);
		let p3 = p1.clone();
		let p4 = p2.clone();
		const arrow1: Point[] = [];
		const arrow2: Point[] = [];
		container.clear();
		container.lineStyle(lineWidth, color, 0.85);
		container.removeChildren();

		const arrowSize = 1;
		const arrowLength = arrowSize * Math.sqrt(3);
		if (axis === "x") {
			const y = Math.max(p3.y, p4.y);
			p3.y = y + distance;
			p4.y = y + distance;
			if (p3.x > p4.x) {
				[p3, p4] = [p4, p3];
				[p1, p2] = [p2, p1];
			}
			arrow1[0] = p3.clone().add(lineWidth, 0);
			arrow1[1] = arrow1[0].clone().add(arrowLength, -arrowSize);
			arrow1[2] = arrow1[0].clone().add(arrowLength, arrowSize);
			arrow2[0] = p4.clone().add(-lineWidth, 0);
			arrow2[1] = arrow2[0].clone().add(-arrowLength, -arrowSize);
			arrow2[2] = arrow2[0].clone().add(-arrowLength, arrowSize);
		}
		if (axis === "y") {
			const x = Math.max(p3.x, p4.x);
			p3.x = x + distance;
			p4.x = x + distance;
			if (p3.y < p4.y) {
				[p3, p4] = [p4, p3];
				[p1, p2] = [p2, p1];
			}
			arrow1[0] = p3.clone().add(0, -lineWidth);
			arrow1[1] = arrow1[0].clone().add(-arrowSize, -arrowLength);
			arrow1[2] = arrow1[0].clone().add(arrowSize, -arrowLength);
			arrow2[0] = p4.clone().add(0, lineWidth);
			arrow2[1] = arrow2[0].clone().add(-arrowSize, arrowLength);
			arrow2[2] = arrow2[0].clone().add(arrowSize, arrowLength);
		}
		container.moveTo(p1.x, p1.y);
		container.lineTo(p3.x, p3.y);
		container.lineTo(p4.x, p4.y);
		container.lineTo(p2.x, p2.y);

		container.beginFill(color);
		container.moveTo(arrow1[0].x, arrow1[0].y);
		container.lineTo(arrow1[1].x, arrow1[1].y);
		container.lineTo(arrow1[2].x, arrow1[2].y);
		container.closePath();
		container.endFill();
		container.beginFill(color);
		container.moveTo(arrow2[0].x, arrow2[0].y);
		container.lineTo(arrow2[1].x, arrow2[1].y);
		container.lineTo(arrow2[2].x, arrow2[2].y);
		container.closePath();
		container.endFill();

		let str = "";
		if (mingzi) {
			str = mingzi;
		}
		if (qujian) {
			str = qujian;
		}
		if (str === "") {
			str = "<>";
		}
		str = str.replace("<>", p3.distance(p4).toFixed(2));
		const text = new PIXI.Text(str, new PIXI.TextStyle({fontSize: font_size * this._scale, fill: color}));
		const midPoint = new Line(p3, p4).middle;
		text.scale.set(1 / this._scale, -1 / this._scale);
		text.anchor.set(0.5, 1);
		text.position.set(midPoint.x, midPoint.y);
		if (axis === "y") {
			text.rotation = -Math.PI / 2;
		}
		container.addChild(text);
	}

	drawMultiSelector(rect: Rectangle) {
		this._multiSelector.clear();
		this._multiSelector.lineStyle(3, 0xffffff, 0.75);
		this._multiSelector.drawRect(rect.x, rect.y, rect.width, rect.height);
	}

	drawPoint(point: Point, style?: {size?: number; color?: number}, addTo?: PIXI.Container) {
		const container = new PIXI.Graphics();
		const size = (style && style.size) || 5;
		const color = (style && style.color) || 0x000000;
		container.beginFill(color);
		container.drawCircle(point.x, point.y, size / this._scale);
		container.endFill();
		if (addTo) {
			addTo.addChild(container);
		} else {
			this.containers.inner.addChild(container);
		}
		return container;
	}

	clearMultiSelector() {
		this._multiSelector.clear();
	}

	unselectAll() {
		this.flatEntities().forEach((e) => (e.selected = false));
		return this.render();
	}

	translatePoint(point: Point) {
		const result = new Point();
		const {inner, outer} = this.containers;
		result.x = (point.x + inner.position.x) * this._scale + outer.position.x;
		result.y = (this.height - point.y + inner.position.y) * this._scale + outer.position.y;
		return result;
	}

	render(center = false, mode: number = 0b111, entities?: CadEntity[], style: LineStyle = {}) {
		const now = new Date().getTime();
		const then = this._renderTimer.time + (1 / this.config.fps) * 1000;
		if (now < then) {
			window.clearTimeout(this._renderTimer.id);
			this._renderTimer.id = setTimeout(() => this.render(center, mode, entities, style), then - now);
			return this;
		}
		this._renderTimer.time = now;
		const draw = (entity: CadEntity, container: PIXI.Container) => {
			if (!entity) {
				return;
			}
			if (!entity.id) {
				entity.id = UUID.v1();
			}
			const {color, layer} = entity;
			const lineWidth = 1;
			const localStyle = {...style};
			if (entity.selectable !== false) {
				entity.selectable = true;
			}
			if (typeof entity.colorRGB !== "number") {
				if (color === 256) {
					const cadLayer = this.findLayerByName(layer);
					if (typeof cadLayer.colorRGB !== "number") {
						cadLayer.colorRGB = index2RGB(cadLayer.color, "number");
					}
					entity.colorRGB = cadLayer.colorRGB;
				} else {
					entity.colorRGB = index2RGB(color, "number");
				}
			}
			if (entity.selected === true && localStyle.color === undefined) {
				localStyle.color = this._correctColor(this.config.selectedColor);
			} else {
				localStyle.color = this._correctColor(entity.colorRGB);
			}
			switch (entity.type) {
				case CadTypes.Line:
					entity.lineWidth = lineWidth;
					this.drawLine(entity as CadLine, localStyle, container);
					break;
				case CadTypes.Arc:
					entity.lineWidth = lineWidth;
					this.drawArc(entity as CadArc, localStyle, container);
					break;
				case CadTypes.Circle:
					entity.lineWidth = lineWidth;
					this.drawCircle(entity as CadCircle, localStyle, container);
					break;
				case CadTypes.MText:
					if (this.config.drawMTexts) {
						this.drawText(entity as CadMText, localStyle, container);
					}
					break;
				case CadTypes.Dimension:
					if (this.config.drawDimensions) {
						this.drawDimension(entity as CadDimension, localStyle, container);
					} else if (entity.container) {
						container.removeChild(entity.container);
						entity.container = null;
					}
					break;
				case CadTypes.LWPolyline:
					entity.lineWidth = lineWidth;
					if (this.config.drawPolyline) {
						this.drawPolyline(entity as CadLWPolyline, localStyle, container);
					}
					break;
				case CadTypes.Hatch:
					this.drawHatch(entity as CadHatch, {color: this._correctColor(0)}, container);
					break;
				default:
			}
		};
		if (center) {
			this.center();
		}
		if (entities) {
			entities.forEach((entity) => draw(entity, this.containers.main));
		} else {
			if (mode & 0b100) {
				this.flatEntities(this.data, 0b100).forEach((entity) => draw(entity, this.containers.main));
			}
			if (mode & 0b010) {
				this._status.partners.forEach((i) => {
					this.flatEntities(this.data.partners[i], 0b100).forEach((entity) => draw(entity, this.containers.partners));
				});
			}
			if (mode & 0b001) {
				this.data.components.data.forEach((component) => {
					this.flatEntities(component, 0b100).forEach((entity) => draw(entity, this.containers.components));
				});
			}
		}

		const {x, y} = this.containers.inner.position;
		this.containers.inner.setTransform(x, y, 1, -1, 0, 0, 0, 0, this.height);
		return this;
	}

	center() {
		const {width, height} = this;
		const {padding, maxScale, minScale} = this.config;
		const rect = this.getBounds();
		const scaleX = (width - padding[1] - padding[3]) / (rect.width + 10);
		const scaleY = (height - padding[0] - padding[2]) / (rect.height + 10);
		const scale = Math.min(scaleX, scaleY);
		this.config.minScale = Math.min(scale, minScale);
		this.config.maxScale = Math.max(scale, maxScale);
		this.scale = scale;
		const positionX = (width - rect.width + (padding[3] - padding[1]) / scale) / 2 - rect.x;
		const positionY = (height - rect.height + (padding[2] - padding[0]) / scale) / 2 - rect.y;
		this.position = new Point(positionX, positionY);
		return this;
	}

	resize(width: number, height: number) {
		if (!isNaN(width)) {
			this.view.style.width = width + "px";
		}
		if (!isNaN(width)) {
			this.view.style.height = height + "px";
		}
		this.app.resizeTo = this.view;
		this.app.resize();
	}

	findLayerByName(layerName: string) {
		for (const layer of this.data.layers) {
			if (layer.name === layerName) {
				return layer;
			}
		}
		return null;
	}

	// addEntities(entities: CadEntity[]) {
	// 	const ids = this.data.entities.map((v) => v.id);
	// 	entities.forEach((e) => {
	// 		switch e.type
	// 		const idx = ids.indexOf(e.id);
	// 		e.container = null;
	// 		if (idx > -1) {
	// 			this.data.entities[idx] = e;
	// 		} else {
	// 			this.data.entities.push(e);
	// 		}
	// 	});
	// }

	// removeEntities(entities: CadEntity[]) {
	// 	const ids = entities.map((v) => {
	// 		this.containers.inner.removeChild(v.container);
	// 		return v.id;
	// 	});
	// 	const exclude = (e: CadEntity) => !ids.includes(e.id);
	// 	this.data.entities = this.data.entities.filter(exclude);
	// 	this.data.partners.forEach((partner) => {
	// 		partner.entities = partner.entities.filter(exclude);
	// 	});
	// 	this.data.components.data.forEach((component) => {
	// 		component.entities = component.entities.filter(exclude);
	// 	});
	// 	return this;
	// }

	destroy(removeView = true) {
		this.reset({});
		this.app.renderer.gl.getExtension("WEBGL_lose_context").loseContext();
		this.app.destroy(removeView, {children: true});
		if (removeView) {
			this.view.remove();
		}
	}

	exportData(type: "array" | "object" = "array"): CadData {
		this.calculateBaseLines();
		this._sortComponents();
		const result = cloneDeep(this.data);
		this.flatEntities(result).forEach((e) => this._purgeEntityData(e));
		if (Array.isArray(result.options)) {
			result.options = result.options.filter((c) => c.value && c.name);
		} else {
			result.options = [];
		}
		if (Array.isArray(result.conditions)) {
			result.conditions = result.conditions.filter((c) => c.length);
		} else {
			result.conditions = [];
		}
		result.baseLines = result.baseLines.filter((l) => l.name && l.valueX && l.valueY);
		result.jointPoints = result.jointPoints.filter((p) => p.name && p.valueX && p.valueY);
		return type === "object" ? transformData(result, "object") : result;
	}

	enableDragging(onDragStart?: DraggingEvent, onDrag?: DraggingEvent, onDragEnd?: DraggingEvent) {
		const flags = [true, true, true];
		if (typeof onDragStart !== "function") {
			onDragStart = (event) => {
				const {clientX: x, clientY: y} = event instanceof TouchEvent ? event.targetTouches[0] : event;
				this._status.from.set(x, y);
				this._status.to.set(x, y);
				this._status.isDragging = true;
				this._emitter.emit(Events.dragstart, event);
				this._status.button = (event as MouseEvent).button;
			};
			flags[0] = false;
		}
		if (typeof onDrag !== "function") {
			onDrag = (event) => {
				if (this._status.isDragging) {
					const {clientX: x, clientY: y} = event instanceof TouchEvent ? event.targetTouches[0] : event;
					const {from, to, componentName} = this._status;
					if (this._status.button === 1 || (event.shiftKey && this._status.button === 0)) {
						const position = this.position;
						const offset = new Point(x - to.x, to.y - y).divide(this._scale);
						if (componentName) {
							const component = this.data.components.data.find((v) => v.name === componentName);
							if (component) {
								this.moveComponent(component, offset);
								this.render(false, 0b001);
							}
						} else {
							if (!this.config.dragAxis.includes("x")) {
								offset.x = 0;
							}
							if (!this.config.dragAxis.includes("y")) {
								offset.y = 0;
							}
							this.position = position.add(offset);
						}
					} else {
						if (this.config.selectMode === "multiple") {
							this.drawMultiSelector(new Rectangle(from, x - from.x, y - from.y));
						}
					}
					this._emitter.emit(Events.drag, event);
					this._status.to.set(x, y);
				}
			};
			flags[1] = false;
		}
		if (typeof onDragEnd !== "function") {
			onDragEnd = (event) => {
				const {from, to, isDragging} = this._status;
				if (isDragging) {
					this.clearMultiSelector();
					if (this.config.selectMode === "multiple" && event instanceof MouseEvent && event.button === 0) {
						const x = Math.min(from.x, to.x);
						const y = Math.max(from.y, to.y);
						const width = Math.abs(from.x - to.x);
						const height = Math.abs(from.y - to.y);
						const rect = new Rectangle(new Point(x, y), width, height);
						const toBeSelected: CadEntity[] = [];
						for (const entity of this.flatEntities()) {
							if (!entity.selectable) {
								continue;
							}
							if (entity.type === CadTypes.Line) {
								const lineEntity = entity as CadLine;
								const start = this.translatePoint(new Point(lineEntity.start));
								const end = this.translatePoint(new Point(lineEntity.end));
								if (rect.containsLine(new Line(start, end))) {
									toBeSelected.push(entity);
								}
							} else if (entity.type === CadTypes.Arc) {
								const arcEntity = entity as CadArc;
								const start = new Angle(arcEntity.start_angle, "deg");
								const end = new Angle(arcEntity.end_angle, "deg");
								const arc = new Arc(new Point(arcEntity.center), arcEntity.radius, start, end);
								if (
									rect.containsPoint(this.translatePoint(arc.startPoint)) &&
									rect.containsPoint(this.translatePoint(arc.endPoint))
								) {
									toBeSelected.push(entity);
								}
							} else if (entity.type === CadTypes.Circle) {
								const circleEntity = entity as CadCircle;
								const center = this.translatePoint(new Point(circleEntity.center));
								if (rect.containsPoint(center)) {
									toBeSelected.push(entity);
								}
							}
						}
						const allSelected = toBeSelected.every((e) => e.selected);
						toBeSelected.forEach((entity) => (entity.selected = !allSelected));
						this.render(false, null, toBeSelected);
					}
					this._emitter.emit(Events.dragend, event);
				}
				this._status.isDragging = false;
			};
			flags[2] = false;
		}
		if (new Set(flags).size > 1) {
			console.warn("正常情况下，设置拖拽事件时你应该同时设置3个（前中后）事件。");
		}
		this._events.onDragStart = onDragStart;
		this._events.onDrag = onDrag;
		this._events.onDragEnd = onDragEnd;
		return this;
	}

	enableWheeling(onWheel?: WheelingEvent) {
		if (typeof onWheel !== "function") {
			onWheel = (event) => {
				const factor = 1.2;
				if (event.deltaY > 0) {
					this.scale = this._scale / factor;
				} else {
					this.scale = this._scale * factor;
				}
				this.render();
				this._emitter.emit(Events.wheel, event);
			};
		}
		this._events.onWheel = onWheel;
		return this;
	}

	enableKeyboard(onKeyDown?: KeyboardEvent0) {
		const {view} = this;
		const step = 10 / this._scale;
		view.tabIndex = 0;
		view.focus();
		if (typeof onKeyDown !== "function") {
			onKeyDown = (event) => {
				const {x, y} = this.position;
				switch (event.key) {
					case "w":
					case "ArrowUp":
						this.position = new Point(x, y + step);
						break;
					case "a":
					case "ArrowLeft":
						this.position = new Point(x - step, y);
						break;
					case "s":
					case "ArrowDown":
						this.position = new Point(x, y - step);
						break;
					case "d":
					case "ArrowRight":
						this.position = new Point(x + step, y);
						break;
					case "Escape":
						this.unselectAll();
						break;
					default:
				}
			};
		}
		this._events.onKeyDown = onKeyDown;
		return this;
	}

	reset(data?: CadData) {
		if (data) {
			transformData(data, "array");
			this.data = {
				entities: {line: [], arc: [], circle: [], hatch: [], mtext: [], dimension: []},
				baseLines: [],
				jointPoints: [],
				options: [],
				conditions: [],
				type: "",
				partners: [],
				components: {data: [], connections: []},
				...data
			};
		}
		this.data = this.exportData();
		this.containers.main.removeChildren();
		this.containers.partners.removeChildren();
		this.containers.components.removeChildren();
		this._status.partners.length = 0;
		return this;
	}

	flatEntities(from = this.data, mode = 0b111) {
		let result: CadEntity[] = [];
		if (mode & 0b100) {
			result = result.concat(Object.values(from.entities).flat());
		}
		if (mode & 0b010) {
			from.partners.forEach((partner) => {
				result = result.concat(Object.values(partner.entities).flat());
			});
		}
		if (mode & 0b001) {
			from.components.data.forEach((component) => {
				result = result.concat(Object.values(component.entities).flat());
			});
		}
		return result;
	}

	findEntity<T extends CadEntity = CadEntity>(id: string, entities: CadEntity[] | number = 0b111): T {
		if (typeof entities === "number") {
			entities = this.flatEntities(this.data, entities);
		}
		for (const entity of entities) {
			if (entity.id === id) {
				return entity as T;
			}
		}
		return null;
	}

	on(event: Events, listener: (...args: any[]) => void) {
		this._emitter.on(event, listener);
	}

	calculateBaseLines(index?: number) {
		this.data.baseLines.forEach((l, i) => {
			if (typeof index === "number" && index !== i) {
				return;
			}
			const eX = this.findEntity<CadLine>(l.idX);
			const eY = this.findEntity<CadLine>(l.idY);
			l.valueX = eX ? eX.start[0] : null;
			l.valueY = eY ? eY.start[1] : null;
		});
		return this;
	}

	get position() {
		const {inner, outer} = this.containers;
		const {x, y} = inner.position;
		return new Point(x + outer.position.x, -y - outer.position.y);
	}

	set position(position: Point) {
		const {inner, outer} = this.containers;
		const {x, y} = position;
		inner.position.set(x - outer.position.x, -y - outer.position.y);
	}

	get scale() {
		return this._scale;
	}

	set scale(value: number) {
		value = Math.max(this.config.minScale, Math.min(this.config.maxScale, value));
		this._scale = value;
		this.containers.outer.position.set(0);
		this.containers.outer.scale.set(value);
		this.containers.outer.position.set(this.width / 2, this.height / 2);
	}

	getSelectedEntities() {
		const result: CadEntities = {line: [], arc: [], circle: [], hatch: [], mtext: [], dimension: []};
		for (const key in this.data.entities) {
			this.data.entities[key].forEach((e) => {
				const e2 = {...e};
				this._purgeEntityData(e2);
				if (e.selected) {
					if (result[key]) {
						result[key].push(e2);
					} else {
						result[key] = [e2];
					}
				}
			});
		}
		return result;
	}

	joinPartners() {
		const partners = this.data.partners;
		this._status.partners.length = 0;
		partners.forEach((partner, i) => {
			const thisJointPoints = this.data.jointPoints;
			const thatJointPoints = partner.jointPoints;
			if (Array.isArray(thatJointPoints)) {
				for (const thatPoint of thatJointPoints) {
					const thisPoint = thisJointPoints.find((p) => p.name && p.name === thatPoint.name);
					if (thisPoint) {
						const entities = partner.entities;
						Object.values(entities).flat();
						// .forEach((e) => this._purgeEntityData(e));
						const p1 = new Point(thisPoint.valueX, thisPoint.valueY);
						const p2 = new Point(thatPoint.valueX, thatPoint.valueY);
						if (!p1.equals(p2)) {
							this.transformEntities(entities, {translate: p1.sub(p2)});
							thatPoint.valueX = thisPoint.valueX;
							thatPoint.valueY = thisPoint.valueY;
						}
						this._status.partners.push(i);
					}
				}
			}
		});
		return this;
	}

	addComponent(component: CadData) {
		const rect1 = this.getBounds();
		const rect2 = this.getBounds(component.entities);
		const offset1 = new Point(rect1.x - rect2.x, rect1.y - rect2.y);
		offset1.x += rect1.width + 15;
		offset1.y += (rect1.height - rect2.height) / 2;
		this.transformEntities(component.entities, {translate: offset1});
		const data = this.data.components.data;
		const prev = data.findIndex((v) => v.name === component.name);
		if (prev > -1) {
			data[prev] = component;
		} else {
			data.push(component);
		}
		return this;
	}

	assembleComponents(connection: Connection) {
		const {names, lines, space, position, offset} = connection;
		const components = this.data.components;
		let c1: CadData;
		let c2: CadData;
		for (const c of components.data) {
			if (c.name === names[0]) {
				c1 = c;
			}
			if (c.name === names[1]) {
				c2 = c;
			}
			if (c1 && c2) {
				break;
			}
		}
		if (!c1 || !c2) {
			throw new Error("未找到配件");
		}
		let axis: "x" | "y";
		const getLine = (e: CadCircle, l: Line) => {
			if (e.type !== CadTypes.Circle) {
				throw new Error("不支持的实体");
			}
			const o = new Point(e.center);
			if (!isFinite(l.slope)) {
				return new Line(o, o.clone().add(new Point(0, 1)));
			}
			if (l.slope === 0) {
				return new Line(o, o.clone().add(new Point(1, 0)));
			}
		};
		const translate = new Point();
		// if (typeof offset === "object") {
		// 	["x", "y"].forEach(a => {
		// 		if (typeof offset[a] === "number") {
		// 			translate[a] += offset[a];
		// 		}
		// 	});
		// }
		const c1Entities = this.flatEntities(c1);
		const c2Entities = this.flatEntities(c2);
		if (position === "absolute") {
			const e1 = this.findEntity(lines[0], c1Entities);
			const e2 = this.findEntity(lines[1], c2Entities);
			if (!e1 || !e2) {
				throw new Error("未找到对应实体");
			}
			let spaceNum = Number(space);
			if (isNaN(spaceNum)) {
				spaceNum = 20;
			}
			let l1: Line;
			let l2: Line;
			if (e1.type === CadTypes.Line) {
				const start = new Point((e1 as CadLine).start);
				const end = new Point((e1 as CadLine).end);
				l1 = new Line(start, end);
			}
			if (e2.type === CadTypes.Line) {
				const start = new Point((e2 as CadLine).start);
				const end = new Point((e2 as CadLine).end);
				l2 = new Line(start, end);
			}
			if (!l1 && !l2) {
				throw new Error("至少需要一条直线");
			}
			if (!l1) {
				l1 = getLine(e1 as CadCircle, l2);
			}
			if (!l2) {
				l2 = getLine(e2 as CadCircle, l1);
			}
			if (l1.slope === l2.slope) {
				if (!isFinite(l1.slope)) {
					translate.x = l1.start.x - l2.start.x + spaceNum;
					axis = "x";
				} else if (l1.slope === 0) {
					translate.y = l1.start.y - l2.start.y + spaceNum;
					axis = "y";
				} else {
					throw new Error("两条线不是横线或者竖线");
				}
			} else {
				throw new Error("两条线不平行");
			}
			this.moveComponent(c2, translate, c1);
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
			const e1 = this.findEntity<CadLine>(lines[0], c1Entities);
			const e2 = this.findEntity<CadLine>(lines[1], c1Entities);
			const e3 = this.findEntity(lines[2], c2Entities);
			if (!e1 || !e2 || !e3) {
				throw new Error("未找到对应实体");
			}
			if (e1.type !== CadTypes.Line || e2.type !== CadTypes.Line) {
				throw new Error("必须先选两条直线");
			}
			const l1: Line = new Line(new Point(e1.start), new Point(e1.end));
			const l2: Line = new Line(new Point(e2.start), new Point(e2.end));
			let l3: Line;
			if (e3.type === CadTypes.Line) {
				const start = new Point((e3 as CadLine).start);
				const end = new Point((e3 as CadLine).end);
				l3 = new Line(start, end);
			}
			if (e3.type === CadTypes.Circle) {
				l3 = getLine(e3 as CadCircle, l1);
			}
			if (!(l1.slope === l2.slope && l2.slope === l3.slope)) {
				throw new Error("三条线必须相互平行");
			}
			const rect = this.getBounds(c2.entities);
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
			this.moveComponent(c2, translate, c1);
		}

		const toRemove = [];
		const connectedToC1: string[] = [];
		const connectedToC2: string[] = [];
		components.connections.forEach((conn) => {
			if (conn.names[0] === c1.name) {
				connectedToC1.push(conn.names[1]);
			}
			if (conn.names[1] === c1.name) {
				connectedToC1.push(conn.names[0]);
			}
			if (conn.names[0] === c2.name) {
				connectedToC2.push(conn.names[1]);
			}
			if (conn.names[1] === c2.name) {
				connectedToC2.push(conn.names[0]);
			}
		});
		const connectedToBoth = intersection(connectedToC1, connectedToC2);
		components.connections.forEach((conn, i) => {
			const arr = intersection(conn.names, [c1.name, c2.name]);
			if (conn.names.includes(c2.name) && intersection(conn.names, connectedToBoth).length) {
				toRemove.push(i);
			}
			if (arr.length === 2 && conn.axis === axis) {
				toRemove.push(i);
			}
		});
		components.connections = components.connections.filter((v, i) => !toRemove.includes(i));
		connection.axis = axis;
		connection.space = connection.space ? connection.space : "0";
		components.connections.push(cloneDeep(connection));

		this._sortComponents();
		return this;
	}

	moveComponent(curr: CadData, translate: Point, prev?: CadData) {
		this.transformEntities(curr.entities, {translate});
		const map: object = {};
		this.data.components.connections.forEach((conn) => {
			if (conn.names.includes(curr.name)) {
				conn.names.forEach((n) => {
					if (n !== curr.name && n !== prev?.name) {
						if (!map[n]) {
							map[n] = {};
						}
						map[n][conn.axis] = conn.space;
						if (typeof conn.offset !== "object") {
							conn.offset = {};
						}
						if (conn.axis === "x") {
							if (typeof conn.offset.y === "number") {
								conn.offset.y += translate.y;
							} else {
								conn.offset.y = translate.y;
							}
						}
						if (conn.axis === "y") {
							if (typeof conn.offset.x === "number") {
								conn.offset.x += translate.x;
							} else {
								conn.offset.x = translate.x;
							}
						}
					}
				});
			}
		});
		for (const name in map) {
			const next = this.data.components.data.find((v) => v.name === name);
			if (next) {
				const newTranslate = translate.clone();
				if (map[name].x === undefined) {
					newTranslate.x = 0;
				}
				if (map[name].y === undefined) {
					newTranslate.y = 0;
				}
				this.moveComponent(next, newTranslate, curr);
			}
		}
	}

	reassembleComponents() {
		let data = this.data.components.data;
		this.data.components.data = [];
		data.forEach((component) => this.addComponent(component));
		data = null;
		let conntions = this.data.components.connections || [];
		this.data.components.connections = [];
		conntions.forEach((conn) => {
			try {
				this.assembleComponents(conn);
			} catch (error) {
				console.warn(error);
			}
		});
		conntions = null;
		return this;
	}

	get currentComponent() {
		return this._status.componentName;
	}

	set currentComponent(name: string) {
		this._status.componentName = name;
	}

	exportImage(format = "image/png", quality = 1) {
		this.app.render();
		return this.app.renderer.extract.image(null, format, quality);
	}

	flip(vertical = false, horizontal = false, anchor = new Point()) {
		this.transformEntities(this.data.entities, {flip: {vertical, horizontal, anchor}});
		this.calculateBaseLines();
		this.data.baseLines.forEach((l) => {
			const point = new Point(l.valueX, l.valueY).flip(vertical, horizontal, anchor);
			l.valueX = point.x;
			l.valueY = point.y;
		});
		this.data.jointPoints.forEach((p) => {
			const point = new Point(p.valueX, p.valueY).flip(vertical, horizontal, anchor);
			p.valueX = point.x;
			p.valueY = point.y;
		});
		if (this._status.partners.length) {
			this._status.partners.forEach((i) => {
				const partner = this.data.partners[i];
				this.transformEntities(partner.entities, {flip: {vertical, horizontal, anchor}});
				partner.jointPoints.forEach((p) => {
					const point = new Point(p.valueX, p.valueY).flip(vertical, horizontal, anchor);
					p.valueX = point.x;
					p.valueY = point.y;
				});
			});
			this.joinPartners();
		}
		this.data.components.data.forEach((v) => {
			this.transformEntities(v.entities, {flip: {vertical, horizontal, anchor}});
		});
		this.reassembleComponents();
		return this;
	}

	rotate(angle = 0, anchor?: Point) {
		if (!anchor) {
			const {top, right, bottom, left} = this.getBounds();
			anchor = new Point(left + right, top + bottom).multiply(0.5);
		}
		this.transformEntities(this.data.entities, {rotate: {angle, anchor}});
		this.calculateBaseLines();
		this.data.baseLines.forEach((l) => {
			const point = new Point(l.valueX, l.valueY).rotate(angle, anchor);
			l.valueX = point.x;
			l.valueY = point.y;
		});
		this.data.jointPoints.forEach((p) => {
			const point = new Point(p.valueX, p.valueY).rotate(angle, anchor);
			p.valueX = point.x;
			p.valueY = point.y;
		});
		if (this._status.partners.length) {
			this._status.partners.forEach((i) => {
				const partner = this.data.partners[i];
				this.transformEntities(partner.entities, {rotate: {angle, anchor}});
				partner.jointPoints.forEach((p) => {
					const point = new Point(p.valueX, p.valueY).rotate(angle, anchor);
					p.valueX = point.x;
					p.valueY = point.y;
				});
			});
			this.joinPartners();
		}
		this.data.components.data.forEach((v) => {
			this.transformEntities(v.entities, {rotate: {angle, anchor}});
		});
		this.reassembleComponents();
		return this;
	}

	flipPartner(id: string, vertical = false, horizontal = false, anchor = new Point()) {
		const partner = this.data.partners.find((v) => v.id === id);
		if (partner) {
			this.transformEntities(partner.entities, {flip: {vertical, horizontal, anchor}});
			partner.jointPoints.forEach((p) => {
				const point = new Point(p.valueX, p.valueY).flip(vertical, horizontal, anchor);
				p.valueX = point.x;
				p.valueY = point.y;
			});
			this.joinPartners();
		} else {
			console.warn(`partner ${id} not found.`);
		}
		return this;
	}

	flipComponent(name: string, vertical = false, horizontal = false, anchor = new Point()) {
		const component = this.data.components.data.find((v) => v.name === name);
		if (component) {
			this.transformEntities(component.entities, {flip: {vertical, horizontal, anchor}});
			this.reassembleComponents();
		} else {
			console.warn(`component ${name} not found.`);
		}
		return this;
	}

	rotatePartner(id: string, angle = 0, anchor?: Point) {
		const partner = this.data.partners.find((v) => v.id === id);
		if (partner) {
			this.transformEntities(partner.entities, {rotate: {angle, anchor}});
			partner.jointPoints.forEach((p) => {
				const point = new Point(p.valueX, p.valueY).rotate(angle, anchor);
				p.valueX = point.x;
				p.valueY = point.y;
			});
			this.joinPartners();
		} else {
			console.warn(`partner ${id} not found.`);
		}
		return this;
	}

	rotateComponent(name: string, angle = 0, anchor?: Point) {
		const component = this.data.components.data.find((v) => v.name === name);
		if (component) {
			this.transformEntities(component.entities, {rotate: {angle, anchor}});
			this.reassembleComponents();
		} else {
			console.warn(`component ${name} not found.`);
		}
		return this;
	}

	transformEntities(entities: CadEntities, transform: Tramsform) {
		const {translate, flip, rotate} = transform;
		entities.line?.forEach((entity) => {
			const line = new Line(new Point(entity.start), new Point(entity.end));
			if (translate) {
				line.start.add(translate);
				line.end.add(translate);
			}
			if (flip) {
				line.flip(flip.vertical, flip.horizontal, flip.anchor);
			}
			if (rotate) {
				line.rotate(rotate.angle, rotate.anchor);
			}
			entity.start = line.start.toArray();
			entity.end = line.end.toArray();
		});
		entities.arc?.forEach((entity) => {
			const start = new Angle(entity.start_angle, "deg");
			const end = new Angle(entity.end_angle, "deg");
			const arc = new Arc(new Point(entity.center), entity.radius, start, end, entity.clockwise);
			if (translate) {
				arc.center.add(translate);
			}
			if (flip) {
				arc.flip(flip.vertical, flip.horizontal, flip.anchor);
			}
			if (rotate) {
				arc.rotate(rotate.angle, rotate.anchor);
			}
			entity.center = arc.center.toArray();
			entity.start_angle = arc.startAngle.deg;
			entity.end_angle = arc.endAngle.deg;
			entity.clockwise = arc.clockwise;
		});
		entities.circle?.forEach((entity) => {
			if (translate) {
				entity.center[0] += translate.x;
				entity.center[1] += translate.y;
			}
			if (flip) {
				entity.center = new Point(entity.center).flip(flip.vertical, flip.horizontal, flip.anchor).toArray();
			}
			if (rotate) {
				entity.center = new Point(entity.center).rotate(rotate.angle, rotate.anchor).toArray();
			}
		});
		return this;
	}

	clone() {
		return new CadViewer(this.exportData(), this.width, this.height, cloneDeep(this.config));
	}

	cloneComponent(name: string) {
		const component = this.data.components.data.find((v) => v.name === name);
		if (component) {
			const newComponent = cloneDeep(component);
			const arr = component.name.split("-");
			let n = Number(arr[arr.length - 1]);
			let counter = 0;
			if (isNaN(n)) {
				newComponent.name = component.name + "-1";
			} else {
				let newName: string;
				do {
					arr[arr.length - 1] = (++n).toString();
					newName = arr.join("-");
					if (++counter >= 1000) {
						throw new Error("set name failed.");
					}
				} while (this.data.components.data.find((v) => v.name === newName));
				newComponent.name = newName;
			}
			this.flatEntities(newComponent).forEach((e) => {
				e.id = UUID.v1();
				this._purgeEntityData(e);
			});
			this.addComponent(newComponent);
		} else {
			console.warn(`component ${name} not found.`);
		}
		return this;
	}

	get width() {
		return parseInt(this.view.style.width, 10);
	}

	set width(value: number) {
		this.view.style.width = value + "px";
		this.app.view.width = value;
	}

	get height() {
		return parseInt(this.view.style.height, 10);
	}

	set height(value: number) {
		this.view.style.height = value + "px";
		this.app.view.height = value;
	}

	getBounds(entities?: CadEntities, mode = 0b111) {
		let maxX = -Infinity;
		let minX = Infinity;
		let maxY = -Infinity;
		let minY = Infinity;
		const calc = (point: Point) => {
			maxX = Math.max(point.x, maxX);
			maxY = Math.max(point.y, maxY);
			minX = Math.min(point.x, minX);
			minY = Math.min(point.y, minY);
		};
		let counter = 0;
		if (!entities) {
			entities = {line: [], arc: [], circle: [], dimension: [], mtext: [], hatch: []};
			for (const key in entities) {
				if (mode & 0b100) {
					entities[key] = entities[key].concat(this.data.entities[key]);
				}
				if (mode & 0b010) {
					this._status.partners.forEach((i) => {
						entities[key] = entities[key].concat(this.data.partners[i].entities[key]);
					});
				}
				if (mode & 0b001) {
					this.data.components.data.forEach((c) => {
						entities[key] = entities[key].concat(c.entities[key]);
					});
				}
			}
		}
		entities.line.forEach((entity) => {
			const {start, end} = entity as CadLine;
			calc(new Point(start));
			calc(new Point(end));
			counter++;
		});
		entities.arc.forEach((entity) => {
			const start = new Angle(entity.start_angle, "deg");
			const end = new Angle(entity.end_angle, "deg");
			const arc = new Arc(new Point(entity.center), entity.radius, start, end);
			calc(arc.startPoint);
			calc(arc.endPoint);
			counter++;
		});
		entities.circle.forEach((entity) => {
			const {center, radius} = entity;
			calc(new Point(center).add(radius));
			calc(new Point(center).sub(radius));
			counter++;
		});
		// let rect: PIXI.Rectangle;
		// entities.dimension.forEach((entity) => {
		// 	if (rect && entity.container) {
		// 		rect.enlarge(entity.container?.getLocalBounds());
		// 	} else {
		// 		rect = entity.container.getLocalBounds();
		// 	}
		// });
		// if (rect) {
		// 	maxX = Math.max(rect.right, maxX);
		// 	maxY = Math.max(rect.bottom, maxY);
		// 	minX = Math.min(rect.left, minX);
		// 	minY = Math.min(rect.top, minY);
		// }
		if (counter === 0) {
			return new Rectangle(new Point(), 0, 0);
		}
		return new Rectangle(new Point(minX, minY), maxX - minX, maxY - minY);
	}

	private _onEntityHover(event: PIXI.interaction.InteractionEvent, entity: CadEntity) {
		const {selectMode, hoverColor} = this.config;
		if (selectMode === "none" || !entity.selectable) {
			return;
		}
		if (!entity.selected) {
			this.render(false, null, [entity], {color: hoverColor});
		}
		this._emitter.emit(Events.entityhover, event, entity);
	}

	private _onEntityClick(event: PIXI.interaction.InteractionEvent, entity: CadEntity) {
		const {selectMode} = this.config;
		if (selectMode === "none" || !entity.selectable) {
			return;
		}
		entity.selected = !entity.selected;
		if (entity.selected && selectMode === "single") {
			this.unselectAll();
			entity.selected = true;
		}
		this.render(false, null, [entity]);
		this._emitter.emit(Events.entityclick, event, entity);
	}

	private _onEntityOut(event: PIXI.interaction.InteractionEvent, entity: CadEntity) {
		const {selectMode, hoverColor} = this.config;
		if (selectMode === "none" || !entity.selectable || typeof hoverColor !== "number") {
			return;
		}
		this.render(false, null, [entity]);
		this._emitter.emit(Events.entityout, event, entity);
	}

	private _createGhostSprite(entity: CadEntity, anchor: Point, name = "sprite") {
		// const sprite = new PIXI.Sprite(PIXI.Texture.from("static/images/sprite.jpg"));
		// sprite.alpha = 0.5;
		const sprite = new PIXI.Sprite();
		sprite.anchor.set(anchor.x, anchor.y);
		sprite.name = name;
		sprite.interactive = true;
		sprite.on("pointerover", (event) => this._onEntityHover(event, entity));
		sprite.on("pointerout", (event) => this._onEntityOut(event, entity));
		sprite.on("pointerdown", (event) => this._onEntityClick(event, entity));
		return sprite;
	}

	private _purgeEntityData(entity: CadEntity) {
		delete entity.container;
		delete entity.selected;
		delete entity.selectable;
		delete entity.lineWidth;
		if (typeof entity.colorRGB === "number") {
			entity.color = RGB2Index(entity.colorRGB);
		}
		delete entity.colorRGB;
	}

	private _sortComponents() {
		this.data.components.data.sort((a, b) => {
			const rect1 = this.getBounds(a.entities);
			const rect2 = this.getBounds(b.entities);
			return rect1.left - rect2.left;
		});
	}

	private _correctColor(color: number, threshold = 5) {
		if (typeof color === "number" && Math.abs(color - this.config.backgroundColor) <= threshold && this.config.reverseSimilarColor) {
			return 0xfffffff - color;
		}
		return color;
	}
}
