const express = require("express");
const pool = require("../db/database");
const { requireAuth, requireAdmin } = require("../middleware/auth");

const router = express.Router();

function numifyOrder(o) {
  return { ...o, total: Number(o.total) };
}
function numifyItem(it) {
  return { ...it, price: Number(it.price) };
}

async function loadItems(orderId) {
  const result = await pool.query(
    "SELECT product_id, name, price, qty FROM order_items WHERE order_id = $1",
    [orderId]
  );
  return result.rows.map(numifyItem);
}

// Customer: place an order. Requires login so it shows up in their account.
// Prices are always re-read from the products table server-side — never
// trust a price the browser sends.
router.post("/", requireAuth, async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { items, name, phone, address } = req.body || {};
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Cart is empty" });
    }
    if (!name || !phone || !address) {
      return res.status(400).json({ error: "Name, phone and address are required" });
    }

    const resolved = [];
    let total = 0;
    for (const item of items) {
      const qty = Number(item.qty) || 0;
      if (qty <= 0) continue;
      const productResult = await client.query(
        "SELECT * FROM products WHERE id = $1 AND is_active = TRUE",
        [item.productId]
      );
      const product = productResult.rows[0];
      if (!product) {
        return res.status(400).json({ error: `Product ${item.productId} is not available` });
      }
      resolved.push({ product, qty });
      total += Number(product.price) * qty;
    }
    if (resolved.length === 0) return res.status(400).json({ error: "Cart is empty" });

    await client.query("BEGIN");
    const orderResult = await client.query(
      `INSERT INTO orders (user_id, customer_name, phone, address, total, status)
       VALUES ($1, $2, $3, $4, $5, 'pending') RETURNING *`,
      [req.user.id, String(name).trim(), String(phone).trim(), String(address).trim(), total]
    );
    const order = orderResult.rows[0];

    for (const { product, qty } of resolved) {
      await client.query(
        `INSERT INTO order_items (order_id, product_id, name, price, qty) VALUES ($1, $2, $3, $4, $5)`,
        [order.id, product.id, product.name, product.price, qty]
      );
    }
    await client.query("COMMIT");

    order.items = await loadItems(order.id);
    res.status(201).json({ order: numifyOrder(order) });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    next(err);
  } finally {
    client.release();
  }
});

// Customer: their own order history.
router.get("/mine", requireAuth, async (req, res, next) => {
  try {
    const result = await pool.query("SELECT * FROM orders WHERE user_id = $1 ORDER BY id DESC", [req.user.id]);
    const orders = result.rows.map(numifyOrder);
    for (const o of orders) o.items = await loadItems(o.id);
    res.json({ orders });
  } catch (err) {
    next(err);
  }
});

// Admin: every order, newest first.
router.get("/", requireAdmin, async (req, res, next) => {
  try {
    const result = await pool.query("SELECT * FROM orders ORDER BY id DESC");
    const orders = result.rows.map(numifyOrder);
    for (const o of orders) o.items = await loadItems(o.id);
    res.json({ orders });
  } catch (err) {
    next(err);
  }
});

// Admin: update an order's status.
router.put("/:id", requireAdmin, async (req, res, next) => {
  try {
    const { status } = req.body || {};
    const allowed = ["pending", "confirmed", "delivered", "cancelled"];
    if (!allowed.includes(status)) {
      return res.status(400).json({ error: `status must be one of ${allowed.join(", ")}` });
    }

    const result = await pool.query("UPDATE orders SET status = $1 WHERE id = $2 RETURNING *", [status, req.params.id]);
    const order = result.rows[0];
    if (!order) return res.status(404).json({ error: "Order not found" });

    order.items = await loadItems(order.id);
    res.json({ order: numifyOrder(order) });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
