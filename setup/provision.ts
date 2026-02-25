import { createHmac } from "crypto";
import { EXPERTS, getPrompt } from "../config/experts.js";
import { readFileSync, writeFileSync, existsSync } from "fs";

const POLYMARKET_MCP = "https://quantish-sdk-production.up.railway.app";
const CLAUDIABOT = "https://claudiabot-production.up.railway.app";
const SESSION_SECRET = process.env.SESSION_SECRET;

if (!SESSION_SECRET) {
  console.error("SESSION_SECRET env var required");
  process.exit(1);
}

function hmacToken(userId: string): { token: string; timestamp: number } {
  const timestamp = Date.now();
  const hmac = createHmac("sha256", SESSION_SECRET!);
  hmac.update(`${userId}:${timestamp}`);
  return { token: hmac.digest("hex").substring(0, 32), timestamp };
}

async function mcpCall(
  tool: string,
  args: Record<string, unknown>,
  headers?: Record<string, string>
) {
  const res = await fetch(`${POLYMARKET_MCP}/mcp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...headers,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: `provision-${Date.now()}`,
      method: "tools/call",
      params: { name: tool, arguments: args },
    }),
  });

  const data = await res.json();
  if (data.error) throw new Error(`MCP error: ${JSON.stringify(data.error)}`);

  const text = data.result?.content?.[0]?.text;
  if (!text) throw new Error(`No content in response: ${JSON.stringify(data)}`);
  return JSON.parse(text);
}

interface ExpertState {
  id: string;
  name: string;
  category: string;
  apiKey: string;
  apiSecret: string;
  eoaAddress: string;
  safeAddress: string;
  automationId?: string;
  status: string;
}

async function provisionExpert(
  expert: (typeof EXPERTS)[0],
  state: ExpertState[]
): Promise<ExpertState> {
  const existing = state.find((s) => s.id === expert.id);
  if (existing && existing.status === "complete") {
    console.log(`[${expert.id}] Already provisioned, skipping`);
    return existing;
  }

  console.log(`\n=== Provisioning ${expert.name} (${expert.id}) ===`);

  // Step 1: Create wallet via REST API (simpler than MCP)
  let apiKey: string, apiSecret: string, eoaAddress: string, safeAddress: string;

  if (existing?.apiKey) {
    console.log(`[${expert.id}] Wallet already created, reusing credentials`);
    apiKey = existing.apiKey;
    apiSecret = existing.apiSecret;
    eoaAddress = existing.eoaAddress;
    safeAddress = existing.safeAddress;
  } else {
    console.log(`[${expert.id}] Creating Polymarket wallet...`);
    const keyResult = await mcpCall("request_api_key", {
      externalId: expert.id,
    });

    if (keyResult.existingAccount) {
      console.log(`[${expert.id}] Account already exists. Need existing credentials.`);
      throw new Error(
        `Account ${expert.id} already exists. Check if credentials were saved previously.`
      );
    }

    apiKey = keyResult.apiKey;
    apiSecret = keyResult.apiSecret;
    eoaAddress = keyResult.eoaAddress;

    console.log(`[${expert.id}] API Key: ${apiKey.substring(0, 8)}...`);
    console.log(`[${expert.id}] EOA: ${eoaAddress}`);

    // Setup Safe wallet
    console.log(`[${expert.id}] Deploying Safe wallet...`);
    const walletResult = await mcpCall("setup_wallet", {}, {
      "x-api-key": apiKey,
      "x-api-secret": apiSecret,
    });
    safeAddress = walletResult.safeAddress;
    console.log(`[${expert.id}] Safe: ${safeAddress}`);
  }

  // Step 2: Store credentials in claudiabot
  if (!existing?.automationId) {
    console.log(`[${expert.id}] Storing credentials in claudiabot...`);
    const { token, timestamp } = hmacToken(expert.id);
    const credRes = await fetch(`${CLAUDIABOT}/credentials/trading`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "save",
        telegramId: expert.id,
        token,
        timestamp,
        credentials: {
          polymarket: {
            apiKey,
            apiSecret,
            address: safeAddress,
          },
        },
      }),
    });

    const credResult = await credRes.json();
    if (!credResult.success) {
      throw new Error(
        `Failed to store credentials: ${JSON.stringify(credResult)}`
      );
    }
    console.log(`[${expert.id}] Credentials stored: ${credResult.saved}`);

    // Step 3: Create automation
    console.log(`[${expert.id}] Creating automation...`);
    const prompt = getPrompt(expert);
    const auth = hmacToken(expert.id);
    const autoRes = await fetch(`${CLAUDIABOT}/internal/automations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create",
        telegramId: expert.id,
        name: `${expert.name} - ${expert.category} Expert`,
        schedule: expert.schedule || "every 4h",
        prompt,
        token: auth.token,
        timestamp: auth.timestamp,
      }),
    });

    const autoResult = await autoRes.json();
    if (!autoResult.success) {
      throw new Error(
        `Failed to create automation: ${JSON.stringify(autoResult)}`
      );
    }
    console.log(
      `[${expert.id}] Automation created: ${autoResult.automation.id}`
    );

    const result: ExpertState = {
      id: expert.id,
      name: expert.name,
      category: expert.category,
      apiKey,
      apiSecret,
      eoaAddress,
      safeAddress,
      automationId: autoResult.automation.id,
      status: "complete",
    };
    return result;
  }

  return existing!;
}

async function main() {
  const stateFile = new URL("../config/experts-state.json", import.meta.url);
  let state: ExpertState[] = [];
  try {
    if (existsSync(stateFile)) {
      state = JSON.parse(readFileSync(stateFile, "utf-8"));
    }
  } catch {}

  const dryRun = process.argv.includes("--dry-run");
  const singleId = process.argv.find((a) => a.startsWith("--expert="))?.split("=")[1];
  const noStagger = process.argv.includes("--no-stagger");

  const targets = singleId
    ? EXPERTS.filter((e) => e.id === singleId)
    : EXPERTS;

  if (targets.length === 0) {
    console.error(`Expert ${singleId} not found`);
    process.exit(1);
  }

  console.log(`Provisioning ${targets.length} experts${dryRun ? " (DRY RUN)" : ""}\n`);

  if (dryRun) {
    for (const expert of targets) {
      console.log(`Would provision: ${expert.name} (${expert.id})`);
      console.log(`  Category: ${expert.category}`);
      console.log(`  Schedule offset: ${expert.scheduleOffsetMin}min`);
      console.log(`  Prompt length: ${getPrompt(expert).length} chars`);
      console.log(`  Schedule: ${expert.schedule || "every 4h"}`);
      console.log(`  Mode: ${expert.mode || "directional"}`);
    }
    return;
  }

  for (let i = 0; i < targets.length; i++) {
    const expert = targets[i];

    try {
      const result = await provisionExpert(expert, state);

      // Update state
      const idx = state.findIndex((s) => s.id === expert.id);
      if (idx >= 0) state[idx] = result;
      else state.push(result);

      // Save state after each expert (resume-safe)
      writeFileSync(stateFile.pathname, JSON.stringify(state, null, 2));

      // Stagger: wait 24 minutes between experts
      if (!noStagger && i < targets.length - 1) {
        console.log(`\nWaiting 24 minutes before next expert...`);
        await new Promise((r) => setTimeout(r, 24 * 60 * 1000));
      }
    } catch (err) {
      console.error(`\n!!! FAILED: ${expert.id} !!!`);
      console.error(err);
      // Save state and continue
      writeFileSync(stateFile.pathname, JSON.stringify(state, null, 2));
    }
  }

  // Generate public config (no secrets)
  const publicConfig = state
    .filter((s) => s.status === "complete")
    .map((s) => ({
      id: s.id,
      name: s.name,
      category: s.category,
      walletAddress: s.safeAddress,
      automationId: s.automationId,
    }));

  writeFileSync(
    new URL("../config/experts-public.json", import.meta.url).pathname,
    JSON.stringify(publicConfig, null, 2)
  );

  console.log(`\n=== PROVISIONING COMPLETE ===`);
  console.log(`${state.filter((s) => s.status === "complete").length}/${targets.length} experts provisioned`);
  console.log(`State saved to config/experts-state.json`);
  console.log(`Public config saved to config/experts-public.json`);
  console.log(`\nNext steps:`);
  console.log(`1. Fund each Safe wallet with $20 USDC on Polygon`);
  console.log(`2. Deploy dashboard to Railway`);
  console.log(`3. Monitor claudiabot logs for first automation runs`);
}

main().catch(console.error);
