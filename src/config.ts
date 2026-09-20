import * as dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

export interface AppConfig {
  feedOwnerPrivateKey: string;
  beeApiUrl: string;
  postageBatchId?: string;
}

/**
 * Validates and retrieves the required environment configuration.
 * Throws a professional, clear error message if the environment is misconfigured.
 */
export function getAppConfig(): AppConfig {
  const privateKey = process.env.PRIVATE_KEY;

  // Strict validation to prevent mock usage or missing identifiers
  if (!privateKey || privateKey.includes("YOUR_64_CHAR")) {
    console.error("\n[Configuration Error]");
    console.error(
      "To cryptographically sign your Single Owner Chunk (feed) on Swarm,",
    );
    console.error("you must supply a valid 64-character Ethereum private key.");
    console.error("Please configure PRIVATE_KEY in your .env file.\n");
    process.exit(1);
  }

  return {
    feedOwnerPrivateKey: privateKey,
    beeApiUrl: process.env.BEE_URL || "http://localhost:1633",
    postageBatchId: process.env.STAMP_ID || undefined,
  };
}
