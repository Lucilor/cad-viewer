import {Matrix, ObjectOf, Point} from "@lucilor/utils";
import {getVectorsFromArray, purgeObject} from "../../cad-utils";
import {CadLayer} from "../cad-layer";
import {CadDimension, CadDimensionEntity} from "./cad-dimension";

export class CadDimensionLinear extends CadDimension {
  axis: "x" | "y";
  entity1: CadDimensionEntity;
  entity2: CadDimensionEntity;
  defPoints?: Point[];
  distance: number;
  distance2?: number;
  cad1: string;
  cad2: string;

  constructor(data: any = {}, layers: CadLayer[] = [], resetId = false) {
    super(data, layers, resetId);
    this.entity1 = {id: "", location: "center"};
    this.entity2 = {id: "", location: "center"};
    (["entity1", "entity2"] as ("entity1" | "entity2")[]).forEach((field) => {
      if (data[field]) {
        if (typeof data[field].id === "string") {
          this[field].id = data[field].id;
        }
        this[field].location = data[field].location ?? "center";
      }
    });
    const defPoints = getVectorsFromArray(data.defPoints);
    if (defPoints) {
      this.defPoints = defPoints;
    } else {
      delete this.defPoints;
    }
    this.axis = data.axis ?? "x";
    this.distance = data.distance ?? 20;
    this.cad1 = data.cad1 ?? "";
    this.cad2 = data.cad2 ?? "";
  }

  protected _transform(matrix: Matrix) {
    if (this.defPoints) {
      this.defPoints.forEach((v) => v.transform(matrix));
    }
  }

  export(): ObjectOf<any> {
    const result = {
      ...super.export(),
      ...purgeObject({
        axis: this.axis,
        entity1: this.entity1,
        entity2: this.entity2,
        distance: this.distance,
        cad1: this.cad1,
        cad2: this.cad2
      })
    };
    if (this.defPoints) {
      result.defPoints = this.defPoints.map((v) => v.toArray());
    }
    return result;
  }

  clone(resetId = false): CadDimensionLinear {
    return this._afterClone(new CadDimensionLinear(this.export(), [], resetId));
  }

  getDistance() {
    if (this.defPoints) {
      if (this.axis === "x") {
        return this.defPoints[0].y - this.defPoints[2].y;
      } else if (this.axis === "y") {
        return this.defPoints[0].x - this.defPoints[2].x;
      }
      return NaN;
    } else {
      return this.distance;
    }
  }

  setDistance(value: number) {
    if (this.defPoints) {
      if (this.axis === "x") {
        this.defPoints[0].y = this.defPoints[2].y + value;
      } else if (this.axis === "y") {
        this.defPoints[0].x = this.defPoints[2].x + value;
      }
    } else {
      this.distance = value;
    }
    return this;
  }

  switchAxis() {
    if (this.defPoints) {
      const distance = this.getDistance();
      const [p0, p1, p2] = this.defPoints;
      if (this.axis === "x") {
        this.axis = "y";
        const dy = p1.y - p2.y;
        this.defPoints = [p1, p0, p2];
        p1.y = p2.y;
        p0.x = p2.x + dy;
        this.setDistance(distance);
      } else if (this.axis === "y") {
        this.axis = "x";
        const dx = p1.x - p2.x;
        this.defPoints = [p1, p0, p2];
        p1.x = p2.x;
        p0.y = p2.y + dx;
        this.setDistance(distance);
      }
    } else {
      if (this.axis === "x") {
        this.axis = "y";
      } else if (this.axis === "y") {
        this.axis = "x";
      }
    }
    return this;
  }
}
