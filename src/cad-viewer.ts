import {
	Scene,
	PerspectiveCamera,
	WebGLRenderer,
	LineBasicMaterial,
	Vector2,
	Line,
	Object3D,
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
	Vector3
} from "three";
import Stats from "three/examples/jsm/libs/stats.module";
import {CadViewerControls, CadViewerControlsConfig} from "./cad-viewer-controls";
import TextSprite from "@seregpie/three.text-sprite";
import {CadTypes} from "./cad-data/cad-types";
import {CadEntity} from "./cad-data/cad-entity";
import {CadMtext} from "./cad-data/cad-entity/cad-mtext";
import {CadDimension} from "./cad-data/cad-entity/cad-dimension";
import {CadData} from "./cad-data";
import {CadEntities} from "./cad-data/cad-entities";
import {CadLine} from "./cad-data/cad-entity/cad-line";
import {CadCircle} from "./cad-data/cad-entity/cad-circle";
import {CadArc} from "./cad-data/cad-entity/cad-arc";
import {CadHatch} from "./cad-data/cad-entity/cad-hatch";

export class CadStyle {
	color?: number;
	lineWidth?: number;
	fontSize?: number;
	visible?: boolean;
	constructor(
		params: {color?: number; lineWidth?: number; fontSize?: number; visible?: boolean} = {},
		cad?: CadViewer,
		entity?: CadEntity
	) {
		const {selectable, selected, hover} = cad.objects[entity?.id]?.userData || {};
		this.color = params.color || entity?.color || 0;
		if (selectable) {
			if (selected && typeof cad.config.selectedColor === "number") {
				this.color = cad.config.selectedColor;
			} else if (hover && typeof cad.config.hoverColor === "number") {
				this.color = cad.config.hoverColor;
			}
		}
		if (cad.config.reverseSimilarColor) {
			this.color = cad.correctColor(this.color);
		}
		this.lineWidth = params.lineWidth || 1;
		let eFontSize: number = null;
		if (entity instanceof CadMtext || entity instanceof CadDimension) {
			eFontSize = entity.font_size;
		}
		this.fontSize = params.fontSize || eFontSize || 16;
		this.visible = params.visible === false ? false : entity.visible;
	}
}

export interface CadViewerConfig {
	width?: number;
	height?: number;
	backgroundColor?: number;
	backgroundAlpha?: number;
	selectedColor?: number;
	hoverColor?: number;
	showLineLength?: number;
	padding?: number[] | number;
	fps?: number;
	showStats?: boolean;
	reverseSimilarColor?: true;
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
		padding: [0],
		fps: 60,
		showStats: false,
		reverseSimilarColor: true
	};
	dom: HTMLDivElement;
	scene: Scene;
	camera: PerspectiveCamera;
	renderer: WebGLRenderer;
	objects: {[key: string]: CadViewer["currentObject"]} = {};
	raycaster = new Raycaster();
	currentObject: Mesh | Line | TextSprite;
	controls: CadViewerControls;
	stats: Stats;
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
		const result = this.data.getAllEntities().filter((e) => {
			const object = this.objects[e.id];
			return object && object.userData.selected;
		});
		return result;
	}

	constructor(data: CadData, config: CadViewerConfig = {}) {
		this.data = data;
		this.config = {...this.config, ...config};
		const {width, height, padding, backgroundColor, backgroundAlpha} = this.config;
		if (typeof padding === "number") {
			this.config.padding = [padding, padding, padding, padding];
		} else if (!Array.isArray(padding) || padding.length === 0) {
			this.config.padding = [0, 0, 0, 0];
		} else if (padding.length === 0) {
			this.config.padding = [0, 0, 0, 0];
		} else if (padding.length === 1) {
			this.config.padding = [padding[0], padding[0], padding[0], padding[0]];
		} else if (padding.length === 2) {
			this.config.padding = [padding[0], padding[1], padding[0], padding[1]];
		} else if (padding.length === 3) {
			this.config.padding = [padding[0], padding[1], padding[0], padding[2]];
		}

		const scene = new Scene();
		const camera = new PerspectiveCamera(60, width / height, 0.1, 15000);
		const renderer = new WebGLRenderer({preserveDrawingBuffer: true});
		renderer.setClearColor(backgroundColor, backgroundAlpha);
		renderer.setSize(width, height);

		camera.position.set(0, 0, 0);
		camera.lookAt(0, 0, 0);

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

	render(center = false, entities?: CadEntities, style?: CadStyle) {
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
		const padding = this.config.padding;
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

	private _drawLine(entity: CadLine, style: CadStyle = {}) {
		const {scene, objects, config} = this;
		const showLineLength = config.showLineLength;
		const {start, end, length} = entity;
		const middle = start.clone().add(end).divideScalar(2);
		const {lineWidth, color, visible} = new CadStyle(style, this, entity);
		let object = objects[entity.id] as Line;
		if (length <= 0) {
			scene.remove(object);
			delete objects[entity.id];
			return;
		}
		const colorStr = new Color(color).getStyle();
		const slope = (start.y - end.y) / (start.x - end.x);
		const anchor = new Vector2(0.5, 0.5);
		if (slope === 0) {
			anchor.y = 1;
		}
		if (!isFinite(slope)) {
			anchor.x = 1;
		}
		if (object) {
			object.geometry = new BufferGeometry().setFromPoints([start, end]);
			(object.material as LineBasicMaterial).setValues({color, linewidth: lineWidth});
			const lengthText = object.children.find((o) => (o as any).isTextSprite) as TextSprite;
			if (lengthText) {
				lengthText.text = Math.round(length).toString();
				lengthText.fontSize = showLineLength;
				lengthText.fillStyle = colorStr;
				this._setAnchor(lengthText, middle, anchor);
			}
		} else {
			const geometry = new BufferGeometry().setFromPoints([start, end]);
			const material = new LineBasicMaterial({color, linewidth: lineWidth});
			object = new Line(geometry, material);
			object.userData.selectable = true;
			object.name = entity.id;
			objects[entity.id] = object;
			scene.add(object);
			if (showLineLength > 0) {
				const lengthText = new TextSprite({fontSize: showLineLength, fillStyle: colorStr, text: Math.round(length).toString()});
				lengthText.padding = 0;
				this._setAnchor(lengthText, middle, anchor);
				object.add(lengthText);
			}
		}
		object.visible = visible;
	}

	private _drawCircle(entity: CadCircle, style: CadStyle = {}) {
		const {scene, objects} = this;
		const {curve} = entity;
		const points = curve.getPoints(50);
		const {lineWidth, color, visible} = new CadStyle(style, this, entity);
		let object = objects[entity.id] as Line;
		if (object) {
			object.geometry = new Geometry().setFromPoints(points);
			(object.material as LineBasicMaterial).setValues({color, linewidth: lineWidth});
		} else {
			const geometry = new Geometry().setFromPoints(points);
			const material = new LineBasicMaterial({color, linewidth: lineWidth});
			object = new Line(geometry, material);
			object.userData.selectable = true;
			object.name = entity.id;
			objects[entity.id] = object;
			scene.add(object);
		}
		object.visible = visible;
	}

	private _drawArc(entity: CadArc, style: CadStyle = {}) {
		const {scene, objects} = this;
		const {curve} = entity;
		const points = curve.getPoints(50);
		const {lineWidth, color, visible} = new CadStyle(style, this, entity);
		let object = objects[entity.id] as Line;
		if (!visible) {
			scene.remove(object);
			delete objects[entity.id];
			return;
		}
		if (object) {
			object.geometry = new Geometry().setFromPoints(points);
			(object.material as LineBasicMaterial).setValues({color, linewidth: lineWidth});
		} else {
			const geometry = new Geometry().setFromPoints(points);
			const material = new LineBasicMaterial({color, linewidth: lineWidth});
			object = new Line(geometry, material);
			object.userData.selectable = true;
			object.name = entity.id;
			objects[entity.id] = object;
			scene.add(object);
		}
		object.visible = visible;
	}

	private _drawMtext(entity: CadMtext, style: CadStyle = {}) {
		const {scene, objects} = this;
		const {fontSize, color, visible} = new CadStyle(style, this, entity);
		let object = objects[entity.id] as TextSprite;
		const colorStr = "#" + new Color(color).getHexString();
		const text = entity.text || "";
		if (object) {
			object.text = entity.text;
			object.fontSize = fontSize * 1.25;
			object.fillStyle = colorStr;
		} else {
			object = new TextSprite({fontSize: fontSize * 1.25, fillStyle: colorStr, text});
			object.userData.selectable = false;
			object.name = entity.id;
			object.padding = 0;
			objects[entity.id] = object;
			scene.add(object);
		}
		this._setAnchor(object, entity.insert, entity.anchor);
		object.visible = visible;
	}

	private _drawDimension(entity: CadDimension, style: CadStyle = {}) {
		const {scene, objects} = this;
		const {mingzi, qujian, axis, distance} = entity;
		const {lineWidth, color, fontSize, visible} = new CadStyle(style, this, entity);
		let object = objects[entity.id] as Line;
		const colorStr = "#" + new Color(color).getHexString();
		let canDraw = true;
		if (!entity.entity1 || !entity.entity2 || !entity.entity1.id || !entity.entity2.id) {
			canDraw = false;
		}
		const entity1 = this.data.findEntity(entity.entity1?.id) as CadLine;
		const entity2 = this.data.findEntity(entity.entity2?.id) as CadLine;
		if (!entity1 || !entity1.visible || !entity2 || !entity2.visible) {
			canDraw = false;
		}
		if (!(entity1 instanceof CadLine) || !(entity2 instanceof CadLine)) {
			canDraw = false;
		}
		if (!canDraw) {
			scene.remove(object);
			delete objects[entity.id];
			return;
		}

		const getPoint = (e: CadLine, location: string) => {
			if (location === "start") {
				return e.start;
			}
			if (location === "end") {
				return e.start;
			}
			if (location === "center") {
				return e.start.add(e.end).divideScalar(2);
			}
		};
		let p1 = getPoint(entity1, entity.entity1.location);
		let p2 = getPoint(entity2, entity.entity2.location);
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

		if (object) {
			object = objects[entity.id] as Line;
			object.remove(...object.children);
			object.geometry = new Geometry().setFromPoints([p1, p3, p4, p2]);
		} else {
			const geometry = new Geometry().setFromPoints([p1, p3, p4, p2]);
			const material = new LineBasicMaterial({color, linewidth: lineWidth});
			object = new Line(geometry, material);
			object.renderOrder = -1;
			object.userData.selectable = false;
			object.name = entity.id;
			objects[entity.id] = object;
			scene.add(object);
		}
		object.visible = visible;

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
		object.add(new Mesh(new ShapeGeometry([arrowShape1, arrowShape2]), new MeshBasicMaterial({color})));
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

	private _drawHatch(entity: CadHatch, style: CadStyle = {}) {
		const {scene, objects} = this;
		const {paths} = entity;
		const {color, visible} = new CadStyle(style, this, entity);
		let object = objects[entity.id] as Mesh;
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
		const material = new MeshBasicMaterial({color});
		if (object) {
			object.geometry = geometry;
			object.material = material;
		} else {
			object = new Mesh(geometry, material);
			object.name = entity.id;
			objects[entity.id] = object;
			scene.add(object);
		}
		object.visible = visible;
	}

	correctColor(color: number, threshold = 5) {
		if (typeof color === "number" && Math.abs(color - this.config.backgroundColor) <= threshold) {
			return 0xfffffff - color;
		}
		return color;
	}

	selectAll() {
		Object.values(this.objects).forEach((o) => (o.userData.selected = o.userData.selectable));
		return this.render();
	}

	unselectAll() {
		Object.values(this.objects).forEach((o) => (o.userData.selected = false));
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
			for (const key in this.objects) {
				this.objects[key].geometry.dispose();
				(this.objects[key].material as Material).dispose();
			}
			this.dom.remove();
			for (const key in this) {
				try {
					this[key] = null;
				} catch (error) {}
			}
			this._destroyed = true;
		}
	}

	reset(data?: CadData) {
		this.scene.remove(...Object.values(this.objects));
		this.objects = {};
		if (data instanceof CadData) {
			this.data = data;
		} else if (data) {
			// this.data = new CadData(data);
		}
		return this.render(true);
	}

	translatePoint(point: Vector2 | Vector2) {
		const result = new Vector2();
		const {scale, width, height} = this;
		result.x = (point.x - this.position.x) * scale + width / 2;
		result.y = height / 2 - (point.y - this.position.y) * scale;
		return result;
	}

	traverse(callback: (o: Object3D, e: CadEntity) => void, entities = this.data.getAllEntities(), include?: (keyof CadTypes)[]) {
		entities.forEach((e) => this.objects[e.id]?.traverse((o) => callback(o, e)), include);
	}

	addEntities(entities: CadEntities) {
		this.data.entities.merge(entities);
		return this.render();
	}

	removeEntities(entities: CadEntities) {
		this.data.entities.separate(entities);
		this.data.partners.forEach((d) => d.entities.separate(entities));
		this.data.components.data.forEach((d) => d.entities.separate(entities));
		entities.forEach((e) => {
			this.scene.remove(this.objects[e.id]);
			delete this.objects[e.id];
		});
		return this.render();
	}
}
