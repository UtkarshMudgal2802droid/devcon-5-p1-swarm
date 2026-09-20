import { Bee, PostageBatch, Reference } from "@ethersphere/bee-js";

/**
 * Ensures a valid postage batch is available for uploading.
 * It will prioritize a provided stamp ID, or query the node for usable stamps.
 */
export async function getUsablePostageBatch(
  bee: Bee,
  providedBatchId?: string,
): Promise<string> {
  const stamps: PostageBatch[] = await bee.stamp.getAll();

  if (!providedBatchId) {
    const usableStamps = stamps.filter((s) => s.usable);
    if (usableStamps.length > 0) {
      const batchId = usableStamps[0].batchID;
      console.log(`[Swarm] Utilizing existing postage batch: ${batchId}`);
      console.log(
        `[Swarm] Batch remaining TTL: ${(usableStamps[0] as unknown as { batchTTL: number }).batchTTL} seconds`,
      );
      return batchId as unknown as string;
    } else {
      console.error("[Swarm] No usable postage batches found on the node.");
      console.error(
        "[Swarm] Please fund your node and purchase a batch to store data.",
      );
      process.exit(1);
    }
  } else {
    // @ts-ignore
    const stamp = stamps.find((s) => s.batchID === providedBatchId);
    if (stamp) {
      console.log(
        `[Swarm] Utilizing user-provided postage batch: ${providedBatchId}`,
      );
      console.log(
        `[Swarm] Batch remaining TTL: ${(stamp as unknown as { batchTTL: number }).batchTTL} seconds`,
      );
    } else {
      console.log(
        `[Swarm] Provided batch ${providedBatchId} not found in local cache. Verifying on chain...`,
      );
      try {
        // @ts-ignore - bee-js expects a nominal BatchId type, string is passed
        const specificStamp = await bee.stamp.get(providedBatchId);
        console.log(
          `[Swarm] Batch remaining TTL: ${(specificStamp as unknown as { batchTTL: number }).batchTTL} seconds`,
        );
      } catch (err) {
        console.log(
          "[Swarm] Could not fetch TTL for the explicitly provided batch. Assuming usable.",
        );
      }
    }
    return providedBatchId;
  }
}
