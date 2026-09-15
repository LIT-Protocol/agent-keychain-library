import { z } from "zod";
export declare const CATALOG_FORMAT: 1;
export declare const MAX_INPUT_BYTES: number;
export declare const MAX_OUTPUT_BYTES: number;
export declare const releaseIdSchema: z.ZodString;
export declare const operationSchema: z.ZodString;
export type Shape = {
    type: "object";
    description?: string;
    properties: Record<string, Shape>;
    required?: string[];
} | {
    type: "string";
    description?: string;
    minLength?: number;
    maxLength: number;
    pattern?: string;
    enum?: string[];
} | {
    type: "integer";
    description?: string;
    minimum?: number;
    maximum?: number;
} | {
    type: "number";
    description?: string;
} | {
    type: "boolean";
    description?: string;
} | {
    type: "array";
    description?: string;
    items: Shape;
    maxItems: number;
};
export declare const shapeSchema: z.ZodType<Shape>;
/** Converts a Shape to a strict zod validator. Unknown fields are rejected. */
export declare function shapeToZod(shape: Shape): z.ZodType;
/** Shapes are already a JSON Schema subset; this adds the closed-object marker MCP clients expect. */
export declare function shapeToJsonSchema(shape: Shape): Record<string, unknown>;
/** Input shapes travel inside the agent's signed request, which is canonical JSON: no floats. */
export declare function inputShapeIsCanonical(shape: Shape): boolean;
