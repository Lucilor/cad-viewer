import {CadEntities} from "./cad-entities";
import {CadData} from "./cad-data";
import {CadViewer} from "../cad-viewer";
import {getVectorFromArray, isBetween} from "./utils";
import {DEFAULT_TOLERANCE, Point} from "@lucilor/utils";
import {CadLine, CadArc, CadMtext} from "./cad-entity";

export type CadLineLike = CadLine | CadArc;

export type PointsMap = {
	point: Point;
	lines: CadLineLike[];
	selected: boolean;
}[];

export function generatePointsMap(entities: CadEntities, tolerance = DEFAULT_TOLERANCE) {
	const map: PointsMap = [];
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
}

export function findAdjacentLines(map: PointsMap, entity: CadLineLike, point?: Point, tolerance = DEFAULT_TOLERANCE): CadLineLike[] {
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
}

export function findAllAdjacentLines(map: PointsMap, entity: CadLineLike, point: Point, tolerance = DEFAULT_TOLERANCE, ids = []) {
	const entities: CadLineLike[] = [];
	let closed = false;
	ids.push(entity.id);
	const next = findAdjacentLines(map, entity, point, tolerance);
	for (const e of next) {
		if (ids.includes(e.id)) {
			closed = true;
			break;
		}
		let p: Point;
		const {start, end} = e;
		if (start.equals(point, tolerance)) {
			p = end;
		} else if (end.equals(point, tolerance)) {
			p = start;
		}
		entities.push(e);
		ids.push(e.id);
		const result = findAllAdjacentLines(map, e, p, tolerance, ids) as {entities: CadLineLike[]; closed: boolean};
		closed = result.closed;
		entities.push(...result.entities);
	}
	return {entities, closed};
}

export function setLinesLength(data: CadData, lines: CadLine[], length: number) {
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
}

export function swapStartEnd(entity: CadLineLike) {
	if (entity instanceof CadLine) {
		[entity.start, entity.end] = [entity.end, entity.start];
	}
	if (entity instanceof CadArc) {
		[entity.start_angle, entity.end_angle] = [entity.end_angle, entity.start_angle];
		entity.clockwise = !entity.clockwise;
	}
}

export function sortLines(data: CadData, tolerance = DEFAULT_TOLERANCE) {
	const entities = data.getAllEntities();
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
		const l1 = a.lines[0];
		const l2 = b.lines[0];
		let notStart1 = 1;
		let notStart2 = 1;
		if (l1 instanceof CadLine && l1.mingzi === "起始线") {
			notStart1 = 0;
		}
		if (l2 instanceof CadLine && l2.mingzi === "起始线") {
			notStart2 = 0;
		}
		return notStart1 - notStart2;
	});
	const exclude = [];
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
		for (let i = 1; i < adjLines.length; i++) {
			const prev = adjLines[i - 1];
			const curr = adjLines[i];
			if (prev.end.distanceTo(curr.start) > tolerance) {
				swapStartEnd(curr);
			}
		}
		const lines = [startLine, ...adjLines];
		exclude.push(...lines.map((e) => e.id));
		result.push(lines);
	}
	return result;
}

export function validateLines(data: CadData, tolerance = DEFAULT_TOLERANCE) {
	const lines = sortLines(data, tolerance);
	const result = {valid: true, errMsg: "", lines};
	lines.forEach((v) => v.forEach((vv) => (vv.info.error = false)));
	if (lines.length < 1) {
		result.valid = false;
		result.errMsg = "没有线";
	} else if (lines.length > 1) {
		result.valid = false;
		result.errMsg = "线分成了多段";
		let lastEnd: Point;
		lines.forEach((group, i) => {
			if (i === 0) {
				group[group.length - 1].info.error = true;
				lastEnd = group[group.length - 1].end;
			} else {
				const start = group[0].start;
				const end = group[group.length - 1].end;
				if (lastEnd.distanceTo(start) < lastEnd.distanceTo(end)) {
					group[0].info.error = true;
					lastEnd = end;
				} else {
					group[group.length - 1].info.error = true;
					lastEnd = start;
				}
			}
		});
	}
	return result;
}

export function generateLineTexts(cad: CadViewer, data: CadData, tolerance = DEFAULT_TOLERANCE) {
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
			const offset = new Point(Math.cos(theta), Math.sin(theta));
			const outer = line.middle.clone().add(offset);
			const inner = line.middle.clone().sub(offset);
			const anchor = new Point(0.5, 0.5);
			let {x, y} = offset;
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

			const {lineLength, lineGongshi} = cad.config();
			let lengthText = line.children.find((c) => c.info.isLengthText) as CadMtext;
			if (lineLength > 0) {
				if (!(lengthText instanceof CadMtext)) {
					lengthText = new CadMtext();
					lengthText.info.isLengthText = true;
					lengthText.info.offset = [0, 0];
					line.add(lengthText);
				}
				const offset = getVectorFromArray(lengthText.info.offset);
				lengthText.insert.copy(offset.add(outer));
				lengthText.text = Math.round(line.length).toString();
				lengthText.font_size = lineLength;
				lengthText.anchor.copy(anchor);
			} else {
				line.remove(lengthText);
			}

			let gongshiText = line.children.find((c) => c.info.isGongshiText) as CadMtext;
			if (lineGongshi) {
				if (!(gongshiText instanceof CadMtext)) {
					gongshiText = new CadMtext();
					gongshiText.info.isGongshiText = true;
					gongshiText.info.offset = [0, 0];
					line.add(gongshiText);
					gongshiText.insert.copy(inner);
				}
				gongshiText.text = line.gongshi;
				gongshiText.font_size = lineGongshi;
				gongshiText.anchor.set(1 - anchor.x, 1 - anchor.y);
			} else {
				line.remove(gongshiText);
			}
		});
	});
}

export function autoFixLine(cad: CadViewer, line: CadLine, tolerance = DEFAULT_TOLERANCE) {
	const {start, end} = line;
	const dx = start.x - end.x;
	const dy = start.y - end.y;
	const translate = new Point();
	if (isBetween(Math.abs(dx))) {
		translate.x = dx;
	}
	if (isBetween(Math.abs(dy))) {
		translate.y = dy;
	}
	const map = generatePointsMap(cad.data.getAllEntities(), tolerance);
	const {entities} = findAllAdjacentLines(map, line, line.end, tolerance);
	entities.forEach((e) => e.transform({translate}));
	line.end.add(translate);
}
