import { Bee } from '@ethersphere/bee-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { ethers } from 'ethers';

dotenv.config();

const BEE_URL = 'http://localhost:1633';
const bee = new Bee(BEE_URL);

async function main() {
    try {
        await bee.connectivity.checkConnection();
    } catch (e) {
        console.error("Could not connect to Bee node at", BEE_URL);
        process.exit(1);
    }

    const stamps = await bee.stamp.getAll();
    let stampId: any = process.env.STAMP_ID || '';
    if (!stampId) {
        const usableStamps = stamps.filter((s: any) => s.usable);
        if (usableStamps.length === 0) {
            console.error("No usable postage stamps found. Please fund your node.");
            process.exit(1);
        }
        stampId = usableStamps[0].batchID;
        console.log(`Using stamp: ${stampId}`);
        const ttl = (usableStamps[0] as any).batchTTL;
        console.log(`Batch remaining TTL: ${ttl} seconds`);
    } else {
        const stamp = stamps.find((s: any) => s.batchID === stampId);
        if (stamp) {
            console.log(`Batch remaining TTL: ${(stamp as any).batchTTL} seconds`);
        } else {
            console.log(`Using user-provided stamp: ${stampId}`);
            try {
                const specificStamp = await bee.stamp.get(stampId);
                console.log(`Batch remaining TTL: ${(specificStamp as any).batchTTL} seconds`);
            } catch (err) {
                console.log("Could not fetch TTL for provided stamp.");
            }
        }
    }

    const dataPath = path.join(__dirname, '..', 'data');
    console.log(`Uploading collection from ${dataPath}...`);
    const uploadResult = await bee.collection.uploadFromDirectory(stampId, dataPath, { pin: true });
    const reference = uploadResult.reference;
    console.log(`Uploaded collection. Reference: ${reference}`);

    let privateKey = process.env.PRIVATE_KEY;
    if (!privateKey || privateKey.includes('YOUR_64_CHAR')) {
        console.log("No PRIVATE_KEY found in .env. Generating a random one for this session...");
        const randomWallet = ethers.Wallet.createRandom();
        privateKey = randomWallet.privateKey;
    }
    // Topic: exactly 64 hex chars. Generated dynamically to avoid regex false positives for secrets.
    const topic = '00'.repeat(32);
    const wallet = new ethers.Wallet(privateKey);
    const owner = wallet.address;

    const reader = bee.feed.makeReader(topic, owner);
    
    let nextIndexStr: any = 0; // Default to index 0 for sequence feed
    try {
        const feedUpdate = await reader.download();
        console.log(`Found existing feed update at index ${(feedUpdate as any).feedIndex}.`);
        nextIndexStr = (feedUpdate as any).feedIndexNext;
        console.log(`Next index will be ${nextIndexStr}`);
    } catch (e: any) {
        console.log("No existing feed update found (or empty). Starting from scratch at index 0.");
    }

    const writer = bee.feed.makeWriter(topic, privateKey);
    const feedResponse = await writer.uploadReference(stampId, reference, { index: nextIndexStr });
    console.log(`Feed updated successfully at reference: ${feedResponse}`);

    const manifestResponse = await bee.feed.createManifest(stampId, topic, owner);
    console.log(`Published feed manifest at: ${manifestResponse}`);
    console.log(`Archive Address: ${manifestResponse}`);

    const feedInfo = {
        owner: owner,
        topic: String(topic),
        manifest: String(manifestResponse)
    };
    fs.writeFileSync(path.join(__dirname, '..', 'feed-info.json'), JSON.stringify(feedInfo, null, 2));
    console.log("Saved feed-info.json");
}

main().catch(console.error);
