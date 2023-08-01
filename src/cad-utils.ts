import {getTypeOf, ObjectOf, Point} from "@lucilor/utils";
import {cloneDeep, isEqual} from "lodash";

export class Defaults {
  static get DASH_ARRAY() {
    return [20, 7];
  }

  static get FONT_SIZE() {
    return 16;
  }
}

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

export const getVectorsFromArray = (data: any, defaultVal = new Point()) => {
  if (Array.isArray(data)) {
    const result: Point[] = [];
    data.forEach((v: any) => result.push(getVectorFromArray(v, defaultVal)));
    return result;
  }
  return null;
};

export const getArray = <T>(data: any): T[] => {
  if (getTypeOf(data) === "array") {
    return cloneDeep(data);
  }
  return [];
};

export const getObject = <T>(data: any): ObjectOf<T> => {
  if (getTypeOf(data) === "object") {
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

export const lineweight2linewidth = (x: number) => Math.max(1, x / 5 - 3);

export const linewidth2lineweight = (x: number) => x * 5 + 15;

export const toFixedTrim = (num: number, fractionDigits?: number | undefined) => {
  const str = num.toFixed(fractionDigits);
  return str.replace(/\.[1-9]*0+/, "");
};

const purgeObject2 = (obj: ObjectOf<any>, defaultObj?: ObjectOf<any>) => {
  const isEmpty = (val: any) => val === undefined || val === null;
  Object.keys(obj).forEach((key) => {
    let value = obj[key];
    if (isEmpty(value) || key === "") {
      delete obj[key];
    } else if (defaultObj && isEqual(value, defaultObj[key])) {
      delete obj[key];
    } else if (Array.isArray(value)) {
      value = value.filter((v) => !isEmpty(v));
      if (value.length < 1) {
        delete obj[key];
      }
    } else if (typeof value === "object") {
      purgeObject2(value, defaultObj);
      if (Object.keys(value).length < 1) {
        delete obj[key];
      }
    }
  });
};

export const purgeObject = (obj: ObjectOf<any>, defaultObj?: ObjectOf<any>): ObjectOf<any> => {
  const result = cloneDeep(obj);
  purgeObject2(result, defaultObj);
  return result;
};
