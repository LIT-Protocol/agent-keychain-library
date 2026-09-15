export declare const ALLOWED_IMPORT = "../../lib.ts";
export declare const BANNED: [RegExp, string][];
/** Returns the list of violations for one action.ts source; empty means it passes. */
export declare function lintActionSource(source: string): string[];
