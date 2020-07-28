import {Vector2} from "three";
import {CadEntities} from "./cad-entities";
import {CadLine} from "./cad-entity/cad-line";
import {CadArc} from "./cad-entity/cad-arc";
import {CadData} from "./cad-data";

type LineLike = CadLine | CadArc;

interface LinesAtPoint {
	point: Vector2;
	lines: LineLike[];
	selected: boolean;
}

export const DEFAULT_TOLERANCE = 0.01;

export function generatePointsMap(entities: CadEntities, tolerance = DEFAULT_TOLERANCE) {
	const pointsMap: LinesAtPoint[] = [];
	const addToMap = (point: Vector2, line: CadLine | CadArc) => {
		const linesAtPoint = pointsMap.find((v) => v.point.distanceTo(point) <= tolerance);
		if (linesAtPoint) {
			linesAtPoint.lines.push(line);
		} else {
			pointsMap.push({point, lines: [line], selected: false});
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
		if (curve.getLength() > 0) {
			addToMap(curve.getPoint(0), entity);
			addToMap(curve.getPoint(1), entity);
		}
	});
	return pointsMap;
}

export function findAdjacentLines(pointsMap: LinesAtPoint[], entity: LineLike, point?: Vector2, tolerance = DEFAULT_TOLERANCE): LineLike[] {
	if (!point && entity instanceof CadLine) {
		const adjStart = findAdjacentLines(pointsMap, entity, entity.start);
		const adjEnd = findAdjacentLines(pointsMap, entity, entity.end);
		return [...adjStart, ...adjEnd];
	}
	const pal = pointsMap.find((v) => v.point.distanceTo(point) <= tolerance);
	if (pal) {
		const lines = pal.lines.filter((v) => v.id !== entity.id);
		return lines;
	}
	return [];
}

export function findAllAdjacentLines(pointsMap: LinesAtPoint[], entity: LineLike, point: Vector2, tolerance = DEFAULT_TOLERANCE) {
	const entities: LineLike[] = [];
	const id = entity.id;
	let closed = false;
	while (entity && point) {
		entity = findAdjacentLines(pointsMap, entity, point, tolerance)[0];
		if (entity?.id === id) {
			closed = true;
			break;
		}
		if (entity) {
			if (entity instanceof CadLine) {
				entities.push(entity);
				const {start, end} = entity;
				if (start.distanceTo(point) <= tolerance) {
					point = end;
				} else if (end.distanceTo(point) < tolerance) {
					point = start;
				} else {
					point = null;
				}
			}
			if (entity instanceof CadArc) {
				entities.push(entity);
				const curve = entity.curve;
				const start = curve.getPoint(0);
				const end = curve.getPoint(1);
				if (start.distanceTo(point) <= tolerance) {
					point = end;
				} else if (end.distanceTo(point) <= tolerance) {
					point = start;
				} else {
					point = null;
				}
			}
		}
	}
	return {entities, closed};
}

export function swapStartEnd(entity: LineLike) {
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
	const result: LineLike[][] = [];
	if (entities.length === 0) {
		return result;
	}
	let map = generatePointsMap(entities);
	const arr: LinesAtPoint[] = [];
	map.forEach((v) => {
		if (v.lines.length === 1) {
			arr.push(v);
		}
	});
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
		const adjLines = findAllAdjacentLines(map, startLine, startPoint).entities;
		for (let i = 1; i < adjLines.length; i++) {
			const prev = adjLines[i - 1];
			const curr = adjLines[i];
			if (prev.end.distanceTo(curr.start) > tolerance) {
				swapStartEnd(curr);
			}
		}
		if (adjLines.length) {
			exclude.push(adjLines[adjLines.length - 1].id);
		} else {
			exclude.push(startLine.id);
		}
		const lines = [startLine, ...adjLines];
		result.push(lines);
	}
	for (const j in result) {
		const group = result[j];
		for (let i = 1; i < group.length; i++) {
			const prev = group[i - 1];
			const curr = group[i];
			if (prev instanceof CadLine && curr instanceof CadLine && prev.slope === curr.slope) {
				prev.end = curr.end;
				curr.start.set(0, 0);
				curr.end.set(0, 0);
			}
		}
		result[j] = group.filter((e) => e.length > 0);
	}
	return result;
}

export function validateLines(data: CadData, tolerance = DEFAULT_TOLERANCE) {
	const lines = sortLines(data, tolerance);
	const result = {valid: true, errMsg: "", lines};
	if (lines.length < 1) {
		result.valid = false;
		result.errMsg = "没有线";
	} else if (lines.length > 1) {
		result.valid = false;
		result.errMsg = "线分成了多段";
		let lastEnd: Vector2;
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
