import {Vector2} from "three";
import {CadEntity} from "./cad-entity/cad-entity";
import {CadEntities} from "./cad-entities";
import {CadLine} from "./cad-entity/cad-line";
import {CadArc} from "./cad-entity/cad-arc";
import {CadViewer} from "../cad-viewer";

interface LinesAtPoint {
	point: Vector2;
	tPoint: Vector2;
	lines: CadEntity[];
	selected: boolean;
}

export function generatePointsMap(entities: CadEntities, cad: CadViewer, accuracy = 1) {
	const pointsMap: LinesAtPoint[] = [];
	const addToMap = (point: Vector2, line: CadEntity) => {
		const linesAtPoint = pointsMap.find((v) => v.point.distanceTo(point) <= accuracy);
		if (linesAtPoint) {
			linesAtPoint.lines.push(line);
		} else {
			pointsMap.push({point, lines: [line], tPoint: cad.getScreenPoint(point), selected: false});
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

export function findAdjacentLines(pointsMap: LinesAtPoint[], entity: CadEntity, point?: Vector2, accuracy = 1): CadEntity[] {
	if (!point && entity instanceof CadLine) {
		const adjStart = findAdjacentLines(pointsMap, entity, entity.start);
		const adjEnd = findAdjacentLines(pointsMap, entity, entity.end);
		return [...adjStart, ...adjEnd];
	}
	const pal = pointsMap.find((v) => v.point.distanceTo(point) <= accuracy);
	if (pal) {
		const lines = pal.lines.filter((v) => v.id !== entity.id);
		return lines;
	}
	return [];
}

export function findAllAdjacentLines(pointsMap: LinesAtPoint[], entity: CadEntity, point: Vector2, accuracy = 1) {
	const entities: CadEntity[] = [];
	const id = entity.id;
	let closed = false;
	while (entity && point) {
		entity = findAdjacentLines(pointsMap, entity, point)[0];
		if (entity?.id === id) {
			closed = true;
			break;
		}
		if (entity) {
			if (entity instanceof CadLine) {
				entities.push(entity);
				const {start, end} = entity;
				if (start.distanceTo(point) <= accuracy) {
					point = end;
				} else if (end.distanceTo(point) < accuracy) {
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
				if (start.distanceTo(point) <= accuracy) {
					point = end;
				} else if (end.distanceTo(point) <= accuracy) {
					point = start;
				} else {
					point = null;
				}
			}
		}
	}
	return {entities, closed};
}
