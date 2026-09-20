import { Bee } from '@ethersphere/bee-js';
import * as fs from 'fs';
import * as path from 'path';

const BEE_URL = 'http://localhost:1633';
const bee = new Bee(BEE_URL);

async function main() {
    let owner = process.argv[2];
    let topic = process.argv[3];

    // Fallback to reading from the generated info file if not provided as CLI args
    // This ensures we can recover using only published identifiers (Test Case 5)
    if (!owner || !topic) {
        const infoPath = path.join(__dirname, '..', 'feed-info.json');
        if (!fs.existsSync(infoPath)) {
            console.error("Please provide owner and topic as arguments, or run publish.ts first.");
            console.error("Usage: ts-node src/recover.ts <ownerAddress> <topicHex>");
            process.exit(1);
        }
        const info = JSON.parse(fs.readFileSync(infoPath, 'utf8'));
        owner = info.owner;
        topic = info.topic;
    }
    
    console.log(`Recovering archive from feed...`);
    console.log(`Owner: ${owner}`);
    console.log(`Topic: ${topic}`);

    const reader = bee.feed.makeReader(topic, owner);
    let reference;
    try {
        const feedUpdate = await reader.download();
        // The result might have `.reference` as an object, so we convert it to string directly.
        reference = String((feedUpdate as any).reference || feedUpdate);
        console.log(`Found latest feed update. Reference: ${reference}`);
    } catch (e) {
        console.error("Could not read feed or feed is empty.", e);
        process.exit(1);
    }

    console.log("Archive recovered successfully!");
    console.log(`You can view the collection at: ${BEE_URL}/bzz/${reference}/`);
}

main().catch(console.error);
