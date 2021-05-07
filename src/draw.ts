import { Angle, Arc, Point } from "@lucilor/utils";
import {Circle, Container, Element, Line, Path, PathArrayAlias, Text} from "@svgdotjs/svg.js";
import {toFixedTrim} from "./utils";

export interface FontStyle {
    size: number;
    family: string;
    weight: string;
}

export const drawLine = (draw: Container, start: Point, end: Point, i = 0) => {
    let el = draw.children()[i] as Line;
    if (el instanceof Line) {
        el.plot(start.x, start.y, end.x, end.y);
    } else {
        el = draw.line(start.x, start.y, end.x, end.y).addClass("stroke").fill("none");
    }
    return [el];
};

export const drawCircle = (draw: Container, center: Point, radius: number, i = 0) => {
    let el = draw.children()[i] as Circle;
    if (el instanceof Circle) {
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

export const drawDimension = (
    draw: Container,
    renderStyle: number = 1,
    points: Point[],
    text: string,
    fontStyle: FontStyle,
    axis: "x" | "y",
    i = 0
) => {
    if (points.length < 8 || !(fontStyle.size > 0)) {
        draw.remove();
        return [];
    }
    const [p1, p2, p3, p4, p5, p6, p7, p8] = points;
    let l1: Line | null = null;
    let l2: Line | null = null;
    let l3: Line | null = null;
    if (renderStyle === 1) {
        l1 = drawLine(draw, p1, p3, i++)?.[0];
        l2 = drawLine(draw, p3, p4, i++)?.[0];
        l3 = drawLine(draw, p4, p2, i++)?.[0];
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
            l3 = drawLine(draw, p3, p4, i++)[0];
        }
    }
    let tri1: Path | undefined;
    let tri2: Path | undefined;
    if (l3) {
        tri1 = drawShape(draw, [p3, p5, p6], "fill", i++)[0];
        tri2 = drawShape(draw, [p4, p7, p8], "fill", i++)[0];
    }
    text = text.replace("<>", toFixedTrim(p3.distanceTo(p4)));
    const middle = p3.clone().add(p4).divide(2);
    let textEl: Text | null = null;
    if (axis === "x") {
        textEl = drawText(draw, text, fontStyle, middle, new Point(0.5, 1), false, i++)[0];
    } else if (axis === "y") {
        textEl = drawText(draw, text, fontStyle, middle, new Point(1, 0.5), true, i++)[0];
    }
    return [l1, l2, l3, tri1, tri2, textEl].filter((v) => v) as Element[];
};
