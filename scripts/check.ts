// Validates the catalog without building anything: every actions/<id>/ has a valid
// action.json whose id matches the directory, action.ts passes the static linter,
// and ids/operations are unique. Runs in CI with no secrets.
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { catalogSchema, definitionSchema, type Catalog } from "../schema.ts";
import { lintActionSource } from "../lint.ts";

const root = path.resolve(import.meta.dirname, "..", "actions");
const problems: string[] = [];
const catalog: Catalog = {};
for (const entry of (await readdir(root, { withFileTypes: true })).sort(
  (a, b) => a.name.localeCompare(b.name),
)) {
  if (!entry.isDirectory()) continue;
  const dir = path.join(root, entry.name);
  let raw: unknown;
  try {
    raw = JSON.parse(await readFile(path.join(dir, "action.json"), "utf8"));
  } catch (error) {
    problems.push(`${entry.name}/action.json: ${(error as Error).message}`);
    continue;
  }
  const parsed = definitionSchema.safeParse(raw);
  if (!parsed.success) {
    for (const issue of parsed.error.issues)
      problems.push(
        `${entry.name}/action.json ${issue.path.join(".")}: ${issue.message}`,
      );
    continue;
  }
  const definition = parsed.data;
  if (definition.id !== entry.name)
    problems.push(
      `${entry.name}/action.json declares id ${definition.id}; directory and id must match`,
    );
  const hasCode = await stat(path.join(dir, "action.ts")).then(
    () => true,
    () => false,
  );
  if (definition.kind === "export" && hasCode)
    problems.push("export/ must not ship action.ts");
  if (definition.kind === "use") {
    if (!hasCode) problems.push(`${entry.name}/action.ts is missing`);
    else
      for (const problem of lintActionSource(
        await readFile(path.join(dir, "action.ts"), "utf8"),
      ))
        problems.push(`${entry.name}/action.ts: ${problem}`);
  }
  catalog[definition.id] = definition;
}
const whole = catalogSchema.safeParse(catalog);
if (!whole.success)
  for (const issue of whole.error.issues)
    problems.push(`catalog: ${issue.message}`);
if (problems.length) {
  console.error(problems.map((p) => `✗ ${p}`).join("\n"));
  process.exit(1);
}
console.log(
  `✓ ${Object.keys(catalog).length} actions valid: ${Object.keys(catalog).join(", ")}`,
);
