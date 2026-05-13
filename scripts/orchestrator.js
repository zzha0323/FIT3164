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

    // 4. fetch historical data from Open-Meteo (2020 - Mar 2025)
    console.log("📅 Running: generate_historical_openmeteo.js...");
    execSync('node scripts/generate_historical_openmeteo.js', { stdio: 'inherit' });

    // 5. fetch recent data from BOM (Apr 2025 - now)
    console.log("📅 Running: generate_historical.js...");
    execSync('node scripts/generate_historical.js', { stdio: 'inherit' });

    // 6. merge both historical outputs into one file
    console.log("🔀 Merging historical data...");
    const processedDir = path.join(__dirname, '../data/processed');

    const openMeteoData = JSON.parse(
        await fs.readFile(path.join(processedDir, 'weather_historical_openmeteo.json'), 'utf-8')
    );

    const bomData = JSON.parse(
        await fs.readFile(path.join(processedDir, 'weather_seasonal_medians.json'), 'utf-8')
    );

    const merged = [...openMeteoData, ...bomData];

    await fs.writeFile(
        path.join(processedDir, 'weather_seasonal_medians.json'),
        JSON.stringify(merged, null, 2)
    );
    console.log(`✅ Merged ${openMeteoData.length} historical + ${bomData.length} recent records -> weather_seasonal_medians_json`)

    console.log("✅ --- All Tasks Completed Successfully ---");
}

runPipeline().catch(err => console.error("❌ Pipeline Failed:", err));