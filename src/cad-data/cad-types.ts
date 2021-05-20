export type CadType = "LINE" | "MTEXT" | "DIMENSION" | "ARC" | "CIRCLE" | "HATCH" | "SPLINE" | "LEADER" | "";

// * 数组顺序决定渲染顺序
export const cadTypes: CadType[] = ["DIMENSION", "HATCH", "MTEXT", "CIRCLE", "ARC", "LINE", "SPLINE", "LEADER"];

export type CadTypeKey = "line" | "mtext" | "dimension" | "arc" | "circle" | "hatch" | "spline" | "leader";

export const cadTypesKey: CadTypeKey[] = ["line", "mtext", "dimension", "arc", "circle", "hatch", "spline", "leader"];
