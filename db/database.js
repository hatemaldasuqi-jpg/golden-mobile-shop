// Shared Postgres connection pool (works with Vercel Postgres, Neon,
// Supabase, Railway Postgres — anything that gives you a standard
// connection string).
//
// Unlike the old SQLite file, Postgres lives on a real database server,
// so it works correctly on serverless hosts like Vercel where the
// filesystem is not persistent between requests.

const { Pool } = require("pg");

// Different Postgres providers (and Vercel's own integrations) land their
// connection string under different env var names. Check them in order so
// this works regardless of which one you used, without you having to
// rename anything.
const ENV_CANDIDATES = [
  "DATABASE_URL",
  "POSTGRES_URL",
  "POSTGRES_PRISMA_URL",
  "POSTGRES_URL_NON_POOLING",
];

const foundKey = ENV_CANDIDATES.find((key) => process.env[key]);
const connectionString = foundKey ? process.env[foundKey] : undefined;

if (!connectionString) {
  console.warn(
    "\n⚠️  No Postgres connection string found. Checked: " +
      ENV_CANDIDATES.join(", ") +
      "\n   Set one of these in your .env (local) or your Vercel project's Environment Variables,\n" +
      "   then redeploy — Vercel does not pick up new/changed env vars on an existing deployment.\n"
  );
} else {
  console.log(`Using Postgres connection string from ${foundKey}`);
}

const pool = new Pool({
  connectionString,
  // Most hosted Postgres providers require SSL. Set PGSSL=false in .env
  // only if you're pointing at a local Postgres with no SSL configured.
  ssl: process.env.PGSSL === "false" ? false : { rejectUnauthorized: false },
  max: 5,
});

// Exposed so other modules (the debug error handler in app.js) can report
// which env var was actually used, without printing the secret itself.
pool.envKeyUsed = foundKey || null;

module.exports = pool;
