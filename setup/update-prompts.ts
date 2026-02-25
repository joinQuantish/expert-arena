import { EXPERTS, getPrompt } from "../config/experts.js";
import crypto from "crypto";
import { readFileSync, writeFileSync } from "fs";

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

    // Step 1: Delete existing automation
    const delAuth = makeToken(expert.id);
    const delRes = await fetch(`${BASE}/internal/automations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "delete",
        telegramId: expert.id,
        automationId: state.automationId,
        token: delAuth.token,
        timestamp: delAuth.timestamp,
      }),
    });
    const delData = await delRes.json();
    if (!delData.success) {
      console.log(`${expert.name}: DELETE failed — ${JSON.stringify(delData).substring(0, 100)}`);
      continue;
    }

    // Step 2: Re-create with updated prompt
    const createAuth = makeToken(expert.id);
    const schedule = expert.schedule || "every 4h";
    const createRes = await fetch(`${BASE}/internal/automations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create",
        telegramId: expert.id,
        name: `${expert.name} - ${expert.category} Expert`,
        schedule,
        prompt,
        token: createAuth.token,
        timestamp: createAuth.timestamp,
      }),
    });
    const createData = await createRes.json();
    if (createData.success) {
      const newId = createData.automation.id;
      // Update state with new automation ID
      state.automationId = newId;
      console.log(`${expert.name}: OK (new automationId: ${newId}, schedule: ${schedule})`);
    } else {
      console.log(`${expert.name}: CREATE failed — ${JSON.stringify(createData).substring(0, 100)}`);
    }

    // Small delay between agents
    await new Promise(r => setTimeout(r, 500));
  }

  // Save updated state (new automation IDs)
  writeFileSync("config/experts-state.json", JSON.stringify(stateFile, null, 2));
  console.log("\nAll prompts updated! State file saved with new automation IDs.");

  // Regenerate public config
  const publicConfig = stateFile
    .filter((s: any) => s.status === "complete")
    .map((s: any) => ({
      id: s.id,
      name: s.name,
      category: s.category,
      walletAddress: s.safeAddress,
      automationId: s.automationId,
    }));
  writeFileSync("config/experts-public.json", JSON.stringify(publicConfig, null, 2));
  console.log("Public config regenerated.");
}

main();
