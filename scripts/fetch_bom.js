const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

/** * Sampling weights based on Australia’s 2024/25 population distribution and geographical significance
 * Ensuring that data displayed in the UI reflects population density distribution (Requirement R15)
 **/
const STATE_QUOTAS = {
    'NSW': 20, // Sydney and surrounding New South Wales
    'VIC': 18, // Melbourne and key Victoria hubs
    'QLD': 15, // Queensland coastal regions
    'WA': 12,  // Perth and Western Australia ports
    'SA': 10,  // Adelaide and southern hubs
    'TAS': 8,  // Tasmania's main towns
    'NT': 6    // Northern Territory's key nodes
};

async function weightedSmartFetch() {
    console.log("🚀 Starting Weighted Nationwide Data Collection...");
    
    // 1. Retrieve the full index for 778 sites
    const stations = JSON.parse(await fs.readFile(path.join(__dirname, '../data/stations.json')));
    const timestamp = Date.now();
    await fs.mkdir(path.join(__dirname, '../data/raw'), { recursive: true });

    let totalSuccess = 0;

    for (const [region, quota] of Object.entries(STATE_QUOTAS)) {
        console.log(`\n📡 Processing [${region}] - Target Quota: ${quota} stations`);
        
        // Filter stations for the current region. Since the BOM list typically lists important sites first (e.g., airports, city centers),
        // we can simply take a sample in order to satisfy the "popular cities first" logic.
        const pool = stations.filter(s => s.region === region);
        let successCount = 0;

        for (let i = 0; i < pool.length && successCount < quota; i++) {
            const station = pool[i];
            const URL = `http://www.bom.gov.au/fwo/${station.prod}/${station.prod}.${station.id}.json`;
            
            try {
                // Increase delay to prevent IP blocking (Anti-Blocking Strategy)
                await new Promise(resolve => setTimeout(resolve, 300)); 

                const res = await axios.get(URL, { 
                    timeout: 5000, 
                    headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'http://www.bom.gov.au/' } 
                });

                if (res.data?.observations?.data) {
                    const fileName = `${region.toLowerCase()}_${station.id}_raw.json`;
                    
                    // Inject metadata: record station importance
                    res.data.custom_meta = {
                        region: region,
                        station_name: station.name,
                        importance_rank: i + 1,
                        is_major_hub: i < 5 // First 5 are typically core cities/airports
                    };

                    await fs.writeFile(path.join(__dirname, '../data/raw', fileName), JSON.stringify(res.data, null, 2));
                    console.log(`   ✅ [${successCount + 1}/${quota}] Fetch successful: ${station.name}`);
                    successCount++;
                    totalSuccess++;
                }
            } catch (err) {
                // A station is down, but don't error out - find the next closest one
                console.warn(`   ⚠️ Skipping ${station.name} (${err.message})`);
            }
        }
        console.log(`🎊 Finished [${region}]: Total ${successCount} stations captured.`);
    }

    console.log(`\n🏁 Nationwide capture finished. Total stations collected: ${totalSuccess}`);
}

weightedSmartFetch();