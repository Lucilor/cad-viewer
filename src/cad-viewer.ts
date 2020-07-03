import {
	Scene,
	PerspectiveCamera,
	WebGLRenderer,
	LineBasicMaterial,
	Vector2,
	Line,
	MathUtils,
	Raycaster,
	Geometry,
	Color,
	ShapeGeometry,
	Shape,
	Mesh,
	MeshBasicMaterial,
	Material,
	BufferGeometry,
	Vector3,
	LineDashedMaterial,
	BoxGeometry,
	AmbientLight
} from "three";
import Stats from "three/examples/jsm/libs/stats.module";
import {CadViewerControls, CadViewerControlsConfig} from "./cad-viewer-controls";
import TextSprite from "@seregpie/three.text-sprite";
import {CadEntity} from "./cad-data/cad-entity/cad-entity";
import {CadMtext} from "./cad-data/cad-entity/cad-mtext";
import {CadDimension} from "./cad-data/cad-entity/cad-dimension";
import {CadData} from "./cad-data/cad-data";
import {CadEntities} from "./cad-data/cad-entities";
import {CadLine} from "./cad-data/cad-entity/cad-line";
import {CadCircle} from "./cad-data/cad-entity/cad-circle";
import {CadArc} from "./cad-data/cad-entity/cad-arc";
import {CadHatch} from "./cad-data/cad-entity/cad-hatch";
import {CadStyle, CadStylizer} from "./cad-stylizer";
import {CadTypes} from "./cad-data/cad-types";

export interface CadViewerConfig {
	width?: number;
	height?: number;
	backgroundColor?: number;
	backgroundAlpha?: number;
	selectedColor?: number;
	hoverColor?: number;
	showLineLength?: number;
	showGongshi?: number;
	padding?: number[] | number;
	fps?: number;
	showStats?: boolean;
	reverseSimilarColor?: boolean;
	validateLines?: boolean;
}

export class CadViewer {
	private _renderTimer = {id: null, time: 0};
	private _destroyed = false;
	data: CadData;
	config: CadViewerConfig = {
		width: 300,
		height: 150,
		backgroundColor: 0,
		backgroundAlpha: 1,
		selectedColor: 0xffff00,
		hoverColor: 0x00ffff,
		showLineLength: 0,
		showGongshi: 0,
		padding: [0],
		fps: 60,
		showStats: false,
		reverseSimilarColor: true,
		validateLines: false
	};
	dom: HTMLDivElement;
	scene: Scene;
	camera: PerspectiveCamera;
	renderer: WebGLRenderer;
	raycaster = new Raycaster();
	controls: CadViewerControls;
	stats: Stats;
	stylizer: CadStylizer;
	get width() {
		return parseInt(this.dom.style.width, 10);
	}
	get height() {
		return parseInt(this.dom.style.height, 10);
	}
	get position() {
		return this.camera.position;
	}
	get scale() {
		const camera = this.camera;
		const fov = MathUtils.degToRad(camera.fov);
		const height = Math.tan(fov / 2) * camera.position.z * 2;
		return this.height / height;
	}
	set scale(value) {
		const camera = this.camera;
		const fov = MathUtils.degToRad(camera.fov);
		const z = this.height / value / 2 / Math.tan(fov / 2);
		camera.position.setZ(z);
	}
	get selectedEntities() {
		const result = this.data.getAllEntities().filter((e) => e.selected);
		return result;
	}

	constructor(data: CadData, config: CadViewerConfig = {}) {
		this.data = data;
		this.config = {...this.config, ...config};
		const {width, height, backgroundColor, backgroundAlpha} = this.config;

		const scene = new Scene();
		const camera = new PerspectiveCamera(60, width / height, 0.1, 15000);
		const renderer = new WebGLRenderer({preserveDrawingBuffer: true});
		renderer.setClearColor(backgroundColor, backgroundAlpha);
		renderer.setSize(width, height);

		camera.position.set(0, 0, 0);
		camera.lookAt(0, 0, 0);
		scene.add(new AmbientLight(0xffffff, 1));

		const dom = document.createElement("div");
		dom.appendChild(renderer.domElement);
		dom.id = data.id;
		dom.setAttribute("name", data.name);
		dom.classList.add("cad-viewer");
		this.dom = dom;
		this.scene = scene;
		this.camera = camera;
		this.renderer = renderer;
		this.scale = 1;
		this.stylizer = new CadStylizer(this);

		if (this.config.showStats) {
			this.stats = Stats();
			dom.appendChild(this.stats.dom);
		}

		const animate = () => {
			if (!this._destroyed) {
				requestAnimationFrame(animate.bind(this));
				const {renderer, camera, scene} = this;
				renderer?.render(scene, camera);
				this.stats?.update();
				this.controls?.update();
			}
		};
		animate();
		this.resize().render(true);
	}

	setControls(config?: CadViewerControlsConfig) {
		if (this.controls) {
			for (const name in this.controls.config) {
				if (config[name] !== undefined) {
					this.controls.config[name] = config[name];
				}
			}
		} else {
			this.controls = new CadViewerControls(this, config);
		}
		return this;
	}

	resize(width?: number, height?: number) {
		if (this._destroyed) {
			console.warn("This instance has already been destroyed.");
			return;
		}
		if (width > 0) {
			this.config.width = width;
		} else {
			width = this.config.width;
		}
		if (height > 0) {
			this.config.height = height;
		} else {
			height = this.config.height;
		}
		const {dom, renderer, camera} = this;
		dom.style.width = width + "px";
		dom.style.height = height + "px";
		dom.style.backgroundColor = new Color(this.config.backgroundColor).getStyle();
		renderer.setSize(width, height);
		camera.aspect = width / height;
		camera.updateProjectionMatrix();
		return this;
	}

	render(center = false, entities?: CadEntities, style: CadStyle = {}) {
		const {_destroyed, _renderTimer, config} = this;
		if (_destroyed) {
			console.warn("This instance has already been destroyed.");
			return this;
		}
		const now = new Date().getTime();
		const then = _renderTimer.time + (1 / config.fps) * 1000;
		if (now < then) {
			window.clearTimeout(_renderTimer.id);
			_renderTimer.id = setTimeout(() => this.render(center, entities, style), then - now);
			return this;
		}
		_renderTimer.time = now;
		if (!entities) {
			entities = this.data.getAllEntities();
		}
		if (center) {
			this.center();
		}
		entities.line.forEach((e) => this._drawLine(e, style));
		entities.arc.forEach((e) => this._drawArc(e, style));
		entities.circle.forEach((e) => this._drawCircle(e, style));
		entities.mtext.forEach((e) => this._drawMtext(e, style));
		entities.dimension.forEach((e) => this._drawDimension(e, style));
		entities.hatch.forEach((e) => this._drawHatch(e, style));
		return this;
	}

	center(entities?: CadEntities) {
		const rect = this.getBounds(entities);
		const {width, height} = this;
		let padding = this.config.padding;
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
		const scaleX = (width - padding[1] - padding[3]) / rect.width;
		const scaleY = (height - padding[0] - padding[2]) / rect.height;
		const scale = Math.min(scaleX, scaleY);
		const positionX = rect.x + (padding[1] - padding[3]) / scale / 2;
		const positionY = rect.y + (padding[0] - padding[2]) / scale / 2;
		this.scale = scale;
		this.position.setX(positionX);
		this.position.setY(positionY);
		return this;
	}

	getBounds(entities?: CadEntities) {
		if (!entities) {
			entities = this.data.getAllEntities();
		}
		return entities.getBounds();
	}

	private _setAnchor(sprite: TextSprite, position: Vector2, anchor: Vector2) {
		sprite.position.copy(new Vector3(position.x, position.y));
		const offset = anchor.clone().subScalar(0.5).multiply(new Vector2(-sprite.width, sprite.height));
		sprite.position.add(new Vector3(offset.x, offset.y));
	}

	private _setLineMaterial(entity: CadEntity, color: Color, linewidth: number, opacity: number) {
		const params = {color, linewidth, opacity, transparent: true};
		const object = entity.object as Line;
		if (entity.selected) {
			object.material = new LineDashedMaterial({...params, gapSize: 4});
			object.computeLineDistances();
		} else {
			object.material = new LineBasicMaterial(params);
		}
	}

	private _checkEntity(entity: CadEntity) {
		const {scene} = this;
		let canDraw = entity.visible;
		if (entity instanceof CadLine) {
			canDraw = canDraw && entity.length > 0;
		}
		if (entity instanceof CadDimension) {
			if (!entity.entity1 || !entity.entity2 || !entity.entity1.id || !entity.entity2.id) {
				canDraw = false;
			}
			const entity1 = this.data.findEntity(entity.entity1.id) as CadLine;
			const entity2 = this.data.findEntity(entity.entity2.id) as CadLine;
			if (!entity1 || entity1.opacity === 0 || !entity2 || entity2.opacity === 0) {
				canDraw = false;
			}
			if (!(entity1 instanceof CadLine) || !(entity2 instanceof CadLine)) {
				canDraw = false;
			}
		}
		if (!canDraw) {
			scene.remove(entity.object);
			entity.object = null;
		}
		return canDraw;
	}

	private _drawLine(entity: CadLine, style: CadStyle) {
		if (!this._checkEntity(entity)) {
			return;
		}
		const {scene, config, stylizer} = this;
		const {showLineLength, showGongshi, validateLines} = config;
		const {start, end, length, theta, valid} = entity;
		let object = entity.object;
		const middle = start.clone().add(end).divideScalar(2);
		const {linewidth, color, opacity, fontStyle} = stylizer.get(entity, style);
		const dx = Math.cos(Math.PI / 2 - theta) * linewidth;
		const dy = Math.sin(Math.PI / 2 - theta) * linewidth;
		const shape = new Shape();
		shape.moveTo(start.x + dx, start.y - dy);
		shape.lineTo(end.x + dx, end.y - dy);
		shape.lineTo(end.x - dx, end.y + dy);
		shape.lineTo(start.x - dx, start.y + dy);
		shape.closePath();

		const colorStr = stylizer.getColorStyle(color, opacity);
		if (object) {
			object.geometry = new BufferGeometry().setFromPoints([start, end]);
			this._setLineMaterial(entity, color, linewidth, opacity);
		} else {
			const geometry = new BufferGeometry().setFromPoints([start, end]);
			const material = new LineBasicMaterial({color, linewidth});
			object = new Line(geometry, material);
			object.name = entity.id;
			scene.add(object);
			entity.object = object;
		}

		const anchor = new Vector2(0.5, 1);
		let gongshi = "";
		if (entity.mingzi) {
			gongshi += entity.mingzi;
		}
		if (entity.gongshi) {
			gongshi += "=" + entity.gongshi;
		}
		if (entity.isVertical(1)) {
			anchor.set(1, 0.5);
			gongshi = gongshi.split("").join("\n");
		}
		const anchor2 = new Vector2(1 - anchor.x, 1 - anchor.y);
		let lengthText = object.children.find((o) => o.name === entity.id + "-length") as TextSprite;
		let gongshiText = object.children.find((o) => o.name === entity.id + "-gongshi") as TextSprite;
		if (showLineLength > 0) {
			if (lengthText) {
				lengthText.text = Math.round(length).toString();
			} else {
				lengthText = new TextSprite({text: Math.round(length).toString()});
				lengthText.name = entity.id + "-length";
				object.add(lengthText);
			}
			lengthText.fontSize = showLineLength;
			lengthText.fillStyle = colorStr;
			lengthText.fontStyle = fontStyle;
			this._setAnchor(lengthText, middle, anchor);
		} else {
			object.remove(lengthText);
		}
		if (showGongshi > 0) {
			if (gongshiText) {
				gongshiText.text = gongshi;
			} else {
				gongshiText = new TextSprite({text: gongshi});
				gongshiText.name = entity.id + "-gongshi";
				object.add(gongshiText);
			}
			gongshiText.fontSize = showLineLength;
			gongshiText.fillStyle = colorStr;
			gongshiText.fontStyle = fontStyle;
			this._setAnchor(gongshiText, middle, anchor2);
		} else {
			object.remove(gongshiText);
		}

		let rect = object.children.find((o) => o.name === entity.id + "-rect") as Mesh;
		if (validateLines && !valid) {
			if (rect) {
			} else {
				const geometry = new BoxGeometry(length, 6, 1);
				const material = new MeshBasicMaterial({color: 0xff0000});
				rect = new Mesh(geometry, material);
				object.add(rect);
				rect.name = entity.id + "-rect";
			}
			rect.rotation.set(0, 0, 0);
			rect.rotateOnAxis(new Vector3(0, 0, 1), theta);
			rect.position.set(middle.x, middle.y, 0);
		} else {
			object.remove(rect);
		}
	}

	private _drawCircle(entity: CadCircle, style: CadStyle) {
		if (!this._checkEntity(entity)) {
			return;
		}
		const {scene} = this;
		const {curve} = entity;
		let object = entity.object;
		const points = curve.getPoints(50);
		const {linewidth, color, opacity} = this.stylizer.get(entity, style);
		if (object) {
			object.geometry = new Geometry().setFromPoints(points);
			this._setLineMaterial(entity, color, linewidth, opacity);
		} else {
			const geometry = new Geometry().setFromPoints(points);
			const material = new LineBasicMaterial({color, linewidth});
			object = new Line(geometry, material);
			object.name = entity.id;
			scene.add(object);
			entity.object = object;
		}
	}

	private _drawArc(entity: CadArc, style: CadStyle) {
		if (!this._checkEntity(entity)) {
			return;
		}
		const {scene} = this;
		const {curve} = entity;
		let object = entity.object;
		const points = curve.getPoints(50);
		const {linewidth: linewidth, color, opacity} = this.stylizer.get(entity, style);
		if (object) {
			object.geometry = new Geometry().setFromPoints(points);
			this._setLineMaterial(entity, color, linewidth, opacity);
		} else {
			const geometry = new Geometry().setFromPoints(points);
			const material = new LineBasicMaterial({color, linewidth});
			object = new Line(geometry, material);
			object.name = entity.id;
			scene.add(object);
			entity.object = object;
		}
	}

	private _drawMtext(entity: CadMtext, style: CadStyle) {
		if (!this._checkEntity(entity)) {
			return;
		}
		const {scene, stylizer} = this;
		const {fontSize, color, opacity, fontStyle} = stylizer.get(entity, style);
		let object = entity.object as TextSprite;
		const colorStr = stylizer.getColorStyle(color, opacity);
		const text = entity.text || "";
		if (object) {
			object.text = entity.text;
			object.fontSize = fontSize * 1.25;
			object.fillStyle = colorStr;
			object.fontStyle = fontStyle;
		} else {
			object = new TextSprite({fontSize: fontSize * 1.25, fillStyle: colorStr, text, fontStyle});
			object.padding = 0.1;
			object.align = "left";
			object.name = entity.id;
			scene.add(object);
			entity.object = object;
		}
		this._setAnchor(object, entity.insert, entity.anchor);
	}

	private _drawDimension(entity: CadDimension, style: CadStyle) {
		if (!this._checkEntity(entity)) {
			return;
		}
		const {scene, stylizer} = this;
		const {mingzi, qujian, axis, distance} = entity;
		let object = entity.object;
		const {linewidth, color, fontSize, opacity} = stylizer.get(entity, style);
		const colorStr = stylizer.getColorStyle(color, opacity);

		let {point1: p1, point2: p2} = this.data.getDimensionPoints(entity);
		let p3 = p1.clone();
		let p4 = p2.clone();
		const arrow1: Vector2[] = [];
		const arrow2: Vector2[] = [];
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
			arrow1[0] = p3.clone();
			arrow1[1] = arrow1[0].clone().add(new Vector2(arrowLength, -arrowSize));
			arrow1[2] = arrow1[0].clone().add(new Vector2(arrowLength, arrowSize));
			arrow2[0] = p4.clone();
			arrow2[1] = arrow2[0].clone().add(new Vector2(-arrowLength, -arrowSize));
			arrow2[2] = arrow2[0].clone().add(new Vector2(-arrowLength, arrowSize));
		}
		if (axis === "y") {
			const x = Math.max(p3.x, p4.x);
			p3.x = x + distance;
			p4.x = x + distance;
			if (p3.y < p4.y) {
				[p3, p4] = [p4, p3];
				[p1, p2] = [p2, p1];
			}
			arrow1[0] = p3.clone();
			arrow1[1] = arrow1[0].clone().add(new Vector2(-arrowSize, -arrowLength));
			arrow1[2] = arrow1[0].clone().add(new Vector2(arrowSize, -arrowLength));
			arrow2[0] = p4.clone();
			arrow2[1] = arrow2[0].clone().add(new Vector2(-arrowSize, arrowLength));
			arrow2[2] = arrow2[0].clone().add(new Vector2(arrowSize, arrowLength));
		}

		const geometry = new Geometry().setFromPoints([p1, p3, p4, p2]);
		if (object) {
			object.remove(...object.children);
			object.geometry = geometry;
			this._setLineMaterial(entity, color, linewidth, opacity);
		} else {
			const material = new LineBasicMaterial({color, linewidth, opacity, transparent: true});
			object = new Line(geometry, material);
			object.renderOrder = -1;
			object.name = entity.id;
			scene.add(object);
			entity.object = object;
		}

		const arrowShape1 = new Shape();
		arrowShape1.moveTo(arrow1[0].x, arrow1[0].y);
		arrowShape1.lineTo(arrow1[1].x, arrow1[1].y);
		arrowShape1.lineTo(arrow1[2].x, arrow1[2].y);
		arrowShape1.closePath();
		const arrowShape2 = new Shape();
		arrowShape2.moveTo(arrow2[0].x, arrow2[0].y);
		arrowShape2.lineTo(arrow2[1].x, arrow2[1].y);
		arrowShape2.lineTo(arrow2[2].x, arrow2[2].y);
		arrowShape2.closePath();
		object.add(new Mesh(new ShapeGeometry([arrowShape1, arrowShape2]), new MeshBasicMaterial({color, opacity, transparent: true})));
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
		text = text.replace("<>", p3.distanceTo(p4).toFixed(2));
		if (axis === "y") {
			text = text.split("").join("\n");
		}
		const sprite = new TextSprite({fontSize, fillStyle: colorStr, text});
		const midPoint = new Vector2().add(p3).add(p4).divideScalar(2);
		sprite.position.copy(midPoint);
		if (axis === "x") {
			this._setAnchor(sprite, midPoint, new Vector2(0.5, 1));
		}
		if (axis === "y") {
			sprite.lineGap = 0;
			this._setAnchor(sprite, midPoint, new Vector2(0, 0.5));
		}
		object.add(sprite);
	}

	private _drawHatch(entity: CadHatch, style: CadStyle) {
		if (!this._checkEntity(entity)) {
			return;
		}
		const {scene} = this;
		const {paths} = entity;
		let object = entity.object;
		const {color, opacity} = this.stylizer.get(entity, style);
		const shapes = [];
		paths.forEach((path) => {
			const shape = new Shape();
			path.edges.forEach((edge, i) => {
				if (i === 0) {
					shape.moveTo(edge.end.x, edge.end.y);
				} else {
					shape.lineTo(edge.end.x, edge.end.y);
				}
			});
			if (path.vertices.length === 4) {
				shape.moveTo(path.vertices[0].x, path.vertices[0].y);
				shape.lineTo(path.vertices[1].x, path.vertices[1].y);
				shape.lineTo(path.vertices[2].x, path.vertices[2].y);
				shape.lineTo(path.vertices[3].x, path.vertices[3].y);
			}
			shape.closePath();
			shapes.push(shape);
		});
		const geometry = new ShapeGeometry(shapes);
		const material = new MeshBasicMaterial({color, opacity, transparent: true});
		if (object) {
			object.geometry = geometry;
			object.material = material;
		} else {
			object = new Mesh(geometry, material);
			object.name = entity.id;
			scene.add(object);
			entity.object = object;
		}
	}

	selectAll() {
		this.data.getAllEntities().forEach((e) => (e.selected = e.selectable));
		return this.render();
	}

	unselectAll() {
		this.data.getAllEntities().forEach((e) => (e.selected = false));
		return this.render();
	}

	exportImage(type?: string, quality?: any) {
		const image = new Image();
		const {renderer, scene, camera} = this;
		renderer.render(scene, camera);
		image.src = renderer.domElement.toDataURL(type, quality);
		return image;
	}

	destroy() {
		if (this._destroyed) {
			console.warn("This instance has already been destroyed.");
		} else {
			this.scene.dispose();
			this.renderer.dispose();
			this.data.getAllEntities().forEach((e) => {
				const object = e.object as Mesh;
				if (object) {
					object.geometry.dispose();
					if (object.material instanceof Material) {
						object.material.dispose();
					} else {
						object.material.forEach((m) => m.dispose());
					}
				}
			});
			this.dom.remove();
			for (const key in this) {
				try {
					this[key] = null;
				} catch (error) {}
			}
			this._destroyed = true;
		}
	}

	reset(data?: CadData, center = true) {
		this.data.getAllEntities().forEach((e) => this.scene.remove(e.object));
		if (data instanceof CadData) {
			this.data = data;
		} else if (data) {
			// this.data = new CadData(data);
		}
		return this.render(center);
	}

	getScreenPoint(point: Vector2) {
		const result = new Vector2();
		const {scale, width, height, position} = this;
		result.x = (point.x - position.x) * scale + width / 2;
		result.y = height / 2 - (point.y - position.y) * scale;
		return result;
	}

	getWorldPoint(point: Vector2) {
		const result = new Vector2();
		const {scale, width, height, position} = this;
		result.x = (point.x - width / 2) / scale + position.x;
		result.y = (height / 2 - point.y) / scale + position.y;
		return result;
	}

	traverse(callback: (e: CadEntity) => void, entities = this.data.getAllEntities(), include?: (keyof CadTypes)[]) {
		entities.forEach((e) => callback(e), include);
		return this;
	}

	addEntity(entity: CadEntity) {
		this.data.entities.add(entity);
		return this.render();
	}

	removeEntity(entity: CadEntity) {
		this.removeEntities(new CadEntities().add(entity));
	}

	addEntities(entities: CadEntities) {
		this.data.entities.merge(entities);
		return this.render();
	}

	removeEntities(entities: CadEntities) {
		entities.forEach((e) => {
			this.scene.remove(e.object);
			e.object = null;
		});
		const data = new CadData();
		data.entities = entities;
		this.data.separate(data);
		return this.render();
	}
}
