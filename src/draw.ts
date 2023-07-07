import {Angle, Arc, getTypeOf, Line, Matrix, Point} from "@lucilor/utils";
import {Container, Element, Image, Path, PathArrayAlias, Circle as SvgCircle, Line as SvgLine, Text} from "@svgdotjs/svg.js";
import {CadImage} from "./cad-data";
import {CadDimension} from "./cad-data/cad-entity/cad-dimension";
import {CadDimensionStyle, FontStyle, LineStyle} from "./cad-data/cad-styles";

const setLineStyle = (el: Element, style: LineStyle) => {
  const {color, width, dashArray} = style;
  el.stroke({width, color});
  if (dashArray) {
    el.css("stroke-dasharray" as any, dashArray.join(", "));
  }
};

export const drawLine = (draw: Container, start: Point, end: Point, style?: LineStyle, i = 0) => {
  let el = draw.children()[i] as SvgLine;
  let {x: x1, y: y1} = start;
  let {x: x2, y: y2} = end;
  const {dashArray, padding} = style || {};
  if (dashArray && dashArray.length > 0) {
    const line = new Line(start, end);
    let [offsetStart, offsetEnd] = Array.isArray(padding) ? [...padding] : [padding];
    const getNum = (n: any) => {
      const result = Number(n);
      if (isNaN(result)) {
        return 0;
      }
      return Math.min(result, line.length / 10);
    };
    offsetStart = getNum(offsetStart);
    offsetEnd = typeof offsetEnd === "number" ? getNum(offsetEnd) : offsetStart;
    const theta = line.theta.rad;
    const cos = Math.cos(theta);
    const sin = Math.sin(theta);
    x1 += offsetStart * cos;
    y1 += offsetStart * sin;
    x2 -= offsetEnd * cos;
    y2 -= offsetEnd * sin;
  }
  if (el instanceof SvgLine) {
    el.plot(x1, y1, x2, y2);
  } else {
    el = draw.line(x1, y1, x2, y2).addClass("stroke").fill("none");
  }
  setLineStyle(el, style || {});
  return [el];
};

export const drawCircle = (draw: Container, center: Point, radius: number, style?: LineStyle, i = 0) => {
  let el = draw.children()[i] as SvgCircle;
  if (el instanceof SvgCircle) {
    el.size(radius * 2).center(center.x, center.y);
  } else {
    el = draw.circle(radius * 2).center(center.x, center.y);
    el.addClass("stroke").fill("none");
  }
  setLineStyle(el, style || {});
  return [el];
};

export const drawArc = (
  draw: Container,
  center: Point,
  radius: number,
  startAngle: number,
  endAngle: number,
  clockwise: boolean,
  style?: LineStyle,
  i = 0
) => {
  const l0 = Math.PI * 2 * radius;
  const arc = new Arc(new Point(center.x, center.y), radius, new Angle(startAngle, "deg"), new Angle(endAngle, "deg"), clockwise);
  if (arc.totalAngle.deg === 360) {
    return drawCircle(draw, center, radius, style, i);
  }
  const isLargeArc = arc.length / l0 > 0.5 ? 1 : 0;
  const {x: x0, y: y0} = arc.startPoint;
  const {x: x1, y: y1} = arc.endPoint;
  const path: PathArrayAlias = [
    ["M", x0, y0],
    ["A", radius, radius, endAngle - startAngle, isLargeArc, clockwise ? 0 : 1, x1, y1]
  ];
  let el = draw.children()[i] as Path;
  if (el instanceof Path) {
    el.plot(path);
  } else {
    el = draw.path(path).addClass("stroke").fill("none");
  }
  setLineStyle(el, style || {});
  return [el];
};

export const drawText = (draw: Container, text: string, position: Point, anchor: Point, style?: FontStyle, i = 0) => {
  const {size, family, weight, color, vertical, vertical2} = style || {};
  if (!text || !size || !(size > 0)) {
    draw.remove();
    return [];
  }
  let el = draw.children()[i] as Text;
  if (el instanceof Text) {
    el.text(text).font({size});
  } else {
    el = draw.text(text).addClass("fill").stroke("none");
    el.font({size}).leading(1);
  }
  el.css("transform-box" as any, "fill-box");
  el.css("white-space" as any, "pre");
  el.css("transform-origin" as any, `${anchor.x * 100}% ${anchor.y * 100}%`);
  const {width, height} = el.bbox();
  let tx = -width * anchor.x;
  let ty = -height * anchor.y;
  let deg = 0;
  if (vertical) {
    tx += height / 2;
    ty -= width / 2;
    deg = 90;
  }
  const getStr = (val: any) => {
    switch (getTypeOf(val)) {
      case "string":
        return val;
      case "number":
        return String(val);
      default:
        return "";
    }
  };
  if (vertical2) {
    el.css("writing-mode" as any, "vertical-lr");
  } else {
    el.css("writing-mode" as any, "");
  }
  el.css("transform", `translate(${tx}px, ${ty}px) scale(1, -1) rotate(${deg}deg)`);
  el.css("font-family" as any, getStr(family));
  el.css("font-weight" as any, getStr(weight));
  if (color) {
    el.fill(color);
  } else {
    el.fill("");
  }
  el.move(position.x, position.y);
  return [el];
};

export const drawShape = (draw: Container, points: Point[], color?: string, i = 0) => {
  let el = draw.children()[i] as Path;
  const path = points
    .map((p, j) => {
      const {x, y} = p;
      if (j === 0) {
        return `M${x} ${y}`;
      } else {
        return `L${x} ${y}`;
      }
    })
    .join(" ");
  if (el instanceof Path) {
    el.plot(path);
  } else {
    el = draw.path(path).addClass("fill stroke");
  }
  if (color) {
    el.stroke(color).fill(color);
  }
  return [el];
};

export const drawTriangle = (draw: Container, p1: Point, p2: Point, size: number, color?: string, i?: number) => {
  const theta = new Line(p1, p2).theta.rad;
  const dTheta = (30 / 180) * Math.PI;
  const theta1 = theta + dTheta;
  const theta2 = theta - dTheta;
  const p3 = p1.clone().add(size * Math.cos(theta1), size * Math.sin(theta1));
  const p4 = p1.clone().add(size * Math.cos(theta2), size * Math.sin(theta2));
  return drawShape(draw, [p1, p3, p4], color, i);
};

export const drawDimensionLinear = (
  draw: Container,
  points: Point[],
  text: string,
  axis: "x" | "y",
  xiaoshuchuli: CadDimension["xiaoshuchuli"],
  style?: CadDimensionStyle,
  i = 0
) => {
  text = String(text);
  const color = style?.color;
  if (points.length < 4) {
    draw.remove();
    return [];
  }
  const [p1, p2, p3, p4] = points;

  const dimLineStyle = style?.dimensionLine || {};
  let dimLine: ReturnType<typeof drawLine> = [];
  if (!dimLineStyle?.hidden) {
    if (!dimLineStyle.color) {
      dimLineStyle.color = color;
    }
    dimLine = drawLine(draw, p3, p4, dimLineStyle, i);
    dimLine.forEach((el) => el.addClass("dim-line"));
    i += dimLine.length;
  }
  const extLinesStyle = style?.extensionLines || {};
  let extLine1: ReturnType<typeof drawLine> = [];
  let extLine2: ReturnType<typeof drawLine> = [];
  if (!extLinesStyle?.hidden) {
    const length = extLinesStyle.length;
    if (!extLinesStyle.color) {
      extLinesStyle.color = color;
    }
    if (typeof length === "number") {
      if (axis === "x") {
        extLine1 = drawLine(draw, p3.clone().sub(0, length), p3.clone().add(0, length), extLinesStyle, i);
        i += extLine1.length;
        extLine2 = drawLine(draw, p4.clone().sub(0, length), p4.clone().add(0, length), extLinesStyle, i);
        i += extLine2.length;
      } else if (axis === "y") {
        extLine1 = drawLine(draw, p3.clone().sub(length, 0), p3.clone().add(length, 0), extLinesStyle, i);
        i += extLine1.length;
        extLine2 = drawLine(draw, p4.clone().sub(length, 0), p4.clone().add(length, 0), extLinesStyle, i);
        i += extLine2.length;
      }
    } else {
      extLine1 = drawLine(draw, p1, p3, extLinesStyle, i);
      i += extLine1.length;
      extLine2 = drawLine(draw, p2, p4, extLinesStyle, i);
      i += extLine2.length;
    }
    [...extLine1, ...extLine2].forEach((el) => el.addClass("ext-line"));
  }
  const arrowsStyle = style?.arrows || {};
  let arrow1: ReturnType<typeof drawTriangle> = [];
  let arrow2: ReturnType<typeof drawTriangle> = [];
  if (!arrowsStyle?.hidden) {
    let size = Number(arrowsStyle.size);
    if (!arrowsStyle.color) {
      arrowsStyle.color = color;
    }
    if (isNaN(size)) {
      size = Math.max(1, Math.min(20, p3.distanceTo(p4) / 8));
    }
    arrow1 = drawTriangle(draw, p3, p4, size, arrowsStyle?.color, i);
    i += arrow1.length;
    arrow2 = drawTriangle(draw, p4, p3, size, arrowsStyle?.color, i);
    i += arrow2.length;
    [...arrow1, ...arrow2].forEach((el) => el.addClass("dim-arrow"));
  }
  const textStyle = {...style?.text};
  let textEls: ReturnType<typeof drawText> = [];
  if (!textStyle?.hidden) {
    if (!textStyle.color) {
      textStyle.color = color;
    }
    if (text === "") {
      text = "<>";
    }
    if (text.includes("<>")) {
      const num = p3.distanceTo(p4);
      let numStr: string;
      switch (xiaoshuchuli) {
        case "四舍五入":
          numStr = Math.round(num).toString();
          break;
        case "舍去小数":
          numStr = Math.floor(num).toString();
          break;
        case "小数进一":
          numStr = Math.ceil(num).toString();
          break;
        case "保留一位":
          numStr = num.toFixed(1);
          break;
        case "保留两位":
          numStr = num.toFixed(2);
          break;
        default:
          numStr = num.toString();
          break;
      }
      text = text.replace(/<>/g, numStr);
    }
    const middle = p3.clone().add(p4).divide(2);
    if (axis === "x") {
      textEls = drawText(draw, text, middle, new Point(0.5, 1), textStyle, i);
    } else if (axis === "y") {
      textStyle.vertical = true;
      textEls = drawText(draw, text, middle, new Point(1, 0.5), textStyle, i);
    }
    textEls.forEach((el) => el.addClass("dim-text"));
    i += textEls.length;
  }

  return [...dimLine, ...extLine1, ...extLine2, ...arrow1, ...arrow2, ...textEls].filter((v) => v);
};

export const drawLeader = (draw: Container, start: Point, end: Point, size: number, color?: string, i = 0) => {
  const line = drawLine(draw, start, end, {color}, i);
  i += line.length;
  const triangle = drawTriangle(draw, start, end, size, color, i);
  i += triangle.length;
  return [...line, ...triangle];
};

const loadImageEl = async (el: Image, url: string) => {
  if (el.attr("href") === url) {
    return;
  }
  return new Promise<void>((resolve) => {
    el.load(url, () => {
      resolve();
    });
  });
};

export const drawImage = async (draw: Container, e: CadImage, i = 0) => {
  if (!e.sourceSize) {
    e.sourceSize = new Point(0, 0);
  }
  const {url, position, anchor, sourceSize, targetSize, objectFit, transformMatrix} = e;
  let imageContainer = draw.children()[i] as Container;
  let imageEl: Image;
  if (imageContainer) {
    imageEl = imageContainer.findOne("image") as Image;
  } else {
    imageContainer = draw.group();
    imageContainer.css({
      transform: "scale(1, -1)",
      "transform-origin": "50% 50%",
      "transform-box": "fill-box"
    } as any);
    imageEl = imageContainer.image();
    imageEl.css({
      "transform-origin": `${anchor.x * 100}% ${100 - anchor.y * 100}%`,
      "transform-box": "fill-box"
    } as any);
  }
  await loadImageEl(imageEl, url);
  const sw = imageEl.node.width.baseVal.value;
  const sh = imageEl.node.height.baseVal.value;
  let tw: number;
  let th: number;
  sourceSize.set(sw, sh);
  if (targetSize) {
    tw = targetSize.x;
    th = targetSize.y;
  } else {
    tw = sw;
    th = sh;
  }
  const translateX = position.x - anchor.x * sw;
  const translateY = position.y - (1 - anchor.y) * sh;
  let scaleX: number;
  let scaleY: number;
  if (sw > 0 && sh > 0) {
    scaleX = tw / sw;
    scaleY = th / sh;
    const sourceRatio = sw / sh;
    const targetRatio = tw / th;
    switch (objectFit) {
      case "contain":
        if (sourceRatio >= targetRatio) {
          scaleY = scaleX;
        } else {
          scaleX = scaleY;
        }
        break;
      case "cover":
        if (sourceRatio >= targetRatio) {
          scaleX = scaleY;
        } else {
          scaleY = scaleX;
        }
        break;
      case "fill":
        break;
      case "scale-down": {
        let scaleX2 = scaleX;
        let scaleY2 = scaleY;
        if (sourceRatio >= targetRatio) {
          scaleY2 = scaleX2 *= tw / sw;
        } else {
          scaleX2 = scaleY2 *= th / sh;
        }
        if (scaleX > scaleX2) {
          scaleX = scaleX2;
          scaleY = scaleY2;
        }
        break;
      }
      case "none":
      default:
        break;
    }
  } else {
    scaleX = 1;
    scaleY = 1;
  }
  const matrix = new Matrix({translate: [translateX, translateY], scale: [scaleX, scaleY]});
  matrix.transform(transformMatrix);
  imageEl.transform(matrix);
  return [imageContainer];
};
