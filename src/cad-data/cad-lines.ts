import {DEFAULT_TOLERANCE, isBetween, Point} from "@lucilor/utils";
import {CadViewer} from "..";
import {getVectorFromArray} from "../utils";
import {CadData} from "./cad-data";
import {CadLineLike, CadEntities, CadLine, CadArc, CadMtext} from "./cad-entities";

export const validColors = ["#ffffff", "#ff0000", "#00ff00", "#0000ff", "#ffff00", "#00ffff"];

export type PointsMap = {
    point: Point;
    lines: CadLineLike[];
    selected: boolean;
}[];

export const LINE_LIMIT = [0.01, 0.7];

export const generatePointsMap = (entities?: CadEntities, tolerance = DEFAULT_TOLERANCE) => {
    const map: PointsMap = [];
    if (!entities) {
        return map;
    }
    const addToMap = (point: Point, line: CadLine | CadArc) => {
        const linesAtPoint = map.find((v) => v.point.distanceTo(point) <= tolerance);
        if (linesAtPoint) {
            linesAtPoint.lines.push(line);
        } else {
            map.push({point, lines: [line], selected: false});
        }
    };
    entities.line.forEach((entity) => {
        const {start, end} = entity;
        if (start.distanceTo(end) > 0) {
            addToMap(start, entity);
            addToMap(end, entity);
        }
    });
    entities.arc.forEach((entity) => {
        const curve = entity.curve;
        if (curve.length > 0) {
            addToMap(curve.getPoint(0), entity);
            addToMap(curve.getPoint(1), entity);
        }
    });
    return map;
};

export const findAdjacentLines = (map: PointsMap, entity: CadLineLike, point: Point, tolerance = DEFAULT_TOLERANCE): CadLineLike[] => {
    if (!point && entity instanceof CadLine) {
        const adjStart = findAdjacentLines(map, entity, entity.start);
        const adjEnd = findAdjacentLines(map, entity, entity.end);
        return [...adjStart, ...adjEnd];
    }
    const pal = map.find((v) => v.point.distanceTo(point) <= tolerance);
    if (pal) {
        const lines = pal.lines.filter((v) => v.id !== entity.id);
        return lines;
    }
    return [];
};

export const findAllAdjacentLines = (
    map: PointsMap,
    entity: CadLineLike,
    point: Point,
    tolerance = DEFAULT_TOLERANCE,
    ids: string[] = []
) => {
    const entities: CadLineLike[] = [];
    let closed = false;
    ids.push(entity.id);
    const next = findAdjacentLines(map, entity, point, tolerance);
    for (const e of next) {
        if (ids.includes(e.id)) {
            closed = true;
            break;
        }
        let p: Point | undefined;
        const {start, end} = e;
        if (start.equals(point, tolerance)) {
            p = end;
        } else if (end.equals(point, tolerance)) {
            p = start;
        } else {
            continue;
        }
        entities.push(e);
        ids.push(e.id);
        const result = findAllAdjacentLines(map, e, p, tolerance, ids) as {entities: CadLineLike[]; closed: boolean};
        closed = result.closed;
        entities.push(...result.entities);
    }
    return {entities, closed};
};

export const findCrossingLine = (data: CadData, line: CadLine) => {
    const lines = data.getAllEntities().line;
    const curve = line.curve;
    return lines.filter((l) => l.curve.intersects(curve));
};

export const setLinesLength = (data: CadData, lines: CadLine[], length: number) => {
    const pointsMap = generatePointsMap(data.getAllEntities());
    lines.forEach((line) => {
        if (line instanceof CadLine) {
            const {entities} = findAllAdjacentLines(pointsMap, line, line.end);
            const d = length - line.length;
            const theta = line.theta.rad;
            const translate = new Point(Math.cos(theta), Math.sin(theta)).multiply(d);
            line.end.add(translate);
            entities.forEach((e) => e.transform({translate}));
        }
    });
};

export const swapStartEnd = (entity: CadLineLike) => {
    if (entity instanceof CadLine) {
        [entity.start, entity.end] = [entity.end, entity.start];
    }
    if (entity instanceof CadArc) {
        [entity.start_angle, entity.end_angle] = [entity.end_angle, entity.start_angle];
        entity.clockwise = !entity.clockwise;
    }
    entity.swapped = !entity.swapped;
};

export const sortLines = (data: CadData, tolerance = DEFAULT_TOLERANCE) => {
    const entities = data.entities;
    const result: CadLineLike[][] = [];
    if (entities.length === 0) {
        return result;
    }
    let map = generatePointsMap(entities);
    let arr: PointsMap = [];
    map.forEach((v) => {
        if (v.lines.length === 1) {
            arr.push(v);
        }
    });
    if (arr.length < 1) {
        // * 每个点都有不止条线, 说明图形闭合
        arr = map;
    }
    arr.sort((a, b) => {
        const c = a.lines[0].mingzi === "起始线" ? -1 : 1;
        const d = b.lines[0].mingzi === "起始线" ? -1 : 1;
        return c - d;
    });
    const exclude: string[] = [];
    for (const v of arr) {
        const startLine = v.lines[0];
        if (exclude.includes(startLine.id)) {
            continue;
        }
        if (v.point.equals(startLine.end)) {
            swapStartEnd(startLine);
            map = generatePointsMap(entities);
        }
        const startPoint = startLine.end;
        const adjLines = findAllAdjacentLines(map, startLine, startPoint).entities.filter((e) => e.length);
        const lines = [startLine, ...adjLines];
        for (let i = 1; i < lines.length; i++) {
            const prev = lines[i - 1];
            const curr = lines[i];
            if (prev.end.distanceTo(curr.start) > tolerance) {
                swapStartEnd(curr);
            }
        }
        exclude.push(...lines.map((e) => e.id));
        result.push(lines);
    }
    return result;
};

export const getLinesDistance = (l1: CadLineLike, l2: CadLineLike) => {
    const {start: p1, end: p2} = l1;
    const {start: p3, end: p4} = l2;
    const d1 = p1.distanceTo(p3);
    const d2 = p1.distanceTo(p4);
    const d3 = p2.distanceTo(p3);
    const d4 = p2.distanceTo(p4);
    return Math.min(d1, d2, d3, d4);
};

export interface ValidateResult {
    valid: boolean;
    errMsg: string[];
    lines: CadLineLike[][];
}

export const validateLines = (data: CadData, tolerance = DEFAULT_TOLERANCE) => {
    const lines = sortLines(data, tolerance);
    const result: ValidateResult = {valid: true, errMsg: [], lines};
    const [min, max] = LINE_LIMIT;
    lines.forEach((v) =>
        v.forEach((vv) => {
            const {start, end} = vv;
            const dx = Math.abs(start.x - end.x);
            const dy = Math.abs(start.y - end.y);
            if (isBetween(dx, min, max) || isBetween(dy, min, max)) {
                vv.info.errors = ["斜率不符合要求"];
                result.errMsg.push(`线${vv.id}斜率不符合要求`);
            } else {
                vv.info.errors = [];
            }
        })
    );
    if (lines.length < 1) {
        result.valid = false;
        result.errMsg.push("没有线");
    } else if (lines.length > 1) {
        result.valid = false;
        result.errMsg.push("CAD分成了多段");
        for (let i = 0; i < lines.length - 1; i++) {
            const currGroup = lines[i];
            const nextGroup = lines[i + 1];
            const l1 = currGroup[0];
            const l2 = currGroup[currGroup.length - 1];
            const l3 = nextGroup[0];
            const l4 = nextGroup[nextGroup.length - 1];
            let minD = Infinity;
            let errLines: CadLineLike[] = [];
            [
                [l1, l3],
                [l1, l4],
                [l2, l3],
                [l2, l4]
            ].forEach((group) => {
                const d = getLinesDistance(group[0], group[1]);
                if (d < minD) {
                    minD = d;
                    errLines = group;
                }
            });
            errLines.forEach((l) => {
                if (!l.info.errors.includes("CAD分成了多段的断裂处")) {
                    l.info.errors.push("CAD分成了多段的断裂处");
                }
            });
        }
    }
    return result;
};

export const generateLineTexts = (data: CadData, tolerance = DEFAULT_TOLERANCE) => {
    const lines = sortLines(data, tolerance);
    lines.forEach((group) => {
        let cp = 0;
        const length = group.length;
        if (length < 1) {
            return;
        } else if (length === 1) {
            cp = 1;
        } else {
            const middle = group[Math.floor(length / 2)].middle;
            const start = group[0].start;
            const end = group[length - 1].end;
            const v1 = middle.clone().sub(start);
            const v2 = middle.clone().sub(end);
            cp = v1.x * v2.y - v1.y * v2.x;
            // ? 差积等于0时视为1
            if (cp === 0) {
                cp = 1;
            }
        }
        group.forEach((line) => {
            let theta: number;
            if (line instanceof CadLine) {
                theta = line.theta.rad;
            } else {
                theta = new CadLine({start: line.start, end: line.end}).theta.rad;
            }
            if (cp > 0) {
                theta += Math.PI / 2;
            } else {
                theta -= Math.PI / 2;
            }
            const offsetMid = new Point(Math.cos(theta), Math.sin(theta));
            const outer = line.middle.clone().add(offsetMid);
            const inner = line.middle.clone().sub(offsetMid);
            const anchor = new Point(0.5, 0.5);
            let {x, y} = offsetMid;
            if (Math.abs(x) > Math.abs(y)) {
                y = 0;
            } else {
                x = 0;
            }
            if (Math.abs(x) > tolerance) {
                if (x > 0) {
                    anchor.x = 0;
                } else {
                    anchor.x = 1;
                }
            }
            if (Math.abs(y) > tolerance) {
                if (y > 0) {
                    anchor.y = 1;
                } else {
                    anchor.y = 0;
                }
            }

            let lengthText = line.children.find((c) => c.info.isLengthText) as CadMtext;
            if (!(lengthText instanceof CadMtext)) {
                lengthText = new CadMtext();
                lengthText.info.isLengthText = true;
                lengthText.info.offset = [0, 0];
                line.addChild(lengthText);
                const textOffset = 10;
                if (anchor.x === 0) {
                    lengthText.info.offset[0] += textOffset;
                } else if (anchor.x === 1) {
                    lengthText.info.offset[0] -= textOffset;
                }
                if (anchor.y === 0) {
                    lengthText.info.offset[1] -= textOffset;
                } else if (anchor.y === 1) {
                    lengthText.info.offset[1] += textOffset;
                }
            }
            lengthText.calcBoundingPoints = false;
            const offset = getVectorFromArray(lengthText.info.offset);
            lengthText.insert.copy(offset.add(outer));
            if (Array.isArray(lengthText.info.anchorOverwrite)) {
                lengthText.anchor.copy(getVectorFromArray(lengthText.info.anchorOverwrite));
            } else {
                lengthText.anchor.copy(anchor);
            }

            let gongshiText = line.children.find((c) => c.info.isGongshiText) as CadMtext;
            if (!(gongshiText instanceof CadMtext)) {
                gongshiText = new CadMtext();
                gongshiText.info.isGongshiText = true;
                gongshiText.info.offset = [0, 0];
                line.addChild(gongshiText);
                gongshiText.insert.copy(inner);
            }
            gongshiText.calcBoundingPoints = false;
            gongshiText.anchor.set(1 - anchor.x, 1 - anchor.y);

            let bianhuazhiText = line.children.find((c) => c.info.isBianhuazhiText) as CadMtext;
            if (!(bianhuazhiText instanceof CadMtext)) {
                bianhuazhiText = new CadMtext();
                bianhuazhiText.info.isBianhuazhiText = true;
                bianhuazhiText.info.offset = [0, 0];
                line.addChild(bianhuazhiText);
                bianhuazhiText.insert.copy(outer);
            }
            bianhuazhiText.calcBoundingPoints = false;
            bianhuazhiText.anchor.copy(anchor);
        });
    });
};

export const autoFixLine = (cad: CadViewer, line: CadLine, tolerance = DEFAULT_TOLERANCE) => {
    const {start, end} = line;
    const dx = start.x - end.x;
    const dy = start.y - end.y;
    const [min, max] = LINE_LIMIT;
    const translate = new Point();
    if (isBetween(Math.abs(dx), min, max)) {
        translate.x = dx;
    }
    if (isBetween(Math.abs(dy), min, max)) {
        translate.y = dy;
    }
    const map = generatePointsMap(cad.data.getAllEntities(), tolerance);
    const {entities} = findAllAdjacentLines(map, line, line.end, tolerance);
    entities.forEach((e) => e.transform({translate}));
    line.end.add(translate);
};
