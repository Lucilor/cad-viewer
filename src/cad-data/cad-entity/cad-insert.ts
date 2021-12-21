import {Point, Matrix, ObjectOf, MatrixLike, Rectangle} from "@utils";
import {getVectorFromArray} from "../../cad-utils";
import {CadLayer} from "../cad-layer";
import {CadType} from "../cad-types";
import {CadEntity} from "./cad-entity";

export class CadInsert extends CadEntity {
    type: CadType = "INSERT";
    name: string;
    insert: Point;
    transformation = new Matrix();
    calcBoundingRect = false;
    get _boundingRectCalc() {
        const data = this.root?.root;
        if (data) {
            const block = data.blocks[this.name];
            if (block) {
                const rect = Rectangle.min;
                block.forEach((e) => {
                    rect.expandByRect(e.boundingRect.transform({translate: this.insert}));
                });
            }
        }
        return Rectangle.min;
    }

    constructor(data: any = {}, layers: CadLayer[] = [], resetId = false) {
        super(data, layers, resetId);
        this.name = data.name ?? "";
        this.insert = getVectorFromArray(data.insert);
    }

    export(): ObjectOf<any> {
        return {
            ...super.export(),
            name: this.name,
            insert: this.insert.toArray()
            // transformation: this.transformation.decompose()
        };
    }

    clone(resetId = false): CadInsert {
        return this._afterClone(new CadInsert(this.export(), [], resetId));
    }

    protected _transform(matrix: MatrixLike, parent?: CadEntity) {
        this.transformation.transform(matrix);
    }
}
