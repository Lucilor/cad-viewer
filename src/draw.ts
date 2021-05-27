import {Angle, Arc, Line, Point} from "@utils";
import {Circle as SvgCircle, Container, Element, Line as SvgLine, Path, PathArrayAlias, Text} from "@svgdotjs/svg.js";
import {toFixedTrim} from "./cad-utils";

export interface FontStyle {
    size: number;
    family: string;
    weight: string;
}

export const drawLine = (draw: Container, start: Point, end: Point, i = 0) => {
    let el = draw.children()[i] as SvgLine;
    if (el instanceof SvgLine) {
        el.plot(start.x, start.y, end.x, end.y);
    } else {
        el = draw.line(start.x, start.y, end.x, end.y).addClass("stroke").fill("none");
    }
    return [el];
};

export const drawCircle = (draw: Container, center: Point, radius: number, i = 0) => {
    let el = draw.children()[i] as SvgCircle;
    if (el instanceof SvgCircle) {
        el.size(radius * 2).center(center.x, center.y);
    } else {
        el = draw.circle(radius * 2).center(center.x, center.y);
        el.addClass("stroke").fill("none");
    }
    return [el];
};

export const drawArc = (
    draw: Container,
    center: Point,
    radius: number,
    startAngle: number,
    endAngle: number,
    clockwise: boolean,
    i = 0
) => {
    const l0 = Math.PI * 2 * radius;
    const arc = new Arc(new Point(center.x, center.y), radius, new Angle(startAngle, "deg"), new Angle(endAngle, "deg"), clockwise);
    if (arc.totalAngle.deg === 360) {
        return drawCircle(draw, center, radius, i);
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
    return [el];
};

export const drawText = (draw: Container, text: string, style: FontStyle, position: Point, anchor: Point, vertical = false, i = 0) => {
    const {size, family, weight} = style;
    if (!text || !(size > 0)) {
        draw.remove();
        return [];
    }
    let el = draw.children()[i] as Text;
    if (el instanceof Text) {
        el.text(text).font({size});
    } else {
        el = draw.text(text).addClass("fill").stroke("none");
        el.css("transform-box", "fill-box");
        el.css("white-space", "pre");
        el.font({size}).leading(1);
    }
    if (vertical) {
        el.css("writing-mode", "vertical-lr");
        el.css("transform", `translate(${-anchor.x * 100}%, ${(1 - anchor.y) * 100}%) scale(-1, 1) rotate(180deg)`);
    } else {
        el.css("writing-mode", "");
        el.css("transform", `translate(${-anchor.x * 100}%, ${anchor.y * 100}%) scale(1, -1)`);
    }
    el.css("font-family", family);
    el.css("font-weight", weight);
    el.move(position.x, position.y);
    return [el];
};

export const drawShape = (draw: Container, points: Point[], type: "fill" | "stroke", i = 0) => {
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
    return [el];
};

export const drawArrow = (draw: Container, start: Point, end: Point, size: number, double: boolean, i = 0) => {
    const getTriangle = (p: Point, theta: Angle) => {
        const theta1 = theta.clone().add(new Angle(30, "deg")).rad;
        const theta2 = theta.clone().sub(new Angle(30, "deg")).rad;
        const p2 = p.clone().add(size * Math.cos(theta1), size * Math.sin(theta1));
        const p3 = p.clone().add(size * Math.cos(theta2), size * Math.sin(theta2));
        return [p, p2, p3];
    };
    const result1 = drawLine(draw, start, end, i++);
    let result2: ReturnType<typeof drawShape> = [];
    if (double) {
        const triangle1 = getTriangle(start, new Line(start, end).theta);
        result2 = drawShape(draw, triangle1, "fill", i++);
    }
    const triangle2 = getTriangle(end, new Line(end, start).theta);
    const result3 = drawShape(draw, triangle2, "fill", i++);
    return [...result1, ...result2, ...result3];
};

export const drawDimension = (
    draw: Container,
    renderStyle = 1,
    points: Point[],
    text: string,
    fontStyle: FontStyle,
    axis: "x" | "y",
    i = 0
) => {
    if (points.length < 4 || !(fontStyle.size > 0)) {
        draw.remove();
        return [];
    }
    const [p1, p2, p3, p4] = points;
    let l1: SvgLine | null = null;
    let l2: SvgLine | null = null;
    let arrow: ReturnType<typeof drawArrow> = [];
    const arrowSize = Math.max(1, Math.min(20, p3.distanceTo(p4) / 8));
    if (renderStyle === 1) {
        l1 = drawLine(draw, p1, p3, i++)?.[0];
        l2 = drawLine(draw, p2, p4, i++)?.[0];
        arrow = drawArrow(draw, p3, p4, arrowSize, true, i);
        i += arrow.length;
    } else if (renderStyle === 2 || renderStyle === 3) {
        const length = 20;
        if (axis === "x") {
            l1 = drawLine(draw, p3.clone().sub(0, length), p3.clone().add(0, length), i++)[0];
            l2 = drawLine(draw, p4.clone().sub(0, length), p4.clone().add(0, length), i++)[0];
        } else if (axis === "y") {
            l1 = drawLine(draw, p3.clone().sub(length, 0), p3.clone().add(length, 0), i++)[0];
            l2 = drawLine(draw, p4.clone().sub(length, 0), p4.clone().add(length, 0), i++)[0];
        }
        if (renderStyle === 2) {
            arrow = drawArrow(draw, p3, p4, arrowSize, true, i);
            i += arrow.length;
        }
    }
    text = text.replace("<>", toFixedTrim(p3.distanceTo(p4)));
    const middle = p3.clone().add(p4).divide(2);
    let textEl: Text | null = null;
    if (axis === "x") {
        textEl = drawText(draw, text, fontStyle, middle, new Point(0.5, 1), false, i++)[0];
    } else if (axis === "y") {
        textEl = drawText(draw, text, fontStyle, middle, new Point(1, 0.5), true, i++)[0];
    }
    return [l1, l2, ...arrow, textEl].filter((v) => v) as Element[];
};
