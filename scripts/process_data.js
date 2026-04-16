const fs = require('fs').promises;
const path = require('path');

async function processData() {
    const rawDir = path.join(__dirname, '../data/raw');
    const files = (await fs.readdir(rawDir)).filter(f => f.endsWith('_raw.json'));
    
    let report = { last_updated: new Date().toISOString(), regions: {} };

    for (const file of files) {
        const raw = JSON.parse(await fs.readFile(path.join(rawDir, file), 'utf-8'));
        const latest = raw.observations.data[0];
        const region = raw.custom_meta.region;

        if (!report.regions[region]) report.regions[region] = [];
        
        report.regions[region].push({
            name: raw.custom_meta.station_name,
            temp: latest.air_temp,
            humidity: latest.rel_hum,
            wind: latest.wind_spd_kmh,
            time: latest.local_date_time_full
        });
    }

    await fs.mkdir(path.join(__dirname, '../data/processed'), { recursive: true });
    await fs.writeFile(path.join(__dirname, '../data/processed/weather_master.json'), JSON.stringify(report, null, 2));
    console.log("📊 Processed weather_master.json created.");
}

processData();