const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs').promises;
const path = require('path');

const STATES = ['vic', 'nsw', 'qld', 'wa', 'sa', 'tas', 'nt'];

async function discoverAllStations() {
    console.log("🚀 Aggressive Nationwide Station Discovery in progress...");
    let allStations = [];

    for (let state of STATES) {
        const url = `http://www.bom.gov.au/${state}/observations/${state}all.shtml`;
        try {
            const res = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
            const $ = cheerio.load(res.data);
            let stateCount = 0;

            $('a[href*="/products/ID"]').each((i, el) => {
                const href = $(el).attr('href');
                const name = $(el).text().trim();
                const match = href.match(/ID([A-Z])(\d+)\.(\d+)/);
                
                if (match && name.length > 0) {
                    const stationId = match[3];
                    if (!allStations.some(s => s.id === stationId)) {
                        allStations.push({
                            id: stationId,
                            region: state.toUpperCase(),
                            name: name,
                            prod: `ID${match[1]}${match[2]}`
                        });
                        stateCount++;
                    }
                }
            });
            console.log(`✅ ${state.toUpperCase()}: Found ${stateCount} stations.`);
        } catch (e) {
            console.error(`❌ Error scanning ${state}: ${e.message}`);
        }
    }

    await fs.mkdir(path.join(__dirname, '../data'), { recursive: true });
    await fs.writeFile(path.join(__dirname, '../data/stations.json'), JSON.stringify(allStations, null, 2));
    console.log(`🏁 Indexed ${allStations.length} active stations.`);
}

discoverAllStations();