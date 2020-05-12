import {CadViewer} from "./cad-viewer";
import {Vector2, Vector3, Line, LineBasicMaterial, Object3D, MathUtils, Box2} from "three";
import {EventEmitter} from "events";
import {CadEntity} from "./cad-data/cad-entity";

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

		dom.addEventListener("pointerdown", (event) => {
			const {clientX: x, clientY: y} = event;
			this._status.pFrom.set(x, y);
			this._status.pTo.set(x, y);
			this._status.dragging = true;
			this._status.button = event.button;
			const name: keyof CadEvents = "dragstart";
			this._emitter.emit(name, event);
		});
		dom.addEventListener("pointermove", (event) => {
			const p = new Vector2(event.clientX, event.clientY);
			const {cad, _status} = this;
			const {button, dragging} = _status;
			if (dragging) {
				const {pFrom, pTo} = _status;
				if (button === 1 || (event.shiftKey && button === 0)) {
					const offset = new Vector2(p.x - pTo.x, pTo.y - p.y);
					offset.divideScalar(cad.scale);
					if (!this.config.dragAxis.includes("x")) {
						offset.x = 0;
					}
					if (!this.config.dragAxis.includes("y")) {
						offset.y = 0;
					}
					cad.position.sub(new Vector3(offset.x, offset.y, 0));
				} else if (button === 0) {
					if (this.config.selectMode === "multiple") {
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
			_status.pTo.set(p.x, p.y);
			_status.ctrl = event.ctrlKey;
		});
		["pointerup"].forEach((v) => {
			dom.addEventListener(v, (event: PointerEvent) => {
				const {camera, objects} = this.cad;
				const {pFrom, pTo, dragging} = this._status;
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
							const object = objects[key] as Line;
							object.geometry.computeBoundingBox();
							const {min, max} = object.geometry.boundingBox;
							const objBox = new Box2(new Vector2(min.x, min.y), new Vector2(max.x, max.y));
							if (box.containsBox(objBox) && object.userData.selectable) {
								toSelect.push(object);
							}
						}
						if (toSelect.every((o) => o.userData.selected)) {
							toSelect.forEach((o) => (o.userData.selected = false));
						} else {
							toSelect.forEach((object) => (object.userData.selected = true));
						}
						cad.render();
					}
					const name: keyof CadEvents = "dragend";
					this._emitter.emit(name, event);
				}
				const p = new Vector2(event.clientX, event.clientY);
				const offset = new Vector2(p.x - pTo.x, pTo.y - p.y);
				if (Math.abs(offset.x) < 5 && Math.abs(offset.y) < 5) {
					this._click(event);
				}
				const name: keyof CadEvents = "click";
				this._emitter.emit(name, event);
				this._status.dragging = false;
			});
		});
		dom.addEventListener("wheel", (event) => {
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
		});
		dom.addEventListener("keydown", (event) => {
			const {cad} = this;
			const position = cad.position;
			const step = 10 / cad.scale;
			if (event.ctrlKey) {
				if (event.key === "a") {
					cad.selectAll();
				}
			} else {
				switch (event.key) {
					case "w":
					case "ArrowUp":
						position.y += step;
						break;
					case "a":
					case "ArrowLeft":
						position.x -= step;
						break;
					case "s":
					case "ArrowDown":
						position.y -= step;
						break;
					case "d":
					case "ArrowRight":
						position.x += step;
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
					default:
				}
			}
			const name: keyof CadEvents = "keyboard";
			this._emitter.emit(name, event);
		});
		dom.addEventListener("keyup", (event) => {
			if (event.key === "Control") {
				this._status.pointerLock = false;
				this._unHover();
			}
		});
		dom.tabIndex = 0;
		dom.focus();
	}

	update() {
		const {config, _status} = this;
		if (config.selectMode !== "none" && !_status.pointerLock) {
			this._hover();
		}
	}

	on<K extends keyof CadEvents>(
		event: K,
		listener: (event: CadEvents[K][0], entity?: CadEvents[K][1], object?: CadEvents[K][2]) => void
	) {
		this._emitter.on(event, listener);
	}

	private _getNDC(point: Vector2) {
		const rect = this.cad.dom.getBoundingClientRect();
		return new Vector3(((point.x - rect.left) / rect.width) * 2 - 1, (-(point.y - rect.top) / rect.height) * 2 + 1, 0.5);
	}

	private _getInterSection(pointer: Vector2) {
		const {raycaster, camera, objects} = this.cad;
		raycaster.setFromCamera(this._getNDC(pointer), camera);
		const intersects = raycaster.intersectObjects(Object.values(objects));
		const intersect = intersects[0]?.object;
		if (intersect && intersect.visible) {
			return intersect;
		}
		return null;
	}

	private _hover() {
		const {cad, currentObject, _status} = this;
		if (currentObject && currentObject.userData.selected !== true) {
			this._unHover();
		}
		const object = this._getInterSection(_status.pTo);
		const selectable = object && object.userData.selectable;
		if (selectable && object.userData.selected !== true) {
			cad.dom.style.cursor = "pointer";
			object.userData.hover = true;
			cad.render();
			this.currentObject = object;
			if (_status.ctrl) {
				this._status.pointerLock = true;
			}
		}
	}

	private _unHover() {
		const {cad, currentObject} = this;
		cad.dom.style.cursor = "default";
		if (currentObject) {
			currentObject.userData.hover = false;
			cad.render();
			this.currentObject = null;
		}
	}

	private _click(event: PointerEvent) {
		const {currentObject, cad, _status} = this;
		const object = _status.pointerLock ? currentObject : this._getInterSection(new Vector2(event.clientX, event.clientY));
		if (object) {
			const entity = cad.data.findEntity(object.name);
			if (object.userData.selected === true) {
				if (object instanceof Line) {
					if (object.material instanceof LineBasicMaterial) {
						object.userData.selected = false;
						object.material.color.set(entity?.color);
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
						if (typeof cad.config.selectedColor === "number") {
							object.material.color.set(cad.config.selectedColor);
						} else {
							object.material.color.set(entity?.color);
						}
					}
				}
				const name: keyof CadEvents = "entityselect";
				this._emitter.emit(name, event, entity, object);
			}
		}
	}
}
