// Local development entry point: `npm start` runs this.
// (Vercel does not use this file — see api/index.js — but it's the same
// Express app either way, so what works here works there.)

const app = require("./app");

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Golden Mobile server running on http://localhost:${PORT}`);
});
