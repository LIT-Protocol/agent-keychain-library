import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import {
  catalogSchema,
  definitionSchema,
  shapeToZod,
  shapeToJsonSchema,
  hostAllowed,
  type Catalog,
} from "../schema.ts";
import { lintActionSource } from "../lint.ts";
import { SAMPLE_CREDENTIALS } from "./samples.ts";

export async function loadCatalog(): Promise<Catalog> {
  const catalog: Catalog = {};
  for (const dir of (await readdir("actions", { withFileTypes: true })).filter(
    (d) => d.isDirectory(),
  )) {
    const raw = JSON.parse(
      await readFile(`actions/${dir.name}/action.json`, "utf8"),
    );
    const definition = definitionSchema.parse(raw);
    assert.equal(definition.id, dir.name);
    catalog[definition.id] = definition;
  }
  return catalogSchema.parse(catalog);
}

test("every action validates, matches its directory and passes the linter", async () => {
  const catalog = await loadCatalog();
  assert.ok("export" in catalog);
  for (const definition of Object.values(catalog)) {
    if (definition.kind !== "use") continue;
    assert.deepEqual(
      lintActionSource(
        await readFile(`actions/${definition.id}/action.ts`, "utf8"),
      ),
      [],
    );
    assert.notEqual(definition.operation, "get");
    // Every action ships a sample credential for the test harness.
    assert.ok(
      definition.id in SAMPLE_CREDENTIALS,
      `${definition.id} needs a SAMPLE_CREDENTIALS entry`,
    );
    assert.match(
      SAMPLE_CREDENTIALS[definition.id],
      new RegExp(definition.credentialPattern),
    );
  }
});
test("the static linter rejects direct network, code and runtime access", () => {
  const ok = `import { defineAction } from "../../lib.ts";\nexport default defineAction(async ({ fetchJson }) => fetchJson("https://a.example/x"));\n`;
  assert.deepEqual(lintActionSource(ok), []);
  const bad: [string, RegExp][] = [
    [`fetch("https://evil.test")`, /direct fetch/],
    [`import { z } from "zod";`, /may only import/],
    [`import "../../lib.ts";`, /side-effect imports/],
    [`Lit.Actions.getLitActionPrivateKey()`, /runtime global/],
    [`globalThis.fetch`, /runtime global/],
    [`eval("1")`, /dynamic code/],
    [`await import("x")`, /dynamic import/],
    [`setTimeout(() => {}, 1)`, /timers/],
    [`crypto.subtle.digest`, /crypto/],
    [`new WebSocket("wss://x")`, /browser network API/],
  ];
  for (const [snippet, why] of bad) {
    const problems = lintActionSource(ok + "\n" + snippet + "\n");
    assert.ok(
      problems.some((p) => why.test(p)),
      `${snippet}: ${problems}`,
    );
  }
  assert.deepEqual(lintActionSource(ok + "// never call fetch( here\n"), []);
});
test("shapes convert to strict validators and closed JSON Schema", async () => {
  const catalog = await loadCatalog();
  const shape = (catalog.openai_chat as any).input;
  const v = shapeToZod(shape);
  assert.ok(
    v.safeParse({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: "hi" }],
    }).success,
  );
  assert.ok(!v.safeParse({ model: "gpt-4o-mini" }).success);
  assert.ok(
    !v.safeParse({ model: "gpt-4o-mini", messages: [], extra: 1 }).success,
  );
  const js = shapeToJsonSchema(shape) as any;
  assert.equal(js.additionalProperties, false);
  assert.equal(js.properties.messages.items.additionalProperties, false);
});
test("manifest rejections: bad host, float input, get operation, unknown field", () => {
  const base = JSON.parse(
    '{"v":1,"id":"demo_action","kind":"use","name":"Demo","description":"Demo action.","category":"other","author":"t","license":"MIT","operation":"demo.run","credentialPattern":"^x+$","allowedHosts":["api.example.com"],"input":null,"output":{"type":"object","properties":{"ok":{"type":"boolean"}},"required":["ok"]},"limits":{"timeoutMs":5000,"maxResponseBytes":4096,"maxRequests":1},"ui":{"label":"Demo","hint":"Demo.","placeholder":"DEMO_KEY"},"tier":"community","deprecated":false}',
  );
  assert.ok(definitionSchema.safeParse(base).success);
  for (const mutate of [
    (d: any) => (d.allowedHosts = ["https://api.example.com"]),
    (d: any) => (d.allowedHosts = ["*.com"]),
    (d: any) => (d.allowedHosts = ["a.*.example.com"]),
    (d: any) => (d.allowedHosts = ["*.*.example.com"]),
    (d: any) => (d.allowedHosts = ["**.example.com"]),
    (d: any) => (d.allowedHosts = ["*example.com"]),
    (d: any) =>
      (d.input = {
        type: "object",
        properties: { amount: { type: "number" } },
      }),
    (d: any) => (d.operation = "get"),
    (d: any) => (d.extra = true),
    (d: any) => (d.output = { type: "string" }),
    (d: any) => (d.id = "Demo"),
  ]) {
    const d = structuredClone(base);
    mutate(d);
    assert.ok(!definitionSchema.safeParse(d).success);
  }
});
test("wildcard hosts stand for exactly one label under the provider's domain", () => {
  const base = JSON.parse(
    '{"v":1,"id":"demo_action","kind":"use","name":"Demo","description":"Demo action.","category":"other","author":"t","license":"MIT","operation":"demo.run","credentialPattern":"^x+$","allowedHosts":["*.example.com"],"input":null,"output":{"type":"object","properties":{"ok":{"type":"boolean"}},"required":["ok"]},"limits":{"timeoutMs":5000,"maxResponseBytes":4096,"maxRequests":1},"ui":{"label":"Demo","hint":"Demo.","placeholder":"DEMO_KEY"},"tier":"community","deprecated":false}',
  );
  assert.ok(definitionSchema.safeParse(base).success);
  const hosts = ["api.exact.test", "*.example.com"];
  for (const ok of ["api.exact.test", "tenant.example.com", "a-1.example.com"])
    assert.ok(hostAllowed(hosts, ok), ok);
  for (const bad of [
    "example.com",
    ".example.com",
    "a.b.example.com",
    "tenant.example.com.evil.test",
    "-.example.com",
    "sub.api.exact.test",
    "API.exact.test",
  ])
    assert.ok(!hostAllowed(hosts, bad), bad);
});
