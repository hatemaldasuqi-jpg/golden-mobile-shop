// Vercel serverless entry point. Vercel's Node.js runtime detects an
// exported Express app and wraps it as a serverless function — every
// request (API routes and the static storefront/admin pages alike) is
// routed here by vercel.json.

module.exports = require("../app");
