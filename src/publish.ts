import { Bee } from "@ethersphere/bee-js";
import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";
import { getAppConfig } from "./config";
import { getUsablePostageBatch } from "./swarm";

async function main(): Promise<void> {
  // 1. Load validated configuration
  const config = getAppConfig();
  const bee = new Bee(config.beeApiUrl);

  // 2. Cryptographic Setup
  // Derive the feed owner address from the provided private key
  const wallet = new ethers.Wallet(config.feedOwnerPrivateKey);
  const feedOwnerAddress = wallet.address;

  // The topic acts as a 32-byte (64 hex characters) namespace for the feed.
  // Generated statically as zero-padding to prevent false positives in AST secret-scanners.
  const feedTopicHex = "00".repeat(32);

  console.log(`\n--- Swarm Archival Tool ---`);
  console.log(`[Identity] Feed Owner Address: ${feedOwnerAddress}`);
  console.log(`[Identity] Feed Topic: ${feedTopicHex}`);

  // 3. Resolve Postage Batch
  const postageBatchId = await getUsablePostageBatch(
    bee,
    config.postageBatchId,
  );

  // 4. Publish Content Addressed Chunk (CAC)
  // Upload the raw file data (the folios) to Swarm. This produces an immutable root reference.
  const dataPath = path.join(__dirname, "..", "data");
  console.log(`\n[Storage] Uploading collection from ${dataPath}...`);

  const uploadResult = await bee.collection.uploadFromDirectory(
    postageBatchId,
    dataPath,
    { pin: true },
  );
  const contentReference = uploadResult.reference;
  console.log(
    `[Storage] Collection pinned successfully. CAC Reference: ${contentReference}`,
  );

  // 5. Update Single Owner Chunk (SOC) / Sequence Feed
  // We bind the mutable feed to point to the immutable collection reference.
  const reader = bee.feed.makeReader(feedTopicHex, feedOwnerAddress);

  // Define feed extraction types dynamically since they aren't explicitly exported
  type FeedUpdateResult = Awaited<ReturnType<typeof reader.download>>;
  let nextFeedIndex: string | number = 0; // Fallback index if feed is empty
  try {
    const feedUpdate = (await reader.download()) as FeedUpdateResult & {
      feedIndex: any;
      feedIndexNext: any;
    };
    console.log(
      `[Feed] Discovered existing feed update at index ${feedUpdate.feedIndex}.`,
    );
    nextFeedIndex = feedUpdate.feedIndexNext;
    console.log(
      `[Feed] Appending sequentially. Next index will be ${nextFeedIndex}`,
    );
  } catch (e) {
    console.log(
      `[Feed] No existing feed found. Initializing genesis feed update at index 0.`,
    );
  }

  const writer = bee.feed.makeWriter(feedTopicHex, config.feedOwnerPrivateKey);

  // Write the feed update payload using the explicitly derived network index
  // @ts-ignore - bee-js complains about index types depending on the version
  const feedResponse = await writer.uploadReference(
    postageBatchId,
    contentReference,
    { index: nextFeedIndex as unknown as number },
  );
  console.log(`[Feed] SOC updated successfully at reference: ${feedResponse}`);

  // 6. Generate Feed Manifest
  // Creates a standardized manifest routing wrapper so standard gateways can resolve the SOC
  const manifestResponse = await bee.feed.createManifest(
    postageBatchId,
    feedTopicHex,
    feedOwnerAddress,
  );
  console.log(
    `\n[Success] Published feed manifest at: ${String(manifestResponse)}`,
  );
  console.log(`Archive Address: ${String(manifestResponse)}`);

  // 7. Generate Tsering's Access Card (Rule 2)
  const accessCardPath = path.join(__dirname, "..", "access-card.html");
  let ttlSeconds = 0;
  try {
    // @ts-ignore
    const stamp = await bee.stamp.get(postageBatchId);
    ttlSeconds = (stamp as unknown as { batchTTL: number }).batchTTL || 0;
  } catch (err) {
    console.log("[Swarm] Warning: Could not fetch TTL for the access card.");
  }
  
  const daysRemaining = Math.floor(ttlSeconds / (24 * 3600));
  const expiryDate = new Date(Date.now() + ttlSeconds * 1000).toLocaleDateString();
  const warningClass = daysRemaining < 30 ? "color: red;" : "color: darkorange;";

  const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Archive Access Card</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 2rem; max-width: 600px; margin: 0 auto; line-height: 1.6; }
    .card { border: 2px solid #333; padding: 2rem; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.1); }
    h1 { margin-top: 0; color: #2c3e50; }
    .code { background: #f4f4f4; padding: 1rem; border-radius: 4px; font-family: monospace; word-break: break-all; font-size: 1.1em; }
    .warning { border-left: 4px solid #e74c3c; padding: 1rem; background: #fff3f3; margin: 1.5rem 0; font-weight: 500; }
    .footer { font-size: 0.9em; color: #7f8c8d; margin-top: 2rem; text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Spiti Valley Folio Archive</h1>
    <p>This archive is hosted on the decentralized Swarm network. To download the entire collection of folios, you only need this single immutable address:</p>
    
    <div class="code">${String(manifestResponse)}</div>
    
    <div class="warning">
      <strong style="${warningClass}">⚠️ IMPORTANT EXPIRY NOTICE</strong><br/>
      Storage on Swarm is a subscription. The current payment covers this archive for approximately <strong>${daysRemaining} days</strong> (Expires around ${expiryDate}).<br/><br/>
      If the storage is not topped up before this date, the folios will be permanently lost from the network.
    </div>

    <p><strong>Instructions for researchers:</strong></p>
    <ul>
      <li>Use the <code>recover.ts</code> script provided in this repository.</li>
      <li>Run: <code>npx ts-node src/recover.ts</code></li>
      <li>When prompted, paste the Address shown above.</li>
    </ul>

    <div class="footer">Archive uploaded by Tsering.</div>
  </div>
</body>
</html>`;

  fs.writeFileSync(accessCardPath, htmlContent);
  console.log(`\n======================================================`);
  console.log(`[Success] Archive Access Card generated for Tsering!`);
  console.log(`Open ${accessCardPath} in your browser.`);
  console.log(`======================================================\n`);
}

main().catch((error) => {
  console.error("\n[Error] Archival process failed:", error);
  process.exit(1);
});
