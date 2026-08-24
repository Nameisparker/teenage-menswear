/**
 * Reports whether the schema is applied and readable.
 *
 *   npm run check:db
 *
 * Uses the anon key, so it verifies what the browser will actually see —
 * including that RLS grants public read on the catalog and denies it on
 * customer data.
 */
import { readFile } from "node:fs/promises";

function parseEnv(text) {
  const env = {};
  for (const line of text.split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (match) env[match[1]] = match[2].trim();
  }
  return env;
}

const env = parseEnv(await readFile(".env.local", "utf8").catch(() => ""));
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error("Missing credentials in .env.local.");
  process.exit(1);
}

async function query(path) {
  const response = await fetch(`${url}/rest/v1/${path}`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Prefer: "count=exact",
    },
    signal: AbortSignal.timeout(20000),
  });
  const range = response.headers.get("content-range");
  return {
    status: response.status,
    total: range ? Number(range.split("/")[1]) : null,
    body: await response.json().catch(() => null),
  };
}

// Public catalog: must be readable by anon, with the expected row counts.
const publicTables = [
  ["categories", 4],
  ["products", 40],
  ["product_variants", 169],
  ["store_settings", 1],
];

// Customer data: anon must get zero rows. A 200 with 0 rows is RLS working —
// PostgREST filters rather than erroring.
const privateTables = ["profiles", "addresses", "cart_items", "orders", "order_items"];

let failed = false;
console.log("Public catalog (anon must be able to read):");
for (const [table, expected] of publicTables) {
  const r = await query(`${table}?select=*&limit=1`);
  if (r.status === 404) {
    failed = true;
    console.log(`  MISSING  ${table.padEnd(18)} table not found — schema not applied`);
  } else if (r.status >= 400) {
    failed = true;
    console.log(`  ERROR    ${table.padEnd(18)} ${r.status} ${JSON.stringify(r.body)}`);
  } else if (r.total !== expected) {
    failed = true;
    console.log(`  COUNT    ${table.padEnd(18)} ${r.total} rows, expected ${expected} — seed incomplete?`);
  } else {
    console.log(`  OK       ${table.padEnd(18)} ${r.total} rows`);
  }
}

console.log("\nCustomer data (anon must see nothing):");
for (const table of privateTables) {
  const r = await query(`${table}?select=*&limit=1`);
  if (r.status === 404) {
    failed = true;
    console.log(`  MISSING  ${table.padEnd(18)} table not found`);
  } else if (r.status === 200 && Array.isArray(r.body) && r.body.length === 0) {
    console.log(`  OK       ${table.padEnd(18)} blocked by RLS`);
  } else if (r.status >= 400) {
    console.log(`  OK       ${table.padEnd(18)} blocked (${r.status})`);
  } else {
    failed = true;
    console.log(`  LEAK     ${table.padEnd(18)} anon read ${r.body?.length} row(s) — check RLS`);
  }
}

// The nested select the app relies on.
const joined = await query(
  "products?select=slug,name,price,categories(slug,label),product_variants(size,sort_order)&limit=1"
);
console.log("\nNested select used by src/lib/catalog.ts:");
if (joined.status >= 400) {
  failed = true;
  console.log(`  FAIL  ${joined.status} ${JSON.stringify(joined.body)}`);
} else {
  const row = joined.body?.[0];
  const ok = row?.categories?.slug && Array.isArray(row?.product_variants);
  if (!ok) {
    failed = true;
    console.log(`  FAIL  joins did not resolve: ${JSON.stringify(row)}`);
  } else {
    console.log(
      `  OK    ${row.slug} -> category "${row.categories.slug}", ${row.product_variants.length} sizes`
    );
  }
}

if (failed) {
  console.log("\nApply supabase/migrations/ in filename order, one file at a time.");
  process.exitCode = 1;
} else {
  console.log("\nSchema is applied and readable. Catalog is ready to go dynamic.");
}
