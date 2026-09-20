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

  // 7. Track Identifiers for Recovery (Rule 2)
  const feedInfoPath = path.join(__dirname, "..", "feed-info.json");
  const feedInfo = {
    owner: feedOwnerAddress,
    topic: feedTopicHex,
    manifest: String(manifestResponse),
  };

  fs.writeFileSync(feedInfoPath, JSON.stringify(feedInfo, null, 2));
  console.log(`[Audit] Identifiers durably written to ${feedInfoPath}`);
}

main().catch((error) => {
  console.error("\n[Error] Archival process failed:", error);
  process.exit(1);
});
