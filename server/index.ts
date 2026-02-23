import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { initDb } from "./db.js";
import { runSync, seedExperts } from "./sync.js";
import routes from "./routes.js";
import cron from "node-cron";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = parseInt(process.env.PORT || "3000");

app.use(express.json());
app.use(routes);

// Serve static frontend
// In Docker: server runs from dist/server/index.js, vite output is at client/dist/
// Resolve relative to project root (two levels up from dist/server/)
const clientDist = process.env.NODE_ENV === "production"
  ? path.resolve(__dirname, "../../client/dist")
  : path.resolve(__dirname, "../client/dist");
app.use(express.static(clientDist));
app.get("*", (_req, res) => {
  res.sendFile(path.join(clientDist, "index.html"));
});

async function start() {
  await initDb();
  await seedExperts();

  app.listen(PORT, () => {
    console.log(`[server] Expert Arena running on port ${PORT}`);
  });

  // Initial sync after 10s (let server start first)
  setTimeout(() => runSync(), 10_000);

  // Sync every 5 minutes
  cron.schedule("*/5 * * * *", () => runSync());

  // Cleanup old snapshots (keep 30 days) - daily at 4am UTC
  cron.schedule("0 4 * * *", async () => {
    const { default: pool } = await import("./db.js");
    await pool.query(
      "DELETE FROM snapshots WHERE timestamp < NOW() - INTERVAL '30 days'"
    );
    console.log("[cleanup] Old snapshots removed");
  });
}

start().catch(console.error);
