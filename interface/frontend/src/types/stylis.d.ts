// Type declaration for stylis package used by @emotion/styled
declare module 'stylis' {
    export interface Stylis {
        (selector: string, styles: string): string;
    }

    export const compile: Stylis;
    export const serialize: Stylis;
    export const stringify: Stylis;
    export const middleware: any[];
    export const RULESET: number;
    export const DECLARATION: number;
    export const COMMENT: number;
    export const IMPORT: number;
    export const KEYFRAMES: number;
    export const LAYER: number;

    const stylis: Stylis;
    export default stylis;
}