export type EntityType = "LINE" | "MTEXT" | "DIMENSION" | "ARC" | "CIRCLE" | "HATCH" | "SPLINE" | "LEADER" | "INSERT" | "IMAGE" | "";

// * 数组顺序决定渲染顺序
export const entityTypes: EntityType[] = ["IMAGE", "DIMENSION", "HATCH", "MTEXT", "CIRCLE", "ARC", "LINE", "SPLINE", "LEADER", "INSERT"];

export type EntityTypeKey = "line" | "mtext" | "dimension" | "arc" | "circle" | "hatch" | "spline" | "leader" | "insert" | "image";

export const entityTypesKey: EntityTypeKey[] = [
    "image",
    "dimension",
    "hatch",
    "mtext",
    "circle",
    "arc",
    "line",
    "spline",
    "leader",
    "insert"
];

export const entityTypesMap: Record<EntityTypeKey, EntityType> = (() => {
    const map: Record<string, EntityType> = {};
    entityTypesKey.forEach((key, index) => {
        map[key] = entityTypes[index];
    });
    return map;
})();
