export type CadType = "LINE" | "MTEXT" | "DIMENSION" | "ARC" | "CIRCLE" | "HATCH" | "SPLINE" | "LEADER" | "INSERT" | "";

// * 数组顺序决定渲染顺序
export const cadTypes: CadType[] = ["DIMENSION", "HATCH", "MTEXT", "CIRCLE", "ARC", "LINE", "SPLINE", "LEADER", "INSERT"];

export type CadTypeKey = "line" | "mtext" | "dimension" | "arc" | "circle" | "hatch" | "spline" | "leader" | "insert";

export const cadTypesKey: CadTypeKey[] = ["line", "mtext", "dimension", "arc", "circle", "hatch", "spline", "leader", "insert"];
