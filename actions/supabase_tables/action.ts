// The credential is a JSON config rather than a bare key: the owner writes the
// policy (which tables, which columns, read or insert, how many rows) next to the
// service key, and both are sealed and owner-signed together. Because the secret
// or service_role key bypasses row level security, that allowlist is the only
// thing standing between an agent and the whole database, so every identifier
// in the agent's request is checked against it before a URL is built.
//
// {
//   "ref": "abcdefghijklmnopqrst",
//   "key": "sb_secret_..." | "eyJ...",         // secret key or legacy service_role JWT
//   "schema": "public",                        // optional
//   "tables": {
//     "orders": {
//       "select": ["id", "status", "total_cents"],
//       "filter": ["id", "status"],             // optional, defaults to select
//       "insert": ["status"],                   // optional, defaults to none
//       "maxRows": 100                          // optional, 1..1000
//     }
//   }
// }
import { defineAction, requireThat } from "../../lib.ts";

type Filter = { column: string; op: string; value?: string; values?: string[] };
type Cell = { column: string; value: string };
type Input = {
  table: string;
  operation: "select" | "insert";
  columns?: string[];
  filters?: Filter[];
  order?: { column: string; direction?: "asc" | "desc" };
  limit?: number;
  rows?: { values: Cell[] }[];
};
type TableRule = {
  select: string[];
  filter: string[];
  insert: string[];
  maxRows: number;
};
type Config = {
  ref: string;
  key: string;
  legacyJwt: boolean;
  schema: string;
  tables: Map<string, TableRule>;
};

const IDENT = /^[a-z_][a-z0-9_]{0,62}$/;
const REF = /^[a-z]{20}$/;
const SECRET_KEY = /^sb_secret_[A-Za-z0-9_-]{10,200}$/;
const LEGACY_JWT = /^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const MAX_ROWS = 1000;
// Leaves headroom under the harness's 16 KiB serialized-output cap.
const OUTPUT_BUDGET = 14 * 1024;
const VALUE_OPS = new Set([
  "eq",
  "neq",
  "gt",
  "gte",
  "lt",
  "lte",
  "like",
  "ilike",
]);
const IS_LITERALS = new Set(["null", "true", "false"]);
// PostgREST reads these query parameters itself; a column with one of these
// names cannot be filtered on through the query string.
const RESERVED_PARAMS = new Set([
  "select",
  "order",
  "limit",
  "offset",
  "columns",
  "on_conflict",
]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function onlyKeys(value: Record<string, unknown>, allowed: string[]) {
  requireThat(Object.keys(value).every((k) => allowed.includes(k)));
}
function identList(value: unknown, max = 64): string[] {
  requireThat(
    Array.isArray(value) &&
      value.length <= max &&
      value.every((c) => typeof c === "string" && IDENT.test(c)) &&
      new Set(value).size === value.length,
  );
  return value as string[];
}
function parseConfig(credential: string): Config {
  const raw: unknown = JSON.parse(credential);
  requireThat(isPlainObject(raw));
  onlyKeys(raw, ["ref", "key", "schema", "tables"]);
  requireThat(typeof raw.ref === "string" && REF.test(raw.ref));
  requireThat(typeof raw.key === "string");
  const legacyJwt = LEGACY_JWT.test(raw.key);
  requireThat(legacyJwt || SECRET_KEY.test(raw.key));
  const schema = raw.schema ?? "public";
  requireThat(typeof schema === "string" && IDENT.test(schema));
  requireThat(isPlainObject(raw.tables));
  const names = Object.keys(raw.tables);
  requireThat(names.length >= 1 && names.length <= 64);
  const tables = new Map<string, TableRule>();
  for (const name of names) {
    requireThat(IDENT.test(name));
    const rule = raw.tables[name];
    requireThat(isPlainObject(rule));
    onlyKeys(rule, ["select", "filter", "insert", "maxRows"]);
    const select = identList(rule.select);
    requireThat(select.length >= 1);
    const filter = rule.filter === undefined ? select : identList(rule.filter);
    const insert = rule.insert === undefined ? [] : identList(rule.insert);
    const maxRows = rule.maxRows ?? 100;
    requireThat(
      Number.isInteger(maxRows) &&
        (maxRows as number) >= 1 &&
        (maxRows as number) <= MAX_ROWS,
    );
    tables.set(name, { select, filter, insert, maxRows: maxRows as number });
  }
  return { ref: raw.ref, key: raw.key, legacyJwt, schema, tables };
}
/** Quotes one literal for PostgREST's `in.(...)` list. */
function quoteListItem(value: string) {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}
function filterParam(rule: TableRule, f: Filter): [string, string] {
  requireThat(rule.filter.includes(f.column) && !RESERVED_PARAMS.has(f.column));
  if (f.op === "in") {
    requireThat(
      f.value === undefined && Array.isArray(f.values) && f.values.length >= 1,
    );
    return [f.column, `in.(${f.values.map(quoteListItem).join(",")})`];
  }
  requireThat(f.values === undefined && typeof f.value === "string");
  if (f.op === "is") {
    requireThat(IS_LITERALS.has(f.value));
    return [f.column, `is.${f.value}`];
  }
  requireThat(VALUE_OPS.has(f.op));
  return [f.column, `${f.op}.${f.value}`];
}
/** Keeps only the allowlisted columns of one upstream row. */
function project(row: unknown, columns: string[]) {
  requireThat(isPlainObject(row));
  const out: Record<string, unknown> = {};
  for (const column of columns)
    if (Object.hasOwn(row, column)) out[column] = row[column];
  return JSON.stringify(out);
}

export default defineAction<Input>(async ({ credential, input, fetchJson }) => {
  const config = parseConfig(credential);
  const rule = config.tables.get(input.table);
  requireThat(rule !== undefined);
  const headers: Record<string, string> = {
    apikey: config.key,
    Accept: "application/json",
  };
  // Legacy service_role keys are JWTs and go on both headers; the newer
  // sb_secret_ keys are not JWTs and must be sent only as apikey.
  if (config.legacyJwt) headers.Authorization = `Bearer ${config.key}`;
  const base = `https://${config.ref}.supabase.co/rest/v1/${input.table}`;
  let upstream: unknown;
  let columns: string[];
  if (input.operation === "select") {
    requireThat(input.rows === undefined);
    columns = input.columns ?? rule.select;
    requireThat(
      columns.length >= 1 && columns.every((c) => rule.select.includes(c)),
    );
    const params = new URLSearchParams();
    params.set("select", columns.join(","));
    for (const f of input.filters ?? []) params.append(...filterParam(rule, f));
    if (input.order) {
      requireThat(rule.select.includes(input.order.column));
      params.set(
        "order",
        `${input.order.column}.${input.order.direction ?? "asc"}`,
      );
    }
    params.set(
      "limit",
      String(Math.min(input.limit ?? rule.maxRows, rule.maxRows)),
    );
    headers["Accept-Profile"] = config.schema;
    upstream = await fetchJson(`${base}?${params}`, { method: "GET", headers });
  } else {
    requireThat(
      input.columns === undefined &&
        input.filters === undefined &&
        input.order === undefined &&
        input.limit === undefined &&
        rule.insert.length >= 1 &&
        Array.isArray(input.rows) &&
        input.rows.length >= 1,
    );
    columns = rule.select;
    const body = input.rows.map(({ values }) => {
      requireThat(values.length >= 1);
      const row: Record<string, unknown> = {};
      for (const cell of values) {
        requireThat(
          rule.insert.includes(cell.column) && !Object.hasOwn(row, cell.column),
        );
        const value: unknown = JSON.parse(cell.value);
        requireThat(
          value === null ||
            typeof value === "string" ||
            typeof value === "boolean" ||
            (typeof value === "number" && Number.isFinite(value)),
        );
        row[cell.column] = value;
      }
      return row;
    });
    headers["Content-Type"] = "application/json";
    headers["Content-Profile"] = config.schema;
    headers.Prefer = "return=representation";
    upstream = await fetchJson(base, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
  }
  requireThat(Array.isArray(upstream) && upstream.length <= rule.maxRows);
  const rows: string[] = [];
  const encoder = new TextEncoder();
  let bytes = 0;
  let truncated = false;
  for (const row of upstream) {
    const text = project(row, columns);
    // JSON.stringify escapes the string again when the harness serializes the
    // result; measure that encoded form so the budget matches what ships.
    const size = encoder.encode(JSON.stringify(text)).byteLength + 1;
    if (bytes + size > OUTPUT_BUDGET) {
      truncated = true;
      break;
    }
    bytes += size;
    rows.push(text);
  }
  return { rows, count: upstream.length, truncated };
});
