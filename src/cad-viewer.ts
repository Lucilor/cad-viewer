import {calculate, keysOf, loadImage, ObjectOf, Point, SessionStorage, svgToBase64, timeout} from "@lucilor/utils";
import {Box, CoordinateXY, Element, G, SVG, Svg, Point as SvgPoint} from "@svgdotjs/svg.js";
import {EventEmitter} from "events";
import {cloneDeep} from "lodash";
import {CadData} from "./cad-data/cad-data";
import {CadEntities} from "./cad-data/cad-entities";
import {
  CadArc,
  CadCircle,
  CadDimension,
  CadEntity,
  CadHatch,
  CadLeader,
  CadLine,
  CadLineLike,
  CadMtext,
  CadSpline
} from "./cad-data/cad-entity";
import {CadDimensionLinear} from "./cad-data/cad-entity/cad-dimension-linear";
import {CadImage} from "./cad-data/cad-entity/cad-image";
import {CadInsert} from "./cad-data/cad-entity/cad-insert";
import {CadDimensionStyle, CadStyle, FontStyle} from "./cad-data/cad-styles";
import {EntityType, entityTypes} from "./cad-data/cad-types";
import {CadStylizer} from "./cad-stylizer";
import {getVectorFromArray, toFixedTrim} from "./cad-utils";
import {CadEventCallBack, CadEvents, controls} from "./cad-viewer-controls";
import {drawArc, drawCircle, drawDimensionLinear, drawImage, drawLeader, drawLine, drawShape, drawText} from "./draw";

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
  entityDraggable: boolean | EntityType[]; // 实体是否可拖动
  hideDimensions: boolean; // 是否隐藏标注
  lineGongshi: number; // 显示线公式的字体大小, ≤0时不显示
  hideLineLength: boolean; // 是否隐藏线长度(即使lineLength>0)
  hideLineGongshi: boolean; // 是否隐藏线公式(即使lineGongshi>0)
  minLinewidth: number; // 所有线的最小宽度(调大以便选中)
  fontStyle: FontStyle; // 全局字体样式
  dimStyle: CadDimensionStyle; // 全局标注样式
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
    fontStyle: {},
    dimStyle: {},
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
      if (key === "fontStyle") {
        const value2 = value;
        value = target[key];
        CadStylizer.mergeFontStyle(value, value2);
        return true;
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
  entitiesCopied?: CadEntities;
  entitiesClickLock = false;
  private _config: CadViewerConfig;
  private _fonts: CadViewerFont[] = [];
  get fonts() {
    return cloneDeep([...this._fonts]);
  }

  constructor(data = new CadData(), config: Partial<CadViewerConfig> = {}) {
    super();
    this.data = data;

    const dom = document.createElement("div");
    dom.classList.add("cad-viewer");
    this.dom = dom;
    this.draw = SVG().addTo(dom).size("100%", "100%");

    dom.addEventListener("wheel", controls.onWheel.bind(this));
    dom.addEventListener("pointerdown", controls.onPointerDown.bind(this));
    dom.addEventListener("pointermove", controls.onPointerMove.bind(this));
    dom.addEventListener("pointerup", controls.onPointerUp.bind(this));
    dom.addEventListener("pointerleave", controls.onPointerUp.bind(this));
    dom.addEventListener("keydown", controls.onKeyDown.bind(this));
    dom.tabIndex = 0;
    dom.focus();

    this._config = getConfigProxy();
    entityTypes.forEach((t) => this.draw.group().attr("group", t));
    this.setConfig({...this._config, ...config}).center();
  }

  getConfig(): CadViewerConfig;
  getConfig<T extends keyof CadViewerConfig>(key: T): CadViewerConfig[T];
  getConfig(key?: keyof CadViewerConfig) {
    if (typeof key === "string") {
      return cloneDeep(this._config[key]);
    } else {
      return cloneDeep({...this._config});
    }
  }

  setConfig(config: Partial<CadViewerConfig>): this;
  setConfig<T extends keyof CadViewerConfig>(key: T, value: CadViewerConfig[T]): this;
  setConfig<T extends keyof CadViewerConfig>(config: T | Partial<CadViewerConfig>, value?: CadViewerConfig[T]) {
    if (typeof config === "string") {
      const tmp: Partial<CadViewerConfig> = {};
      tmp[config] = value;
      return this.setConfig(tmp);
    }
    let needsResize = false;
    let needsSetBg = false;
    let needsRender = false;
    for (const key of keysOf(config)) {
      const newValue = cloneDeep(config[key]);
      const oldValue = this._config[key];
      const success = Reflect.set(this._config, key, newValue);
      if (success) {
        switch (key) {
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
          case "fontStyle":
            if ((newValue as FontStyle).family !== (oldValue as FontStyle).family) {
              this._updateFontFamily();
            }
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

  move(dx: number, dy: number, entities?: CadEntities) {
    const box = this.draw.viewbox();
    box.x -= dx;
    box.y -= dy;
    this.draw.viewbox(box);
    this.emit("moveentities", entities ?? this.data.entities, [dx, dy]);
    return this;
  }

  zoom(): number;
  zoom(level: number, point?: CoordinateXY): this;
  zoom(level?: number, point?: CoordinateXY) {
    let point2: SvgPoint | undefined;
    if (point) {
      point2 = new SvgPoint(point);
    }
    if (typeof level === "number") {
      this.draw.zoom(level, point2);
      this.emit("zoom");
      return this;
    } else {
      return this.draw.zoom();
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
    let viewbox = this.draw.viewbox();
    if (viewbox.w <= 0 || viewbox.h <= 0) {
      viewbox = new Box(0, 0, width, height);
    } else {
      let w = viewbox.w;
      let h = viewbox.h;
      const r1 = width / height;
      const r2 = w / h;
      if (r1 > r2) {
        w = h * r1;
      } else {
        h = w / r1;
      }
      viewbox = new Box(viewbox.x, viewbox.y, w, h);
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

  async drawEntity(entity: CadEntity, style: Partial<CadStyle> = {}, isFromParent?: boolean) {
    const {draw} = this;
    const config = this.getConfig();
    const {color, fontStyle, lineStyle, dimStyle} = CadStylizer.get(entity, config, style);
    let shouldDraw = entity.visible;
    if (entity instanceof CadDimension) {
      if (config.hideDimensions) {
        shouldDraw = false;
      }
    } else if (entity instanceof CadMtext) {
      const parent = entity.parent;
      if (parent instanceof CadLineLike) {
        const {isLengthText, isGongshiText, isBianhuazhiText} = entity.info;
        const isLineText = isLengthText || isGongshiText || isBianhuazhiText;
        if (isLineText) {
          const {hideLineLength, hideLineGongshi} = config;
          if (isLengthText && (parent.hideLength || hideLineLength)) {
            shouldDraw = false;
          } else if (isGongshiText && hideLineGongshi) {
            shouldDraw = false;
          } else if (isBianhuazhiText && hideLineGongshi) {
            shouldDraw = false;
          }
        }
      }
    }
    if (shouldDraw) {
      entity.update(isFromParent);
    } else {
      entity.el?.remove();
      entity.el = null;
      entity.update(isFromParent);
      return [];
    }
    let el = entity.el;
    if (!el) {
      let typeLayer = draw.find(`[group="${entity.type}"]`)[0] as G;
      if (!typeLayer) {
        typeLayer = draw.group().attr("group", entity.type);
      }
      el = typeLayer.group().addClass("selectable");
      entity.el = el;
      let startX = 0;
      let startY = 0;
      el.node.onclick = (event) => {
        if (new Point(startX, startY).distanceTo(new Point(event.clientX, event.clientY)) > 1) {
          return;
        }
        controls.onEntityClick.call(this, event, entity);
      };
      el.node.ondblclick = (event) => {
        if (new Point(startX, startY).distanceTo(new Point(event.clientX, event.clientY)) > 1) {
          return;
        }
        controls.onEntityDoubleClick.call(this, event, entity);
      };
      el.node.onpointerdown = (event) => {
        startX = event.clientX;
        startY = event.clientY;
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
      drawResult = drawArc(el, center, radius, start_angle, end_angle, clockwise, lineStyle);
    } else if (entity instanceof CadCircle) {
      const {center, radius} = entity;
      drawResult = drawCircle(el, center, radius, lineStyle);
    } else if (entity instanceof CadDimension) {
      const selected = entity.selected;
      el.clear();
      const {mingzi, qujian, xiaoshuchuli} = entity;
      const points = this.data.getDimensionPoints(entity);
      let text = "";
      if (mingzi) {
        text = mingzi;
      }
      if (qujian) {
        text = qujian;
      }
      if (entity instanceof CadDimensionLinear) {
        const {axis} = entity;
        drawResult = drawDimensionLinear(el, points, text, axis, xiaoshuchuli, dimStyle);
      } else {
        console.log(entity);
      }
      entity.selected = selected;
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
      drawResult = drawLine(el, start, end, lineStyle);
    } else if (entity instanceof CadMtext) {
      const parent = entity.parent;
      const {insert, anchor} = entity;
      const {isLengthText, isGongshiText, isBianhuazhiText} = entity.info;
      const isLineText = isLengthText || isGongshiText || isBianhuazhiText;
      if (parent instanceof CadLineLike && isLineText) {
        const {lineGongshi} = config;
        let foundOffset: Point | undefined;
        if (isLengthText) {
          let valid = true;
          let error = null as any;
          let length = parent.length;
          let prefix = "";
          if (parent.显示线长) {
            const calcReuslt = calculate(parent.显示线长, {线长: length});
            if (calcReuslt.error === null) {
              if (isNaN(calcReuslt.value)) {
                error = "NaN";
                valid = false;
              } else {
                length = calcReuslt.value;
              }
            } else {
              error = calcReuslt.error;
              valid = false;
            }
          } else if (parent instanceof CadArc) {
            switch (parent.圆弧显示) {
              case "半径":
              case "R+半径":
                length = parent.radius;
                prefix = "R";
                break;
              case "φ+直径":
                length = parent.radius * 2;
                prefix = "φ";
                break;
              case "弧长+线长":
                length = parent.length;
                prefix = "弧长";
                break;
              default:
            }
          }
          if (valid) {
            entity.text = prefix + toFixedTrim(length);
          } else {
            entity.text = String(error);
          }
          entity.fontStyle.size = parent.lengthTextSize;
          fontStyle.size = entity.fontStyle.size;
          foundOffset = getVectorFromArray(entity.info.offset);
        } else if (isGongshiText) {
          const {mingzi, mingzi2, gongshi, 刨坑起始线, 双向折弯附加值} = parent;
          const mingzi3 = mingzi || mingzi2;
          const arr: string[] = [];
          if (gongshi) {
            arr.push(`${mingzi3}=${gongshi}`);
          } else {
            arr.push(mingzi3);
          }
          if (mingzi && mingzi2) {
            arr.push(mingzi2);
          }
          if (刨坑起始线) {
            arr.push("刨坑起始线");
          }
          if (双向折弯附加值) {
            arr.push(双向折弯附加值);
          }
          entity.text = arr.join("\n");
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
          entity.fontStyle.size = lineGongshi;
          fontStyle.size = entity.fontStyle.size;
          foundOffset = getVectorFromArray(entity.info.offset);
        } else if (isBianhuazhiText) {
          if (parent instanceof CadLine && parent.guanlianbianhuagongshi) {
            entity.text = `变化值=${parent.guanlianbianhuagongshi}`;
          } else {
            entity.text = "";
          }
          entity.fontStyle.size = lineGongshi - 3;
          fontStyle.size = entity.fontStyle.size;
          foundOffset = getVectorFromArray(entity.info.offset);
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
      drawResult = drawText(el, entity.text, insert, anchor, fontStyle);
    } else if (entity instanceof CadSpline) {
      // TODO
    } else if (entity instanceof CadLeader) {
      const start = entity.vertices[0];
      const end = entity.vertices[1];
      drawResult = drawLeader(el, start, end, entity.size, color);
    } else if (entity instanceof CadImage) {
      drawResult = await drawImage(el, entity);
    }
    if (!drawResult || drawResult.length < 1) {
      entity.el?.remove();
      entity.el = null;
      return drawResult;
    }
    el.attr({id: entity.id, type: entity.type});
    el.children().forEach((c) => {
      if (c.hasClass("stroke")) {
        c.attr("vector-effect", "non-scaling-stroke");
      }
    });
    entity.update(isFromParent);
    for (const child of entity.children.toArray(true)) {
      await this.drawEntity(child, style, true);
    }
    return drawResult;
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
      const arr = entities.toArray();
      for (const entity of arr) {
        if (entity instanceof CadInsert) {
          // const block = this.data.blocks[entity.name];
          // block?.forEach((v) => console.log(this.drawEntity(v.clone().transform({translate: entity.insert}, true), style)));
          // TODO: draw blocks
        } else {
          await this.drawEntity(entity, style);
        }
      }
      await timeout(0);
      this.emit("render", entities);
    }
  }

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
    if (outerWidth2 <= 0) {
      outerWidth2 = outerWidth;
    }
    if (outerHeight2 <= 0) {
      outerHeight2 = outerHeight;
    }
    this.draw.viewbox(x, y, outerWidth2, outerHeight2);
    this.draw.transform({a: 1, b: 0, c: 0, d: -1, e: 0, f: 0});
    return this;
  }

  selected() {
    return this.data.getAllEntities().filter((e) => e.selected, true);
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
      entities.forEach((e) => (e.selected = e.selectable));
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
    entities.forEach((e) => this.data.entities.add(e));
    this.render(entities);
    if (entities instanceof CadEntities) {
      this.emit("entitiesadd", entities);
    } else {
      this.emit("entitiesadd", new CadEntities().fromArray(entities));
    }
    return this;
  }

  getWorldPoint(x: number, y: number) {
    const {left, bottom} = this.draw.node.getBoundingClientRect();
    const box = this.draw.viewbox();
    const result = new Point();
    const zoom = this.zoom();
    result.x = (x - left) / zoom + box.x;
    result.y = (bottom - y) / zoom + box.y;
    return result;
  }

  getScreenPoint(x: number, y: number) {
    const {left, bottom} = this.draw.node.getBoundingClientRect();
    const box = this.draw.viewbox();
    const result = new Point();
    const zoom = this.zoom();
    result.x = left + (x - box.x) * zoom;
    result.y = bottom - (y - box.y) * zoom;
    return result;
  }

  emit<T extends keyof CadEvents>(type: T, ...params: CadEvents[T]) {
    return super.emit(type, ...params);
  }

  on<T extends keyof CadEvents>(type: T, listener: CadEventCallBack<T>) {
    return super.on(type, listener as (...args: any[]) => void);
  }

  once<T extends keyof CadEvents>(type: T, listener: CadEventCallBack<T>) {
    return super.once(type, listener as (...args: any[]) => void);
  }

  off<T extends keyof CadEvents>(type: T, listener: CadEventCallBack<T>) {
    return super.off(type, listener as (...args: any[]) => void);
  }

  offAll<T extends keyof CadEvents>(type?: T) {
    return super.removeAllListeners(type);
  }

  addListener<T extends keyof CadEvents>(type: T, listener: CadEventCallBack<T>) {
    return super.addListener(type, listener as (...args: any[]) => void);
  }

  removeListener<T extends keyof CadEvents>(type: T, listener: CadEventCallBack<T>) {
    return super.removeListener(type, listener as (...args: any[]) => void);
  }

  removeAllListeners<T extends keyof CadEvents>(type?: T) {
    return super.removeAllListeners(type);
  }

  toBase64() {
    return svgToBase64(this.draw.node);
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

  async toDataURL() {
    const canvas = await this.toCanvas();
    return canvas.toDataURL();
  }

  traverse(callback: (e: CadEntity) => void, recursive = false) {
    this.data.getAllEntities().forEach((e) => callback(e), recursive);
    return this;
  }

  destroy() {
    // this.data = new CadData();
    this.reset();
    this.dom.remove();
    this.offAll();
    return this;
  }

  reset(data?: CadData) {
    this.draw.find("g").forEach((v) => v.remove());
    entityTypes.forEach((t) => this.draw.group().attr("group", t));
    if (data instanceof CadData) {
      this.data = data;
    }
    this.dom.id = this.data.id;
    this.dom.setAttribute("name", this.data.name);
    this.traverse((e) => {
      e.el = null;
    }, true);
    this.dom.focus();
    return this;
  }

  // ? move entities efficiently
  // * call render() after moving
  moveEntities(toMove: CadEntities, notToMove: CadEntities, x: number, y: number) {
    let entities: CadEntities;
    if (toMove.length <= notToMove.length) {
      entities = toMove.transform({translate: [x, y]}, false);
      this.emit("moveentities", toMove, [x, y]);
    } else {
      this.move(x, y, toMove);
      entities = notToMove.transform({translate: [-x, -y]}, false);
    }
    return entities;
  }

  private _getFontFamily() {
    const names1 = this._fonts.map((v) => v.name);
    const names2 = this._config.fontStyle.family || "";
    return CadStylizer.mergeFontFamilies(names1, names2).join(", ");
  }

  private _updateFontFamily() {
    const family = this._getFontFamily();
    this.draw.css("font-family" as any, family);
    if (family) {
      if (!this._config.fontStyle) {
        this._config.fontStyle = {};
      }
      this._config.fontStyle.family = family;
    }
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
      dataUrl = await new Promise<string | null>((resolve) => {
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
    this._updateFontFamily();
  }
}
