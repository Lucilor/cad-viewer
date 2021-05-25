import {ObjectOf, Point} from "@utils";
import {lineweight2linewidth, linewidth2lineweight} from "../../cad-utils";
import {DEFAULT_LENGTH_TEXT_SIZE} from "../cad-entities";
import {CadLayer} from "../cad-layer";
import {CadEntity} from "./cad-entity";

export const 变化方式 = [
    "按比例",
    "只能减小",
    "只能增大",
    "只能旋转",
    "先旋转后按比例",
    "旋转不足时再按比例",
    "按比例不足时再旋转",
    "旋转按比例都可以",
    "不可改变"
];

export abstract class CadLineLike extends CadEntity {
    abstract get start(): Point;
    abstract get end(): Point;
    abstract get middle(): Point;
    abstract get length(): number;
    swapped: boolean;
    linewidth: number;
    _lineweight: number;
    mingzi: string;
    qujian: string;
    gongshi: string;
    hideLength: boolean;
    lengthTextSize: number;
    nextZhewan: "自动" | "无" | "1mm" | "6mm";
    betweenZhewan: "自动" | "无" | "1mm" | "6mm";
    zhewanOffset: number;
    zhewanValue: number;
    zidingzhankaichang: string;
    zhankaifangshi: "自动计算" | "使用线长" | "指定长度";
    zhankaixiaoshuchuli: "不处理" | "舍去小数" | "小数进一" | "四舍五入";
    kailiaoshishanchu: boolean;
    变化方式: string;
    角度范围: number[];

    constructor(data: any = {}, layers: CadLayer[] = [], resetId = false) {
        super(data, layers, resetId);
        this.swapped = data.swapped === true;
        this.mingzi = data.mingzi ?? "";
        this.qujian = data.qujian ?? "";
        this.gongshi = data.gongshi ?? "";
        this.hideLength = data.hideLength === true;
        this.lengthTextSize = data.lengthTextSize ?? DEFAULT_LENGTH_TEXT_SIZE;
        this.nextZhewan = data.nextZhewan ?? "自动";
        this.betweenZhewan = data.betweenZhewan ?? "自动";
        this.zhewanOffset = data.zhewanOffset ?? 0;
        this.zhewanValue = data.zhewanValue ?? 0;
        this.zidingzhankaichang = data.zidingzhankaichang ?? "";
        if (typeof data.kailiaofangshi === "string" && data.kailiaofangshi) {
            this.zhankaifangshi = data.kailiaofangshi;
        } else if (typeof data.zhankaifangshi === "string") {
            this.zhankaifangshi = data.zhankaifangshi;
        } else {
            const zidingzhankaichangNum = Number(this.zidingzhankaichang);
            if (!isNaN(zidingzhankaichangNum) && zidingzhankaichangNum > 0) {
                this.zhankaifangshi = "指定长度";
            } else {
                this.zhankaifangshi = "自动计算";
            }
        }
        this.zhankaixiaoshuchuli = data.zhankaixiaoshuchuli ?? "不处理";
        this.kailiaoshishanchu = !!data.kailiaoshishanchu;
        this.linewidth = data.linewidth ?? 1;
        this._lineweight = -3;
        if (typeof data.lineweight === "number") {
            this._lineweight = data.lineweight;
            if (data.lineweight >= 0) {
                this.linewidth = lineweight2linewidth(data.lineweight);
            } else if (data.lineweight === -1) {
                const layer = layers.find((l) => l.name === this.layer);
                if (layer) {
                    this.linewidth = layer.linewidth;
                }
            }
        }
        this.变化方式 = data.变化方式 ?? 变化方式[0];
        this.角度范围 = data.角度范围 ?? [0, 90];
    }

    export(): ObjectOf<any> {
        return {
            ...super.export(),
            lineweight: linewidth2lineweight(this.linewidth),
            mingzi: this.mingzi,
            qujian: this.qujian,
            gongshi: this.gongshi,
            hideLength: this.hideLength,
            lengthTextSize: this.lengthTextSize,
            nextZhewan: this.nextZhewan,
            betweenZhewan: this.betweenZhewan,
            zhewanOffset: this.zhewanOffset,
            zhewanValue: this.zhewanValue,
            zidingzhankaichang: this.zidingzhankaichang,
            zhankaifangshi: this.zhankaifangshi,
            zhankaixiaoshuchuli: this.zhankaixiaoshuchuli,
            kailiaoshishanchu: this.kailiaoshishanchu,
            变化方式: this.变化方式,
            角度范围: this.角度范围
        };
    }
}