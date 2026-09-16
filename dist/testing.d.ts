import { type UseDefinition } from "./schema.ts";
import type { ActionContext, ActionRequestInit, ActionUse } from "./lib.ts";
export type Upstream = (url: URL, init: Required<Pick<ActionRequestInit, "method" | "headers">> & {
    body?: string;
}) => Promise<{
    status?: number;
    body: string;
}> | {
    status?: number;
    body: string;
};
export declare function mockContext(definition: UseDefinition, credential: string, input: unknown, upstream: Upstream): ActionContext & {
    calls: {
        url: string;
        method: string;
    }[];
};
/**
 * Runs an action exactly as the harness would: credential pattern, input shape,
 * the action, then output shape and size. Returns the projected result or throws.
 */
export declare function runAction(definition: UseDefinition, use: ActionUse, credential: string, input: unknown, upstream: Upstream): Promise<{
    result: unknown;
    calls: {
        url: string;
        method: string;
    }[];
    serialized: string;
}>;
