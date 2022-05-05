import {Matrix, MatrixLike, ObjectOf, Point, Rectangle} from "@utils";
import {getVectorFromArray, purgeObject} from "../../cad-utils";
import {CadLayer} from "../cad-layer";
import {ObjectFit} from "../cad-styles";
import {EntityType} from "../cad-types";
import {CadEntity} from "./cad-entity";

export class CadImage extends CadEntity {
    type: EntityType = "IMAGE";
    url: string;
    transformation: Matrix;
    anchor: Point;
    sourceSize = new Point();
    targetSize: Point | null = null;
    objectFit: ObjectFit = "none";

    protected get _boundingRectCalc() {
        return Rectangle.min;
    }

    constructor(data: any = {}, layers: CadLayer[] = [], resetId = false) {
        super(data, layers, resetId);
        this.url = data.url || "";
        this.transformation = new Matrix(data.transformation);
        this.anchor = getVectorFromArray(data.anchor);
        this.objectFit = data.objectFit || "none";
    }

    export(): ObjectOf<any> {
        return {
            ...super.export(),
            ...purgeObject({
                url: this.url,
                transformation: this.transformation.toArray(),
                anchor: this.anchor.toArray(),
                sourceSize: this.sourceSize.toArray(),
                targetSize: this.targetSize ? this.targetSize.toArray() : null,
                objectFit: this.objectFit
            })
        };
    }

    protected _transform(matrix: MatrixLike, parent?: CadEntity) {
        this.transformation.transform(matrix);
    }

    clone(resetId?: boolean): CadImage {
        return this._afterClone(new CadImage(this.export(), [], resetId));
    }

    equals(entity: CadImage) {
        return this.url === entity.url && this.transformation.equals(entity.transformation);
    }
}
