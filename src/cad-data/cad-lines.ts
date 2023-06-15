import {DEFAULT_TOLERANCE, Point} from "@lucilor/utils";
import {CadArc, CadLine, CadLineLike, CadMtext, DEFAULT_LENGTH_TEXT_SIZE} from "..";
import {getVectorFromArray} from "../cad-utils";
import {CadData} from "./cad-data";
import {CadEntities} from "./cad-entities";

export type PointsMap = {
  point: Point;
  lines: CadLineLike[];
  selected: boolean;
}[];

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
    if (entity.info.ignorePointsMap) {
      return;
    }
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
): {entities: CadLineLike[]; closed: boolean} => {
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
    const result = findAllAdjacentLines(map, e, p, tolerance, ids);
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
  lines.forEach((line) => {
    if (line instanceof CadLine) {
      const pointsMap = generatePointsMap(data.getAllEntities());
      const {entities} = findAllAdjacentLines(pointsMap, line, line.end);
      const d = length - line.length;
      const theta = line.theta.rad;
      const translate = new Point(Math.cos(theta), Math.sin(theta)).multiply(d);
      line.end.add(translate);
      entities.forEach((e) => e.transform({translate}, true));
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
  const allIds = new Set<string>();
  map.forEach((v) => {
    if (v.lines.length === 1) {
      arr.push(v);
    }
    v.lines.forEach((l) => allIds.add(l.id));
  });
  if (arr.length < 1) {
    // * 每个点都有不止条线, 说明图形闭合
    arr = map;
  }
  arr.sort((a, b) => {
    const c = a.lines[0].mingzi === "起始线" ? -Infinity : a.lines[0].start.x;
    const d = b.lines[0].mingzi === "起始线" ? -Infinity : b.lines[0].start.x;
    return c - d;
  });
  const exclude: string[] = [];
  let regen = false;
  for (const v of arr) {
    const startLine = v.lines[0];
    if (exclude.includes(startLine.id)) {
      continue;
    }
    if (v.point.equals(startLine.end)) {
      swapStartEnd(startLine);
      regen = true;
    }
    const startPoint = startLine.end;
    if (regen) {
      map = generatePointsMap(entities);
      regen = false;
    }
    let adjLines = findAllAdjacentLines(map, startLine, startPoint).entities.filter((e) => e.length);
    if (startLine instanceof CadLine) {
      adjLines = adjLines.filter((e) => {
        if (e instanceof CadLine) {
          if (!e.theta.equals(startLine.theta, tolerance)) {
            return true;
          }
          if (e.start.equals(startLine.start, tolerance) && e.end.equals(startLine.end, tolerance)) {
            return false;
          }
          if (e.start.equals(startLine.end, tolerance) && e.end.equals(startLine.start, tolerance)) {
            return false;
          }
          return true;
        }
        return true;
      });
    }
    let lines = [startLine, ...adjLines];
    let count = lines.length;
    const duplicateLines: Set<number>[] = [];
    const isPtEq = (p1: Point, p2: Point) => p1.equals(p2, tolerance);
    for (let i = 0; i < count; i++) {
      for (let j = i + 1; j < count; j++) {
        const e1 = lines[i];
        const e2 = lines[j];
        if (i === j || !(e1 instanceof CadLine) || !(e2 instanceof CadLine)) {
          continue;
        }
        const p1 = e1.start;
        const p2 = e1.end;
        const p3 = e2.start;
        const p4 = e2.end;
        if (e1.theta.equals(e2.theta, tolerance) && ((isPtEq(p1, p3) && isPtEq(p2, p4)) || (isPtEq(p1, p4) && isPtEq(p2, p3)))) {
          const group = duplicateLines.find((vv) => vv.has(i) || vv.has(j));
          if (group) {
            group.add(i);
            group.add(j);
          } else {
            duplicateLines.push(new Set([i, j]));
          }
        }
      }
    }
    const toRemove = new Set(duplicateLines.map((vv) => Array.from(vv).slice(1)).flat());
    toRemove.forEach((i) => result.push([lines[i]]));
    lines = lines.filter((_, i) => !toRemove.has(i));
    count = lines.length;
    for (let i = 1; i < count; i++) {
      const prev = lines[i - 1];
      const curr = lines[i];
      if (prev.end.distanceTo(curr.start) > tolerance) {
        swapStartEnd(curr);
        regen = true;
      }
    }
    result.push(lines);
    for (const l of lines) {
      exclude.push(l.id);
      allIds.delete(l.id);
    }
  }
  if (allIds.size > 0) {
    result.push(data.entities.filter((e) => allIds.has(e.id)).toArray() as CadLineLike[]);
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
        line.lengthTextSize = line.length < 10 ? 22 : DEFAULT_LENGTH_TEXT_SIZE;
      }
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
      gongshiText.anchor.set(1 - anchor.x, 1 - anchor.y);

      let bianhuazhiText = line.children.find((c) => c.info.isBianhuazhiText) as CadMtext;
      if (!(bianhuazhiText instanceof CadMtext)) {
        bianhuazhiText = new CadMtext();
        bianhuazhiText.info.isBianhuazhiText = true;
        bianhuazhiText.info.offset = [0, 0];
        line.addChild(bianhuazhiText);
        bianhuazhiText.insert.copy(outer);
      }
      bianhuazhiText.anchor.copy(anchor);
    });
  });
};

export const isLinesParallel = (lines: CadLine[], accurary = 0) => {
  const line0 = lines[0];
  const theta0 = Math.atan((line0.start.y - line0.end.y) / (line0.start.x - line0.end.x));
  for (let i = 1; i < lines.length; i++) {
    const {start, end} = lines[i];
    const theta1 = Math.atan((start.y - end.y) / (start.x - end.x));
    const dTheta = Math.abs(theta0 - theta1);
    if (dTheta !== Math.PI && dTheta > accurary) {
      return false;
    }
  }
  return true;
};
