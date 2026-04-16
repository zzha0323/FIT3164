const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

async function runPipeline() {
    console.log("🛠️ --- Starting Automated Weather Pipeline ---");

    const stationsPath = path.join(__dirname, '../data/stations.json');
    let needsDiscovery = false;

    try {
        const stats = await fs.stat(stationsPath);
        const ageInDays = (Date.now() - stats.mtimeMs) / (1000 * 60 * 60 * 24);
        if (ageInDays > 7) {
            console.log("⏳ Station list is outdated. Refreshing...");
            needsDiscovery = true;
        }
    } catch (e) {
        console.log("🚀 Initial setup: No station list found.");
        needsDiscovery = true;
    }

    // 1. find stations if needed
    if (needsDiscovery) {
        console.log("📡 Running: generate_stations.js...");
        execSync('node scripts/generate_stations.js', { stdio: 'inherit' });
    }

    // 2. collect live data
    console.log("📥 Running: fetch_bom.js...");
    execSync('node scripts/fetch_bom.js', { stdio: 'inherit' });

    // 3. process collected data
    console.log("🧹 Running: process_data.js...");
    execSync('node scripts/process_data.js', { stdio: 'inherit' });

    console.log("✅ --- All Tasks Completed Successfully ---");
}

runPipeline().catch(err => console.error("❌ Pipeline Failed:", err));