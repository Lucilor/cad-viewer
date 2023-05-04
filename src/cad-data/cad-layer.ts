import {v4} from "uuid";
import {lineweight2linewidth, linewidth2lineweight} from "../cad-utils";
import {ColoredObject} from "../colored-object";

export class CadLayer extends ColoredObject {
  id: string;
  name: string;
  linewidth: number;
  hidden: boolean;
  _lineweight: number;

  constructor(data: any = {}) {
    super();
    this.name = data.name || "";
    this.id = data.id ?? v4();
    if (typeof data.color === "number") {
      this.setIndexColor(data.color);
    }
    this.linewidth = typeof data.lineWidth === "number" ? data.lineWidth : 1;
    this._lineweight = -3;
    if (typeof data.lineweight === "number") {
      this._lineweight = data.lineweight;
      if (data.lineweight >= 0) {
        this.linewidth = lineweight2linewidth(data.lineweight);
      }
    }
    this.hidden = data.hidden ?? false;
  }

  export() {
    return {
      id: this.id,
      color: this.getIndexColor(),
      name: this.name,
      lineweight: linewidth2lineweight(this.linewidth),
      hidden: this.hidden
    };
  }
}
