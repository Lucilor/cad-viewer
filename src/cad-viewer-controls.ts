import {CadViewer} from "./cad-viewer";
import {Vector2, Vector3, Line, LineBasicMaterial, Object3D, MathUtils, Box2, Mesh, Geometry} from "three";
import {EventEmitter} from "events";
import {CadEntity} from "./cad-data/cad-entity/cad-entity";
import {CadEntities} from "./cad-data/cad-entities";
import {CadDimension} from "./cad-data/cad-entity/cad-dimension";

export interface CadViewerControlsConfig {
	dragAxis?: "x" | "y" | "xy" | "";
	selectMode?: "none" | "single" | "multiple";
	selectable?: boolean;
	maxScale?: number;
	minScale?: number;
	enableScale?: boolean;
}

export interface CadEvents {
	entityselect: [PointerEvent, CadEntity, Object3D];
	entityunselect: [PointerEvent, CadEntity, Object3D];
	entitiesselect: [PointerEvent, never, never];
	entitiesunselect: [PointerEvent, never, never];
	dragstart: [PointerEvent, never, never];
	drag: [PointerEvent, never, never];
	dragend: [PointerEvent, never, never];
	click: [PointerEvent, never, never];
	wheel: [WheelEvent, never, never];
	keyboard: [KeyboardEvent, never, never];
	// move = "move",
	// scale = "scale"
}

export class CadViewerControls {
	cad: CadViewer;
	config: CadViewerControlsConfig = {
		dragAxis: "xy",
		selectMode: "none",
		selectable: true,
		maxScale: 100,
		minScale: 0.1,
		enableScale: true
	};
	currentObject: Object3D;
	private _status = {
		pFrom: new Vector2(),
		pTo: new Vector2(),
		dragging: false,
		button: NaN,
		pointerLock: false,
		ctrl: false
	};
	private _multiSelector: HTMLDivElement;
	private _emitter = new EventEmitter();
	constructor(cad: CadViewer, config?: CadViewerControlsConfig) {
		this.cad = cad;
		const dom = cad.dom;
		if (typeof config === "object") {
			for (const name in this.config) {
				if (config[name] !== undefined) {
					this.config[name] = config[name];
				}
			}
		}

		this._multiSelector = document.createElement("div");
		this._multiSelector.classList.add("cad-multi-selector");
		this._multiSelector.style.position = "absolute";
		this._multiSelector.style.backgroundColor = "rgba(29, 149, 234, 0.3)";
		this._multiSelector.style.border = "white solid 1px";
		this._multiSelector.hidden = true;
		dom.appendChild(this._multiSelector);

		dom.addEventListener("pointerdown", this._pointerDown.bind(this));
		dom.addEventListener("pointermove", this._pointerMove.bind(this));
		dom.addEventListener("pointerup", this._pointerUp.bind(this));
		dom.addEventListener("pointerleave", this._pointerUp.bind(this));
		dom.addEventListener("wheel", this._wheel.bind(this));
		dom.addEventListener("keydown", this._keyDown.bind(this));
		dom.addEventListener("keyup", this._keyUp.bind(this));
		dom.tabIndex = 0;
		dom.focus();
	}

	update() {
		// const {config, _status} = this;
		// if (config.selectMode !== "none" && !_status.pointerLock) {
		// 	this._hover();
		// }
	}

	on<K extends keyof CadEvents>(
		event: K,
		listener: (event: CadEvents[K][0], entity?: CadEvents[K][1], object?: CadEvents[K][2]) => void
	) {
		this._emitter.on(event, listener);
	}

	// Normalized Device Coordinate
	private _getNDC(point: Vector2) {
		const rect = this.cad.dom.getBoundingClientRect();
		return new Vector3(((point.x - rect.left) / rect.width) * 2 - 1, (-(point.y - rect.top) / rect.height) * 2 + 1, 0.5);
	}

	private _getInterSection(pointer: Vector2) {
		const {raycaster, camera, objects} = this.cad;
		const points = [pointer];
		const d = 1;
		points.push(pointer.clone().add(new Vector2(d, 0)));
		points.push(pointer.clone().add(new Vector2(0, d)));
		points.push(pointer.clone().add(new Vector2(-d, 0)));
		points.push(pointer.clone().add(new Vector2(0, -d)));
		points.push(pointer.clone().add(new Vector2(2 * d, 0)));
		points.push(pointer.clone().add(new Vector2(0, 2 * d)));
		points.push(pointer.clone().add(new Vector2(-2 * d, 0)));
		points.push(pointer.clone().add(new Vector2(0, -2 * d)));
		for (const p of points) {
			raycaster.setFromCamera(this._getNDC(p), camera);
			const intersects = raycaster.intersectObjects(Object.values(objects), true);
			let intersect = intersects[0]?.object;
			if (intersect) {
				while (intersect.parent.type !== "Scene") {
					intersect = intersect.parent;
				}
				if (intersect.visible) {
					console.log(intersects);
					return intersect;
				}
			}
		}
		return null;
	}

	private _pointerDown(event: PointerEvent) {
		const {clientX: x, clientY: y} = event;
		this._status.pFrom.set(x, y);
		this._status.pTo.set(x, y);
		this._status.dragging = true;
		this._status.button = event.button;
		const name: keyof CadEvents = "dragstart";
		this._emitter.emit(name, event);
	}

	private _pointerMove(event: PointerEvent) {
		const p = new Vector2(event.clientX, event.clientY);
		const {cad, _status} = this;
		const {button, dragging, pFrom, pTo} = _status;
		const offset = new Vector2(p.x - pTo.x, pTo.y - p.y);
		offset.divideScalar(cad.scale);
		if (dragging) {
			if (button === 1 || (event.shiftKey && button === 0)) {
				if (!this.config.dragAxis.includes("x")) {
					offset.x = 0;
				}
				if (!this.config.dragAxis.includes("y")) {
					offset.y = 0;
				}
				cad.position.sub(new Vector3(offset.x, offset.y, 0));
			} else if (button === 0) {
				let triggerMultiple = this.config.selectMode === "multiple";
				triggerMultiple = !this._dragObject(p, offset);
				if (triggerMultiple) {
					this._multiSelector.hidden = false;
					this._multiSelector.style.left = Math.min(pFrom.x, pTo.x) + "px";
					this._multiSelector.style.top = Math.min(pFrom.y, pTo.y) + "px";
					this._multiSelector.style.width = Math.abs(pFrom.x - pTo.x) + "px";
					this._multiSelector.style.height = Math.abs(pFrom.y - pTo.y) + "px";
				}
			}
			const name: keyof CadEvents = "drag";
			this._emitter.emit(name, event);
		}
		if (this.config.selectMode !== "none" && !this._status.pointerLock) {
			this._hover();
		}
		_status.pTo.copy(p);
		_status.ctrl = event.ctrlKey;
	}

	private _pointerUp(event: PointerEvent) {
		const {cad, _status} = this;
		const {camera, objects} = cad;
		const {pFrom, pTo, dragging, ctrl} = _status;
		if (dragging) {
			if (this._multiSelector.hidden === false) {
				this._multiSelector.hidden = true;
				const from = this._getNDC(pFrom);
				const to = this._getNDC(pTo);
				if (from.x > to.x) {
					[from.x, to.x] = [to.x, from.x];
				}
				if (from.y > to.y) {
					[from.y, to.y] = [to.y, from.y];
				}
				const fov = MathUtils.degToRad(camera.fov);
				const h = Math.tan(fov / 2) * camera.position.z * 2;
				const w = camera.aspect * h;
				const {x, y} = camera.position;
				const x1 = x + (w / 2) * from.x;
				const x2 = x + (w / 2) * to.x;
				const y1 = y + (h / 2) * from.y;
				const y2 = y + (h / 2) * to.y;
				const box = new Box2(new Vector2(x1, y1), new Vector2(x2, y2));
				const toSelect = [];
				for (const key in objects) {
					const object = objects[key];
					object.geometry.computeBoundingBox();
					const {min, max} = object.geometry.boundingBox;
					const objBox = new Box2(new Vector2(min.x, min.y), new Vector2(max.x, max.y));
					if (box.containsBox(objBox) && object.userData.selectable) {
						toSelect.push(object);
					}
				}
				if (toSelect.every((o) => o.userData.selected)) {
					toSelect.forEach((o) => (o.userData.selected = false));
					const name: keyof CadEvents = "entitiesunselect";
					this._emitter.emit(name, event);
				} else {
					toSelect.forEach((object) => (object.userData.selected = true));
					const name: keyof CadEvents = "entitiesselect";
					this._emitter.emit(name, event);
				}
				cad.render();
			}
			const name: keyof CadEvents = "dragend";
			this._emitter.emit(name, event);
		}
		const p = new Vector2(event.clientX, event.clientY);
		if (p.distanceTo(pFrom) <= 5) {
			this._click(event);
		}
		if (!ctrl) {
			this._status.pointerLock = false;
		}
		const name: keyof CadEvents = "click";
		this._emitter.emit(name, event);
		this._status.dragging = false;
	}

	private _wheel(event: WheelEvent) {
		const {cad, config} = this;
		if (config.enableScale) {
			if (event.deltaY > 0) {
				cad.scale = Math.max(config.minScale, cad.scale - 0.1);
			} else if (event.deltaY < 0) {
				cad.scale = Math.min(config.maxScale, cad.scale + 0.1);
			}
		}
		const name: keyof CadEvents = "wheel";
		this._emitter.emit(name, event);
	}

	private _keyDown(event: KeyboardEvent) {
		const {cad} = this;
		const position = cad.position;
		const step = 10 / cad.scale;
		if (event.ctrlKey) {
			if (event.key === "a") {
				cad.selectAll();
			}
			event.preventDefault();
		} else {
			switch (event.key) {
				case "w":
				case "ArrowUp":
					position.y -= step;
					break;
				case "a":
				case "ArrowLeft":
					position.x += step;
					break;
				case "s":
				case "ArrowDown":
					position.y += step;
					break;
				case "d":
				case "ArrowRight":
					position.x -= step;
					break;
				case "Escape":
					cad.unselectAll();
					break;
				case "[":
					cad.scale -= 0.1;
					break;
				case "]":
					cad.scale += 0.1;
					break;
				case "Delete":
					cad.removeEntities(cad.selectedEntities);
					break;
				default:
			}
		}
		const name: keyof CadEvents = "keyboard";
		this._emitter.emit(name, event);
	}

	private _keyUp(event: KeyboardEvent) {
		if (event.key === "Control") {
			this._status.pointerLock = false;
			this._unHover();
		}
	}

	private _hover() {
		const {cad, currentObject, _status} = this;
		if (currentObject && currentObject.userData.selected !== true) {
			this._unHover();
		}
		const object = this._getInterSection(_status.pTo);
		const selectable = object && object.userData.selectable;
		if (selectable) {
			object.userData.hover = !object.userData.selected;
			cad.render();
			cad.dom.style.cursor = "pointer";
			this.currentObject = object;
			if (_status.ctrl) {
				this._status.pointerLock = true;
			}
		} else {
			this._unHover();
		}
	}

	private _unHover() {
		const {cad, currentObject} = this;
		if (currentObject) {
			cad.dom.style.cursor = "default";
			currentObject.userData.hover = false;
			cad.render();
			this.currentObject = null;
		}
	}

	private _click(event: PointerEvent) {
		const {currentObject, cad, _status} = this;
		const object = _status.pointerLock ? currentObject : this._getInterSection(new Vector2(event.clientX, event.clientY));
		if (this.config.selectMode !== "none" && object) {
			const entity = cad.data.findEntity(object.name);
			if (object.userData.selected === true) {
				if (object instanceof Line) {
					if (object.material instanceof LineBasicMaterial) {
						object.userData.selected = false;
					}
				}
				const name: keyof CadEvents = "entityunselect";
				this._emitter.emit(name, event, entity, object);
			} else if (object.userData.selectable !== false) {
				if (object instanceof Line) {
					if (object.material instanceof LineBasicMaterial) {
						if (this.config.selectMode === "single") {
							cad.unselectAll();
						}
						object.userData.selected = true;
					}
				}
				const name: keyof CadEvents = "entityselect";
				this._emitter.emit(name, event, entity, object);
			}
			_status.pointerLock = false;
			this._hover();
		}
	}

	private _dragObject(p: Vector2, offset: Vector2) {
		const {cad, currentObject: object,_multiSelector} = this;
		if (!object || !_multiSelector.hidden) {
			return false;
		}
		const entity = cad.data.findEntity(object.name);
		if (entity instanceof CadDimension) {
			let {point1, point2} = cad.data.getDimensionPoints(entity);
			if (!point1 || !point2) {
				return false;
			}
			point1 = cad.translatePoint(point1);
			point2 = cad.translatePoint(point2);
			const left = Math.min(point1.x, point2.x);
			const right = Math.max(point1.x, point2.x);
			const top = Math.max(point1.y, point2.y);
			const bottom = Math.min(point1.y, point2.y);
			const scale = cad.scale;
			if (entity.axis === "x") {
				if (p.x >= left && p.x <= right) {
					entity.distance += offset.y;
				} else if (p.y >= bottom && p.y <= top) {
					entity.axis = "y";
					entity.distance = (p.x - right) / scale;
				} else {
					entity.distance += offset.y;
				}
			}
			if (entity.axis === "y") {
				if (p.y >= bottom && p.y <= top) {
					entity.distance += offset.x;
				} else if (p.x >= left && p.x <= right) {
					entity.axis = "x";
					entity.distance = (bottom - p.y) / scale;
				} else {
					entity.distance += offset.x / scale;
				}
			}
			this._status.pointerLock = true;
		}
		cad.render(false, new CadEntities().add(entity));
		return true;
	}
}
