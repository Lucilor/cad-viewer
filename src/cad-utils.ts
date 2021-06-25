import {G} from "@svgdotjs/svg.js";
import {ObjectOf, Point} from "@utils";
import {cloneDeep} from "lodash";
import {drawText} from "./draw";

export const getVectorFromArray = (data?: number[] | Point | null, defaultVal = new Point()) => {
    if (data instanceof Point) {
        return data.clone();
    }
    if (!Array.isArray(data)) {
        return defaultVal.clone();
    }
    data = data.filter((v) => !isNaN(v));
    return new Point(...data);
};

export const getArray = <T>(data: any): T[] => {
    if (Array.isArray(data)) {
        return cloneDeep(data);
    }
    return [];
};

export const getObject = <T>(data: any): ObjectOf<T> => {
    if (data && typeof data === "object" && !Array.isArray(data)) {
        return cloneDeep(data);
    }
    return {};
};

export const mergeArray = <T>(arr1: T[], arr2: T[], field?: string) => {
    if (field) {
        const keys: string[] = arr1.map((v: any) => v[field]);
        arr2.forEach((v: any) => {
            const idx = keys.indexOf(v[field]);
            if (idx === -1) {
                arr1.push(v);
            } else {
                arr1[idx] = v;
            }
        });
    } else {
        arr1 = Array.from(new Set(arr1.concat(arr2)));
    }
    return arr1;
};

export const separateArray = <T>(arr1: T[], arr2: T[], field?: string) => {
    if (field) {
        const keys = arr2.map((v: any) => v[field]);
        arr1 = arr1.filter((v: any) => !keys.includes(v[field]));
    } else {
        arr1 = arr1.filter((v) => !arr2.includes(v));
    }
    return arr1;
};

export const mergeObject = <T>(obj1: ObjectOf<T>, obj2: ObjectOf<T>) => {
    Object.assign(obj1, obj2);
    return obj1;
};

export const separateObject = <T>(obj1: ObjectOf<T>, obj2: ObjectOf<T>) => {
    for (const key in obj2) {
        delete obj1[key];
    }
    return obj1;
};

export const isBetween = (n: number, min: number, max: number) => n > min && n < max;

export type Expressions = ObjectOf<string>;

export class ExpressionsParser {
    expressions: Expressions;
    builtinFns = {
        round: "Math.round"
    };
    operators = ["+", "-", "*", "×", "÷", "/"];
    get regOperators() {
        return this.operators.map((o) => {
            if (["+", "/", "*"].includes(o)) {
                return "\\" + o;
            }
            return o;
        });
    }

    constructor(exps?: Expressions) {
        this.expressions = exps || {};
    }

    getVariables(rightSideOnly = false) {
        const vars = new Set<string>();
        const {expressions: exps, builtinFns, regOperators} = this;
        const opReg = new RegExp(regOperators.join("|"), "g");
        for (const key in exps) {
            if (!rightSideOnly && isNaN(Number(key))) {
                vars.add(key);
            }
            exps[key].split(opReg).forEach((name) => {
                Object.keys(builtinFns).forEach((fn) => {
                    const fnReg = new RegExp(`${fn}|\\(|\\)`, "g");
                    name = name.replace(fnReg, "");
                });
                if (isNaN(Number(name))) {
                    vars.add(name);
                }
            });
        }
        return Array.from(vars);
    }
}

export const lineweight2linewidth = (value: number) => {
    if (value >= 0.3) {
        return 2;
    } else {
        return 1;
    }
    // return value / 100 / 0.25;
};

export const linewidth2lineweight = (value: number) => {
    if (value >= 2) {
        return 0.3;
    } else {
        return 0.25;
    }
    // return value * 100 * 0.25;
};

export const toFixedTrim = (num: number, fractionDigits?: number | undefined) => {
    const str = num.toFixed(fractionDigits);
    return str.replace(/\.[1-9]*0+/, "");
};

type DrawTextParams = Parameters<typeof drawText>;
export const getWrapedText = (
    source: string,
    maxLength: number,
    style: DrawTextParams[2],
    position: DrawTextParams[3],
    anchor: DrawTextParams[4]
) => {
    const sourceLength = source.length;
    let start = 0;
    let end = 1;
    const tmpEl = new G();
    const arr: string[] = [];
    while (end < sourceLength) {
        const tmpText = source.slice(start, end);
        drawText(tmpEl, tmpText, style, position, anchor);
        if (tmpEl.width() < maxLength) {
            end++;
        } else {
            if (start === end - 1) {
                throw new Error("文字自动换行时出错");
            }
            arr.push(source.slice(start, end - 1));
            start = end - 1;
        }
    }
    arr.push(source.slice(start));
    tmpEl.remove();
    return arr;
};
