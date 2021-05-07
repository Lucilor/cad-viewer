import {CadData, CadZhankai} from "./cad-data";
import {sortLines} from "./cad-lines";
import {CadLine, CadMtext, CadArc, CadCircle} from "./cad-entities";
import {Line, ObjectOf, Point, Rectangle} from "@lucilor/utils";

export const splitCad = (data: CadData) => {
    const lines = data.entities.line.filter((v) => v.color.rgbNumber() === 0x00ff00);
    const lineIds = lines.map((v) => v.id);
    const dumpData = new CadData();

    dumpData.entities.line = lines;
    const rects: Rectangle[] = [];
    const sorted = sortLines(dumpData);
    sorted.forEach((group) => {
        const min = new Point(Infinity, Infinity);
        const max = new Point(-Infinity, -Infinity);
        group.forEach(({start, end}) => {
            min.x = Math.min(min.x, start.x, end.x);
            min.y = Math.min(min.y, start.y, end.y);
            max.x = Math.max(max.x, start.x, end.x);
            max.y = Math.max(max.y, start.y, end.y);
        });
        rects.push(new Rectangle(min, max));
    });

    const result = rects.map(() => new CadData());
    data.getAllEntities().forEach((e) => {
        if (lineIds.includes(e.id)) {
            return;
        }
        rects.forEach((rect, i) => {
            if (e instanceof CadLine && rect.contains(new Line(e.start, e.end))) {
                result[i].entities.add(e.clone());
            } else if (e instanceof CadMtext && rect.contains(e.insert)) {
                result[i].entities.add(e);
            } else if (e instanceof CadArc && rect.contains(new Line(e.start, e.end))) {
                // ? 判断圆弧是否在矩形内, 此方法不严谨
                result[i].entities.add(e);
            } else if (e instanceof CadCircle) {
                const min = e.center.clone().sub(e.radius);
                const max = e.center.clone().add(e.radius);
                if (rect.contains(new Rectangle(min, max))) {
                    result[i].entities.add(e);
                }
            }
        });
    });

    const fields: ObjectOf<keyof CadData> = {
        名字: "name",
        分类: "type",
        条件: "conditions",
        模板放大: "mubanfangda",
        开料时刨坑: "kailiaoshibaokeng",
        变形方式: "baseLines",
        板材纹理方向: "bancaiwenlifangxiang",
        开料排版方式: "kailiaopaibanfangshi",
        默认开料板材: "morenkailiaobancai",
        算料处理: "suanliaochuli",
        显示宽度标注: "showKuandubiaozhu"
    };
    result.forEach((v) => {
        let toRemove = -1;
        v.entities.mtext.some((e, i) => {
            if (e.text.startsWith("CAD信息")) {
                toRemove = i;
                const arr = e.text.split("\n").slice(1);
                const obj: ObjectOf<any> = {};
                arr.forEach((str) => {
                    const [key, value] = str.split(/:|：/);
                    obj[key] = value;
                    const key2 = fields[key];
                    if (key2) {
                        if (typeof v[key2] === "string") {
                            (v[key2] as string) = value;
                        } else if (Array.isArray(v[key2])) {
                            (v[key2] as string[]) = value.split(/,|，/);
                        } else {
                            throw Error("CAD信息有错");
                        }
                    } else {
                        v.options[key] = value;
                    }
                });
                v.zhankai = [new CadZhankai(obj)];
                return true;
            }
            return false;
        });
        if (toRemove >= 0) {
            v.entities.mtext.splice(toRemove, 1);
        }
    });
    return result;
};

export const joinCad = (_cads: CadData[]) => {
    const result = new CadData();
    return result;
};
