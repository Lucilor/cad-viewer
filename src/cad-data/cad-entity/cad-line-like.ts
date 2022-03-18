import {ObjectOf, Point} from "@utils";
import {purgeObject} from "../../cad-utils";
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

export const 企料位置识别 = ["无", "靠近胶条位", "远离胶条位", "企料正面", "企料背面"];

export interface CadLineLikeInfo {
    [key: string]: any;
    ignorePointsMap?: boolean;
    varName?: string;
}

export abstract class CadLineLike extends CadEntity {
    abstract get start(): Point;
    abstract get end(): Point;
    abstract get middle(): Point;
    abstract get length(): number;
    get deltaX() {
        return this.end.x - this.start.x;
    }
    get deltaY() {
        return this.end.y - this.start.y;
    }
    get maxX() {
        return Math.max(this.start.x, this.end.x);
    }
    get maxY() {
        return Math.max(this.start.y, this.end.y);
    }
    get minX() {
        return Math.min(this.start.x, this.end.x);
    }
    get minY() {
        return Math.min(this.start.y, this.end.y);
    }
    swapped: boolean;
    mingzi: string;
    qujian: string;
    gongshi: string;
    guanlianbianhuagongshi: string;
    hideLength: boolean;
    lengthTextSize: number;
    nextZhewan: string;
    betweenZhewan: string;
    zhewanOffset: number;
    zhewanValue: number;
    zidingzhankaichang: string;
    zhankaifangshi: "自动计算" | "使用线长" | "指定长度";
    zhankaixiaoshuchuli: "不处理" | "舍去小数" | "小数进一" | "四舍五入";
    suanliaosanxiaoshuchuli: "默认" | "舍去小数" | "小数进一" | "四舍五入";
    kailiaoshishanchu: boolean;
    变化方式: string;
    角度范围: number[];
    可输入修改: boolean;
    info!: CadLineLikeInfo;
    圆弧显示: "默认" | "半径" | "R+半径" | "φ+直径" | "弧长" = "默认";
    显示线长?: string;
    线id?: string;
    企料位置识别: string;
    算料不要: boolean;
    分体线长公式: string;

    constructor(data: any = {}, layers: CadLayer[] = [], resetId = false) {
        super(data, layers, resetId);
        this.mingzi = data.mingzi ?? "";
        this.qujian = data.qujian ?? "";
        this.gongshi = data.gongshi ?? "";
        this.guanlianbianhuagongshi = data.guanlianbianhuagongshi ?? "";
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
        this.suanliaosanxiaoshuchuli = data.suanliaosanxiaoshuchuli ?? "默认";
        this.kailiaoshishanchu = !!data.kailiaoshishanchu;
        this.变化方式 = data.变化方式 ?? 变化方式[0];
        this.角度范围 = data.角度范围 ?? [0, 90];
        this.可输入修改 = typeof data.可输入修改 === "boolean" ? data.可输入修改 : true;
        this.圆弧显示 = data.圆弧显示 ?? "默认";
        if (data.显示线长) {
            this.显示线长 = data.显示线长;
        }
        if (data.线id) {
            this.线id = data.线id;
        }
        this.swapped = data.swapped ?? false;
        this.企料位置识别 = data.企料位置识别 ?? 企料位置识别[0];
        this.算料不要 = data.算料不要 ?? false;
        this.分体线长公式 = data.分体线长公式 ?? "";
    }

    export(): ObjectOf<any> {
        const result = {
            ...super.export(),
            ...purgeObject({
                mingzi: this.mingzi,
                qujian: this.qujian,
                gongshi: this.gongshi,
                guanlianbianhuagongshi: this.guanlianbianhuagongshi,
                hideLength: this.hideLength,
                lengthTextSize: this.lengthTextSize,
                nextZhewan: this.nextZhewan,
                betweenZhewan: this.betweenZhewan,
                zhewanOffset: this.zhewanOffset,
                zhewanValue: this.zhewanValue,
                zidingzhankaichang: this.zidingzhankaichang,
                zhankaifangshi: this.zhankaifangshi,
                zhankaixiaoshuchuli: this.zhankaixiaoshuchuli,
                suanliaosanxiaoshuchuli: this.suanliaosanxiaoshuchuli,
                kailiaoshishanchu: this.kailiaoshishanchu,
                变化方式: this.变化方式,
                角度范围: this.角度范围,
                可输入修改: this.可输入修改,
                圆弧显示: this.圆弧显示,
                swapped: this.swapped,
                企料位置识别: this.企料位置识别,
                算料不要: this.算料不要,
                分体线长公式: this.分体线长公式
            })
        };
        if (this.显示线长) {
            result.显示线长 = this.显示线长;
        }
        if (this.线id) {
            result.线id = this.线id;
        }
        return result;
    }

    abstract clone(resetId?: boolean): CadLineLike;
}
