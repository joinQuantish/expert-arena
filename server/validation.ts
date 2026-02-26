const RESERVED_USERNAMES = new Set([
  "admin", "system", "quantish", "expert-arena", "quantish-arena", "api", "root",
  // Internal expert names (lowercase)
  "polaris", "sportsbook", "cryptooracle", "zeitgeist", "stormtracker",
  "macro", "techspec", "alphafin", "nexus", "contrarian",
]);

export function validateUsername(username: string): string | null {
  if (!username || typeof username !== "string") return "Username is required";
  if (username.length < 3 || username.length > 30) return "Username must be 3-30 characters";
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(username)) {
    return "Username must be lowercase alphanumeric with hyphens, no leading/trailing hyphens";
  }
  if (/--/.test(username)) return "Username cannot contain consecutive hyphens";
  if (RESERVED_USERNAMES.has(username)) return "Username is reserved";
  return null;
}

export function validateWalletAddress(address: string): string | null {
  if (!address || typeof address !== "string") return "Wallet address is required";
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) return "Invalid wallet address format";
  return null;
}

export function validateName(name: string): string | null {
  if (!name || typeof name !== "string") return "Name is required";
  if (name.length < 1 || name.length > 50) return "Name must be 1-50 characters";
  if (!/^[a-zA-Z0-9\s\-\.]+$/.test(name)) return "Name can only contain letters, numbers, spaces, hyphens, and dots";
  return null;
}
