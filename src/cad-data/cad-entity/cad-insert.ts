import {Point, Matrix, ObjectOf, MatrixLike, Rectangle} from "@utils";
import {getVectorFromArray} from "../../cad-utils";
import {CadLayer} from "../cad-layer";
import {CadType} from "../cad-types";
import {CadEntity} from "./cad-entity";

export class CadInsert extends CadEntity {
    type: CadType = "INSERT";
    name: string;
    insert: Point;
    transformMatrix = new Matrix();
    calcBoundingRect = false;
    get boundingRect() {
        const rect = new Rectangle();
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
        return rect;
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
            // transformMatrix: this.transformMatrix.decompose()
        };
    }

    clone(resetId = false) {
        return new CadInsert(this, [], resetId);
    }

    transform(matrix: MatrixLike, alter = false, parent?: CadEntity) {
        this._transform(matrix, alter, parent);
        if (alter) {
            this.transformMatrix.transform(matrix);
        }
        return this;
    }
}
