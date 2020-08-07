import {CadEntity} from "./cad-entity";
import {Vector2, Line, Mesh} from "three";
import {CAD_TYPES} from "../cad-types";
import {CadLayer} from "../cad-layer";
import {getVectorFromArray} from "../utils";
import {CadTransformation} from "../cad-transformation";

export class CadHatch extends CadEntity {
	bgcolor: number[];
	paths: {
		edges: {
			start: Vector2;
			end: Vector2;
		}[];
		vertices: Vector2[];
	}[];
	object?: Mesh;

	constructor(data: any = {}, layers: CadLayer[] = [], resetId = false) {
		data.type = CAD_TYPES.hatch;
		super(data, layers, resetId);
		this.bgcolor = Array.isArray(data.bgcolor) ? data.bgcolor : [0, 0, 0];
		this.paths = [];
		if (Array.isArray(data.paths)) {
			data.paths.forEach((path) => {
				const edges: CadHatch["paths"][0]["edges"] = [];
				const vertices: CadHatch["paths"][0]["vertices"] = [];
				if (Array.isArray(path.edges)) {
					path.edges.forEach((edge) => {
						const start = getVectorFromArray(edge.start);
						const end = getVectorFromArray(edge.end);
						edges.push({start, end});
					});
				}
				if (Array.isArray(path.vertices)) {
					path.vertices.forEach((vertice) => {
						vertices.push(getVectorFromArray(vertice));
					});
				}
				this.paths.push({edges, vertices});
			});
		}
	}

	export() {
		const paths = [];
		this.paths.forEach((path) => {
			const edges = [];
			const vertices = [];
			path.edges.forEach((edge) => edges.push({start: edge.start.toArray(), end: edge.end.toArray()}));
			path.vertices.forEach((vertice) => vertices.push(vertice.toArray()));
			paths.push({edges, vertices});
		});
		return {...super.export(), paths};
	}

	transform({matrix}: CadTransformation) {
		this.paths.forEach((path) => {
			path.edges.forEach((edge) => {
				edge.start.applyMatrix3(matrix);
				edge.end.applyMatrix3(matrix);
			});
			path.vertices.forEach((vertice) => vertice.applyMatrix3(matrix));
		});
		return this;
	}

	clone(resetId = false) {
		return new CadHatch(this, [], resetId);
	}

	equals(entity: CadHatch) {
		// TODO: not yet implemented
		return false;
	}
}
