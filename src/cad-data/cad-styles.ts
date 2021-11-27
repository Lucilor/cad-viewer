export interface FontStyle {
    color?: string;
    size?: number;
    family?: string;
    weight?: string;
}
export interface CadStyle {
    color?: string;
    fontStyle?: FontStyle;
    lineStyle?: LineStyle;
    opacity?: number;
}

export interface LineStyle {
    color?: string;
    dashArray?: number[];
    padding?: number | number[];
    width?: number;
}

export interface CadDimensionStyle {
    color?: string;
    dimensionLine?: {hidden?: boolean} & LineStyle;
    extensionLines?: {hidden?: boolean; length?: number} & LineStyle;
    arrows?: {hidden?: boolean; color?: string; size?: number};
    text?: {hidden?: boolean} & Partial<FontStyle>;
}