import { EXPERTS, getPrompt } from "../config/experts.js";
import crypto from "crypto";
import { readFileSync } from "fs";

const SESSION_SECRET = "sa96EOm/k+FdOKB3eMf8ZqF1L9KAlJW9XfZM5gC2JrF+kt5DQySjbtRlivxF/OG+JJA0GapuDBqxbc/YtSe7Fg==";
const BASE = "https://claudiabot-production.up.railway.app";

function makeToken(userId: string) {
  const ts = Date.now().toString();
  const hmac = crypto.createHmac("sha256", SESSION_SECRET).update(`${userId}:${ts}`).digest("hex").substring(0, 32);
  return { token: hmac, timestamp: ts };
}

async function main() {
  const stateFile = JSON.parse(readFileSync("config/experts-state.json", "utf8"));

  for (const expert of EXPERTS) {
    const state = stateFile.find((s: any) => s.id === expert.id);
    if (!state?.automationId) {
      console.log(`SKIP ${expert.name}: no automation ID`);
      continue;
    }

    const prompt = getPrompt(expert);
    const { token, timestamp } = makeToken(expert.id);

    const res = await fetch(`${BASE}/internal/automations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "update",
        telegramId: expert.id,
        automationId: state.automationId,
        prompt,
        token,
        timestamp,
      }),
    });
    const data = await res.json();
    console.log(`${expert.name}: ${res.status} ${data.success ? "OK" : JSON.stringify(data).substring(0, 100)}`);
  }
  console.log("\nAll prompts updated!");
}

main();
