const express = require("express");
const pool = require("../db/database");
const { requireAdmin } = require("../middleware/auth");

const router = express.Router();

function validSection(s) {
  return s === "deals" || s === "new";
}

// Postgres returns NUMERIC columns as strings (to avoid float rounding
// surprises) — convert the ones the frontend treats as numbers.
function numify(p) {
  if (!p) return p;
  return {
    ...p,
    price: p.price === null ? null : Number(p.price),
    old_price: p.old_price === null ? null : Number(p.old_price),
  };
}

// Public: anyone can see the active catalog.
router.get("/", async (req, res, next) => {
  try {
    const result = await pool.query("SELECT * FROM products WHERE is_active = TRUE ORDER BY id DESC");
    res.json({ products: result.rows.map(numify) });
  } catch (err) {
    next(err);
  }
});

// Admin: see everything including deactivated products.
router.get("/all", requireAdmin, async (req, res, next) => {
  try {
    const result = await pool.query("SELECT * FROM products ORDER BY id DESC");
    res.json({ products: result.rows.map(numify) });
  } catch (err) {
    next(err);
  }
});

router.post("/", requireAdmin, async (req, res, next) => {
  try {
    const { name, name_en, price, old_price, discount_pct, section, icon } = req.body || {};
    if (!name || typeof price !== "number" || price <= 0) {
      return res.status(400).json({ error: "name and a positive numeric price are required" });
    }
    if (section && !validSection(section)) {
      return res.status(400).json({ error: "section must be 'deals' or 'new'" });
    }

    const result = await pool.query(
      `INSERT INTO products (name, name_en, price, old_price, discount_pct, section, icon)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        String(name).trim(),
        name_en ? String(name_en).trim() : null,
        price,
        old_price || null,
        discount_pct || null,
        section || "deals",
        icon || "phone",
      ]
    );

    res.status(201).json({ product: numify(result.rows[0]) });
  } catch (err) {
    next(err);
  }
});

router.put("/:id", requireAdmin, async (req, res, next) => {
  try {
    const existingResult = await pool.query("SELECT * FROM products WHERE id = $1", [req.params.id]);
    const existing = existingResult.rows[0];
    if (!existing) return res.status(404).json({ error: "Product not found" });

    const { name, name_en, price, old_price, discount_pct, section, icon, is_active } = req.body || {};
    if (section && !validSection(section)) {
      return res.status(400).json({ error: "section must be 'deals' or 'new'" });
    }

    const result = await pool.query(
      `UPDATE products SET
         name = $1, name_en = $2, price = $3, old_price = $4, discount_pct = $5,
         section = $6, icon = $7, is_active = $8
       WHERE id = $9 RETURNING *`,
      [
        name !== undefined ? String(name).trim() : existing.name,
        name_en !== undefined ? name_en : existing.name_en,
        price !== undefined ? price : existing.price,
        old_price !== undefined ? old_price : existing.old_price,
        discount_pct !== undefined ? discount_pct : existing.discount_pct,
        section !== undefined ? section : existing.section,
        icon !== undefined ? icon : existing.icon,
        is_active !== undefined ? Boolean(is_active) : existing.is_active,
        req.params.id,
      ]
    );

    res.json({ product: numify(result.rows[0]) });
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", requireAdmin, async (req, res, next) => {
  try {
    const result = await pool.query("DELETE FROM products WHERE id = $1 RETURNING id", [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: "Product not found" });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
