// * 数组顺序决定渲染顺序
export const entityTypes = ["IMAGE", "DIMENSION", "HATCH", "MTEXT", "CIRCLE", "ARC", "LINE", "SPLINE", "LEADER", "INSERT"] as const;
export type EntityType = (typeof entityTypes)[number];

export const entityTypesKey = ["image", "dimension", "hatch", "mtext", "circle", "arc", "line", "spline", "leader", "insert"] as const;
export type EntityTypeKey = (typeof entityTypesKey)[number];

export const entityTypesMap: Record<EntityTypeKey, EntityType> = (() => {
  const map: Record<string, EntityType> = {};
  entityTypesKey.forEach((key, index) => {
    map[key] = entityTypes[index];
  });
  return map;
})();
