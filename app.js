require("dotenv").config();

const path = require("path");
const express = require("express");
const cookieParser = require("cookie-parser");
const helmet = require("helmet");

if (!process.env.JWT_SECRET || process.env.JWT_SECRET === "change-this-to-a-long-random-string") {
  console.warn(
    "\n⚠️  WARNING: JWT_SECRET is missing or still the example value.\n" +
      "   Set a real random JWT_SECRET in your .env (local) or in your\n" +
      "   Vercel project's Environment Variables before going live.\n"
  );
}

const { init } = require("./db/init");
const pool = require("./db/database");
const { attachUser } = require("./middleware/auth");

const app = express();

app.use(
  helmet({
    contentSecurityPolicy: false, // the storefront needs Google Fonts; keep this simple for a small shop
  })
);
app.use(express.json());
app.use(cookieParser());
app.use(attachUser);

// Makes sure the database tables exist (and are seeded) before handling
// any request. Cheap after the first call on a warm serverless instance —
// see the caching in db/init.js.
app.use(async (req, res, next) => {
  try {
    await init();
    next();
  } catch (err) {
    console.error("Database init failed:", err);
    // TEMPORARY while setting up: show the real error + which env var was
    // used, so you can see exactly what's wrong instead of a generic
    // message. Once things work, you can remove `detail` and `envKeyUsed`
    // below so real errors aren't exposed to visitors.
    res.status(500).json({
      error: "Database is not reachable.",
      detail: err.message,
      envKeyUsed: pool.envKeyUsed,
    });
  }
});

app.use("/api/auth", require("./routes/auth"));
app.use("/api/products", require("./routes/products"));
app.use("/api/orders", require("./routes/orders"));

app.get("/api/config", (req, res) => {
  res.json({ shopWhatsapp: process.env.SHOP_WHATSAPP || "" });
});

// Serve the storefront and admin dashboard.
app.use(express.static(path.join(__dirname, "public")));

// Basic error handler so a thrown error returns JSON instead of crashing.
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Something went wrong on our side" });
});

module.exports = app;
