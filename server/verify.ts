const MCP_BASE = "https://quantish-sdk-production.up.railway.app";

interface WalletStatusResponse {
  exists: boolean;
  data?: {
    safeAddress?: string;
    status?: string;
  };
}

export async function verifyWallet(
  externalId: string,
  walletAddress: string
): Promise<{ valid: boolean; error?: string }> {
  try {
    const res = await fetch(
      `${MCP_BASE}/api/wallet/status?externalId=${encodeURIComponent(externalId)}`
    );

    if (!res.ok) {
      return { valid: false, error: "Could not verify wallet. MCP endpoint returned " + res.status };
    }

    const data: WalletStatusResponse = await res.json();

    if (!data.exists) {
      return { valid: false, error: "No wallet found for this externalId. Create one via Polymarket MCP first." };
    }

    if (!data.data?.safeAddress) {
      return { valid: false, error: "Wallet exists but has no Safe address deployed yet." };
    }

    if (data.data.safeAddress.toLowerCase() !== walletAddress.toLowerCase()) {
      return {
        valid: false,
        error: "Wallet address does not match the Safe deployed for this externalId.",
      };
    }

    if (data.data.status !== "READY") {
      return { valid: false, error: `Wallet status is "${data.data.status}", must be "READY".` };
    }

    return { valid: true };
  } catch (err) {
    return { valid: false, error: "Wallet verification request failed: " + (err as Error).message };
  }
}
