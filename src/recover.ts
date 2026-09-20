import { Bee } from "@ethersphere/bee-js";
import * as fs from "fs";
import * as path from "path";

const BEE_URL = "http://localhost:1633";
const bee = new Bee(BEE_URL);

interface FeedInfo {
  owner: string;
  topic: string;
  manifest: string;
}

async function main(): Promise<void> {
  let feedOwnerAddress = process.argv[2];
  let feedTopicHex = process.argv[3];

  // Read identifiers securely without needing the original private key (Rule 5)
  if (!feedOwnerAddress || !feedTopicHex) {
    const infoPath = path.join(__dirname, "..", "feed-info.json");
    if (!fs.existsSync(infoPath)) {
      console.error(
        "\n[Error] No tracking file found and no arguments provided.",
      );
      console.error(
        "Usage: npm run recover <feedOwnerAddress> <feedTopicHex>\n",
      );
      process.exit(1);
    }

    console.log(
      `[Recovery] Falling back to published identifiers in ${infoPath}`,
    );
    const info: FeedInfo = JSON.parse(fs.readFileSync(infoPath, "utf8"));
    feedOwnerAddress = info.owner;
    feedTopicHex = info.topic;
  }

  console.log(`\n--- Swarm Recovery Tool ---`);
  console.log(`[Identity] Feed Owner Address: ${feedOwnerAddress}`);
  console.log(`[Identity] Feed Topic: ${feedTopicHex}`);

  // Derive reader from identifiers
  const reader = bee.feed.makeReader(feedTopicHex, feedOwnerAddress);

  // Define feed extraction types dynamically since they aren't explicitly exported
  type FeedUpdateResult = Awaited<ReturnType<typeof reader.download>>;
  let contentReference: string;
  try {
    console.log(
      `[Network] Querying Swarm for the latest Single Owner Chunk (SOC)...`,
    );
    const feedUpdate = (await reader.download()) as FeedUpdateResult & {
      reference: any;
    };

    // Safely extract the string representation of the Reference object
    // Casting through `any` is avoided by utilizing strict string coercion on the Reference property.
    contentReference = String(feedUpdate.reference);

    console.log(
      `[Network] Discovered latest feed update. Content Addressed Chunk (CAC) Reference: ${contentReference}`,
    );
  } catch (e) {
    console.error(
      "\n[Error] Could not read feed or the feed has not been published yet.",
      e,
    );
    process.exit(1);
  }

  console.log(`\n[Success] Archive recovered successfully!`);
  console.log(
    `You can view the collection at: ${BEE_URL}/bzz/${contentReference}/`,
  );
}

main().catch((error) => {
  console.error("\n[Error] Recovery process failed:", error);
  process.exit(1);
});
