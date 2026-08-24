/**
 * Reports which Supabase auth providers are live for this project.
 *
 * Run after toggling anything in the dashboard:  npm run check:auth
 *
 * Reads .env.local directly rather than relying on the shell, and only ever
 * prints the project ref — never the key.
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
  console.error("Missing credentials in .env.local. Copy .env.example first.");
  process.exit(1);
}

const ref = url.replace(/^https:\/\//, "").replace(/\.supabase\.co\/?$/, "");
console.log(`Project: ${ref}\n`);

let settings;
try {
  const response = await fetch(`${url}/auth/v1/settings`, {
    headers: { apikey: key },
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) {
    console.error(`Supabase returned HTTP ${response.status}.`);
    process.exit(1);
  }
  settings = await response.json();
} catch (error) {
  console.error(`Could not reach the project: ${error.message}`);
  process.exit(1);
}

const checks = [
  {
    label: "Phone (SMS OTP)",
    ok: settings.external.phone,
    fix: `Authentication > Sign In / Providers > Phone — enable it, then add a Test OTP number.\n    https://supabase.com/dashboard/project/${ref}/auth/providers`,
  },
  {
    label: "Google",
    ok: settings.external.google,
    fix: `Authentication > Sign In / Providers > Google — enable it and paste the client ID + secret.\n    https://supabase.com/dashboard/project/${ref}/auth/providers`,
  },
];

let allReady = true;
for (const { label, ok, fix } of checks) {
  console.log(`${ok ? "READY  " : "MISSING"}  ${label}`);
  if (!ok) {
    allReady = false;
    console.log(`    ${fix}\n`);
  }
}

if (allReady) {
  console.log(
    `\nBoth providers are live. Remember http://localhost:3000/auth/callback must be in\nRedirect URLs: https://supabase.com/dashboard/project/${ref}/auth/url-configuration`
  );
} else {
  console.log("Re-run this after saving in the dashboard.");
  process.exitCode = 1;
}
