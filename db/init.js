// Creates tables on first run (CREATE TABLE IF NOT EXISTS is safe to run
// every time) and seeds an initial admin account plus a starter product
// catalog so the site isn't empty the first time it goes live.
//
// This runs lazily on the first request after a cold start (see the
// ensureInit() middleware in app.js) rather than at module load time,
// since serverless functions shouldn't do slow work just importing a file.

const bcrypt = require("bcryptjs");
const pool = require("./database");

async function migrate() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      phone TEXT,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'customer', -- 'customer' | 'admin'
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      name_en TEXT,
      price NUMERIC(10,2) NOT NULL,
      old_price NUMERIC(10,2),
      discount_pct INTEGER,
      section TEXT NOT NULL DEFAULT 'deals', -- 'deals' | 'new'
      icon TEXT NOT NULL DEFAULT 'phone',
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      customer_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      address TEXT NOT NULL,
      total NUMERIC(10,2) NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending', -- pending | confirmed | delivered | cancelled
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id SERIAL PRIMARY KEY,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_id INTEGER REFERENCES products(id),
      name TEXT NOT NULL,
      price NUMERIC(10,2) NOT NULL,
      qty INTEGER NOT NULL
    );
  `);
}

async function seedAdmin() {
  const email = (process.env.ADMIN_EMAIL || "admin@goldenmobile.com").toLowerCase().trim();
  const password = process.env.ADMIN_PASSWORD || "change-this-password";

  const existing = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
  if (existing.rowCount > 0) return;

  const hash = bcrypt.hashSync(password, 10);
  await pool.query(
    `INSERT INTO users (name, email, phone, password_hash, role) VALUES ($1, $2, $3, $4, 'admin')`,
    ["Admin", email, "", hash]
  );

  console.log(`Seeded admin account: ${email} (change the password after first login)`);
}

async function seedProducts() {
  const count = await pool.query("SELECT COUNT(*) AS c FROM products");
  if (Number(count.rows[0].c) > 0) return;

  const seed = [
    ["Apple AirPods Pro 2", "Apple AirPods Pro 2", 154, 199, 23, "deals", "headphones"],
    ["Samsung S23 Ultra", "Samsung S23 Ultra", 594, 699, 15, "deals", "phone"],
    ["Huawei Watch GT 3", "Huawei Watch GT 3", 103, 129, 20, "deals", "watch"],
    ["Anker Power Bank 20000mAh", "Anker Power Bank 20000mAh", 41, 49, 17, "deals", "battery"],
    ["iPhone 15 Pro Max", "iPhone 15 Pro Max", 899, null, null, "new", "phone"],
    ["Samsung Note Ultra", "Samsung Note Ultra", 760, null, null, "new", "phone"],
    ["سماعات رأس لاسلكية", "Wireless Headphones", 65, null, null, "new", "headphones"],
    ["ساعة ذكية رياضية", "Sport Smartwatch", 98, null, null, "new", "watch"],
  ];

  for (const row of seed) {
    await pool.query(
      `INSERT INTO products (name, name_en, price, old_price, discount_pct, section, icon)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      row
    );
  }

  console.log(`Seeded ${seed.length} starter products`);
}

let initPromise = null;

// Safe to call on every request — only does real work once per warm
// serverless instance (and once overall, thanks to the IF NOT EXISTS /
// existence checks above).
function init() {
  if (!initPromise) {
    initPromise = (async () => {
      await migrate();
      await seedAdmin();
      await seedProducts();
    })().catch((err) => {
      initPromise = null; // allow retrying on the next request if this failed
      throw err;
    });
  }
  return initPromise;
}

module.exports = { init };
