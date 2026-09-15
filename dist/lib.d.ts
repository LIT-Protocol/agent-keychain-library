export type { Shape } from "./shape.ts";
/** Throws unless `ok` is truthy. Inside Lit every throw becomes `access_denied`. */
export declare function requireThat(ok: unknown, message?: string): asserts ok;
export type ActionMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
export type ActionRequestInit = {
    method?: ActionMethod;
    headers?: Record<string, string>;
    body?: string;
};
export type ActionContext<Input = unknown> = {
    /** The decrypted credential, already matched against `credentialPattern`. */
    credential: string;
    /** The agent's request input, validated against the manifest's `input` shape. */
    input: Input;
    /** HTTPS JSON request to an allowed host. Non-2xx, redirects and oversize bodies throw. */
    fetchJson: (url: string, init?: ActionRequestInit) => Promise<any>;
    /** As `fetchJson`, returning the raw UTF-8 body. */
    fetchText: (url: string, init?: ActionRequestInit) => Promise<string>;
};
/**
 * An action projects the upstream response onto the manifest's `output` shape and
 * returns it. Throwing anything denies the request; the agent only ever sees
 * `access_denied`, never an upstream error, header or reflected string.
 */
export type ActionUse<Input = unknown> = (context: ActionContext<Input>) => Promise<unknown>;
export declare const defineAction: <Input = unknown>(use: ActionUse<Input>) => ActionUse<Input>;
/** Percent-encodes one path segment and rejects anything that could change the route. */
export declare function pathSegment(value: unknown, maxLength?: number): string;
