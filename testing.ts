// Test helpers for catalog actions. `mockContext` builds the ActionContext an
// action receives inside Lit, enforcing the same manifest constraints the Keychain
// harness does (host allowlist, HTTPS only, request budget, input and output
// shapes) against an in-memory upstream you supply. It is for tests only.
import { shapeToZod, MAX_OUTPUT_BYTES } from "./shape.ts";
import type { UseDefinition } from "./schema.ts";
import type { ActionContext, ActionRequestInit, ActionUse } from "./lib.ts";

export type Upstream = (
  url: URL,
  init: Required<Pick<ActionRequestInit, "method" | "headers">> & {
    body?: string;
  },
) =>
  | Promise<{ status?: number; body: string }>
  | { status?: number; body: string };

const METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE"]);
export function mockContext(
  definition: UseDefinition,
  credential: string,
  input: unknown,
  upstream: Upstream,
): ActionContext & { calls: { url: string; method: string }[] } {
  const allowed = new Set(definition.allowedHosts);
  const calls: { url: string; method: string }[] = [];
  let requests = 0;
  const fetchText = async (url: string, init: ActionRequestInit = {}) => {
    const target = new URL(String(url));
    if (
      target.protocol !== "https:" ||
      !allowed.has(target.hostname) ||
      target.username !== "" ||
      target.password !== "" ||
      target.port !== ""
    )
      throw new Error(`Host not allowed by manifest: ${target.href}`);
    const method = init.method ?? "GET";
    if (!METHODS.has(method)) throw new Error(`Method not allowed: ${method}`);
    if (++requests > definition.limits.maxRequests)
      throw new Error("Request budget exceeded");
    calls.push({ url: target.href, method });
    const response = await upstream(target, {
      method,
      headers: init.headers ?? {},
      body: init.body,
    });
    const status = response.status ?? 200;
    if (status < 200 || status >= 300)
      throw new Error(`Request failed (${status})`);
    if (
      new TextEncoder().encode(response.body).byteLength >
      definition.limits.maxResponseBytes
    )
      throw new Error("Response too large");
    return response.body;
  };
  return {
    credential,
    input,
    fetchText,
    fetchJson: async (url, init) => JSON.parse(await fetchText(url, init)),
    calls,
  };
}
/**
 * Runs an action exactly as the harness would: credential pattern, input shape,
 * the action, then output shape and size. Returns the projected result or throws.
 */
export async function runAction(
  definition: UseDefinition,
  use: ActionUse,
  credential: string,
  input: unknown,
  upstream: Upstream,
) {
  if (!new RegExp(definition.credentialPattern).test(credential))
    throw new Error("Credential does not match the manifest pattern");
  const validatedInput = definition.input
    ? shapeToZod(definition.input).parse(input ?? {})
    : undefined;
  if (!definition.input && input !== undefined)
    throw new Error("Action takes no input");
  const context = mockContext(definition, credential, validatedInput, upstream);
  const result = shapeToZod(definition.output).parse(await use(context));
  const serialized = JSON.stringify(result);
  if (new TextEncoder().encode(serialized).byteLength > MAX_OUTPUT_BYTES)
    throw new Error("Output too large");
  return { result, calls: context.calls, serialized };
}
