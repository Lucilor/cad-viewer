import {exportObject, Matrix, MatrixLike, ObjectOf, Point, Rectangle} from "@lucilor/utils";
import {Properties} from "csstype";
import {isEqual} from "lodash";
import {getVectorFromArray, purgeObject} from "../../cad-utils";
import {CadLayer} from "../cad-layer";
import {EntityType} from "../cad-types";
import {CadEntity} from "./cad-entity";

export class CadImage extends CadEntity {
  type: EntityType = "IMAGE";
  url: string;
  position: Point;
  anchor: Point;
  sourceSize: Point | null = null;
  targetSize: Point | null = null;
  objectFit: Properties["objectFit"] = "none";
  transformMatrix: Matrix = new Matrix();

  protected get _boundingRectCalc() {
    const {position, anchor, sourceSize, targetSize} = this;
    const size = targetSize || sourceSize;
    if (!size) {
      return Rectangle.min;
    }
    const {x, y} = position;
    const {x: width, y: height} = size;
    const {x: anchorX, y: anchorY} = anchor;
    const min = new Point(x - width * anchorX, y - height * anchorY);
    const max = min.clone().add(size);
    return new Rectangle(min, max);
  }

  constructor(data: any = {}, layers: CadLayer[] = [], resetId = false) {
    super(data, layers, resetId);
    this.url = data.url || "";
    this.position = getVectorFromArray(data.position);
    this.anchor = getVectorFromArray(data.anchor);
    if (data.sourceSize) {
      this.sourceSize = getVectorFromArray(data.sourceSize);
    }
    if (data.targetSize) {
      this.targetSize = getVectorFromArray(data.targetSize);
    }
    this.objectFit = data.objectFit || "none";
    if (data.transformMatrix) {
      this.transformMatrix.compose(data.transformMatrix);
    }
  }

  export(): ObjectOf<any> {
    return {
      ...super.export(),
      ...purgeObject({
        url: this.url,
        position: this.position.toArray(),
        anchor: this.anchor.toArray(),
        sourceSize: this.sourceSize ? this.sourceSize.toArray() : null,
        targetSize: this.targetSize ? this.targetSize.toArray() : null,
        objectFit: this.objectFit,
        transformMatrix: exportObject(this.transformMatrix.decompose(), new Matrix().decompose())
      })
    };
  }

  protected _transform(matrix: MatrixLike) {
    this.transformMatrix.transform(matrix);
  }

  clone(resetId?: boolean): CadImage {
    return this._afterClone(new CadImage(this.export(), [], resetId));
  }

  equals(entity: CadImage) {
    return (
      this.url === entity.url &&
      this.position.equals(entity.position) &&
      this.anchor.equals(entity.anchor) &&
      isEqual(this.sourceSize, entity.sourceSize) &&
      isEqual(this.targetSize, entity.targetSize) &&
      this.objectFit === entity.objectFit
    );
  }
}
