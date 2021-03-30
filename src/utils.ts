import {ObjectOf, Point} from "@lucilor/utils";
import {cloneDeep} from "lodash";
import {CadLine} from "./cad-data/cad-entities";

export const getVectorFromArray = (data: number[] | Point, defaultVal = new Point()) => {
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

export const isLinesParallel = (lines: CadLine[], accurary = 0) => {
    const line0 = lines[0];
    const theta0 = Math.atan((line0.start.y - line0.end.y) / (line0.start.x - line0.end.x));
    for (let i = 1; i < lines.length; i++) {
        const {start, end} = lines[i];
        const theta1 = Math.atan((start.y - end.y) / (start.x - end.x));
        const dTheta = Math.abs(theta0 - theta1);
        if (dTheta !== Math.PI && dTheta > accurary) {
            return false;
        }
    }
    return true;
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
