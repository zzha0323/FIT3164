const fs = require("fs").promises;
const path = require("path");
const axios = require("axios");

const cities = {
  Melbourne: {lat: -37.8136, lon: 144.9631},
  Sydney:    {lat: -33.8688, lon: 151.2093},
  Brisbane:  {lat: -27.4698, lon: 153.0251},
  Perth:     {lat: -31.9523, lon: 115.8613}
};

// Open-Meteo covers data before the BOM DWO 14-month window
const START_DATE = "2020-01-01"
const END_DATE = "2025-03-31"

function getSeason(month) {
  if ([12, 1, 2].includes(month)) return "Summer";
  if ([3, 4, 5].includes(month)) return "Autumn";
  if ([6, 7, 8].includes(month)) return "Winter";
  return "Spring";
}

function median(values) {
  const nums = values
    .filter(v => Number.isFinite(v))
    .sort((a, b) => a - b);

  if (!nums.length) return null;

  const mid = Math.floor(nums.length / 2);

  return nums.length % 2
    ? nums[mid]
    : (nums[mid - 1] + nums[mid]) / 2;
}

async function fetchRows(city, lat, lon) {
  console.log(`Fetching ${city} (${START_DATE} to ${END_DATE})...`);

  const url = "https://archive-api.open-meteo.com/v1/archive";

  const response = await axios.get(url, {
    timeout: 10000,
    params: {
      latitude: lat,
      longitude: lon,
      start_date: START_DATE,
      end_date: END_DATE,
      daily: [
        "temperature_2m_max",
        "temperature_2m_min",
        "wind_speed_10m_max",
        "relative_humidity_2m_max",
        "relative_humidity_2m_min",
      ],
      timezone: "Australia/Sydney",
    },
  });

  const daily = response.data.daily;

  return daily.time.map((dateStr, i) => {
    const tMax = daily.temperature_2m_max[i];
    const tMin = daily.temperature_2m_min[i];
    const wind = daily.wind_speed_10m_max[i];
    const hMax = daily.relative_humidity_2m_max[i];
    const hMin = daily.relative_humidity_2m_min[i];

    const temp =
      tMax != null && tMin != null ? (tMax + tMin) / 2 : null;

    const humidity =
      hMax != null && hMin != null ? (hMax + hMin) / 2 : 
      hMax != null ? hMax :
      hMin != null ? hMin : null;

    return {
      date: dateStr,
      temp,
      wind: wind != null && wind > 0 ? wind : null,
      humidity
    };
  });
}

async function generate() {

  const grouped = {};

  for (const [city, {lat, lon}] of Object.entries(cities)) {
    let rows;

    try {
      rows = await fetchRows(city, lat, lon);
    } catch (err) {
      console.error(`Failed to fetch ${city}: ${err.message}`);
      continue;
    }

    for (const row of rows) {
      const [year, month] = row.date.split("-").map(Number);
      const season = getSeason(month);
      const key = `${city}|${year}|${season}`;

      if (!grouped[key]) {
        grouped[key] = {
          city,
          year,
          season,
          Temperature: [],
          Wind: [],
          Humidity: []
        };
      }

      if (row.temp !== null) {
        grouped[key].Temperature.push(row.temp);
      }

      if (row.wind !== null) {
        grouped[key].Wind.push(row.wind);
      }

      if (row.humidity !== null) {
        grouped[key].Humidity.push(row.humidity);
      }
    }
    
    // avoid hamerring the API
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  const output = [];

  for (const group of Object.values(grouped)) {

    for (const variable of [
      "Temperature",
      "Wind",
      "Humidity"
    ]) {

      const value = median(group[variable]);

      if (value !== null) {

        output.push({
          city: group.city,
          year: group.year,
          season: group.season,
          variable,
          value: Number(value.toFixed(1))
        });
      }
    } 
  }

    await fs.mkdir(
      path.join(__dirname, "../data/processed"),
      { recursive: true }
    );

    await fs.writeFile(
      path.join(
        __dirname,
        "../data/processed/weather_historical_openmeteo.json"
      ),
      JSON.stringify(output, null, 2)
    );

    console.log(
      `Generated weather_historical_openmeteo.json with ${output.length} records`
    );
}

generate();