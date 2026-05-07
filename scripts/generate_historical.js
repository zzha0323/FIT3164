const fs = require("fs").promises;
const path = require("path");
const axios = require("axios");

const cities = {
  Melbourne: "IDCJDW3033",
  Sydney: "IDCJDW2124",
  Brisbane: "IDCJDW4019",
  Perth: "IDCJDW6111"
};

const years = [2021, 2022, 2023, 2024];

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

function cleanCell(text) {
  return text
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .trim();
}

function extractRows(html) {
  const rows = [...html.matchAll(/<tr[^>]*>(.*?)<\/tr>/gis)];
  const parsed = [];

  for (const row of rows) {
    const cells = [...row[1].matchAll(/<t[dh][^>]*>(.*?)<\/t[dh]>/gis)]
      .map(c => cleanCell(c[1]));

    if (cells.length < 18) continue;

    const date = Number(cells[0]);

    if (!Number.isFinite(date)) continue;

    const minTemp = Number(cells[2]);
    const maxTemp = Number(cells[3]);

    const wind = Number(cells[7]);

    const humidity9am = Number(cells[11]);
    const humidity3pm = Number(cells[17]);

    const avgTemp =
      Number.isFinite(minTemp) && Number.isFinite(maxTemp)
        ? (minTemp + maxTemp) / 2
        : null;

    let avgHumidity = null;

    if (
      Number.isFinite(humidity9am) &&
      Number.isFinite(humidity3pm)
    ) {
      avgHumidity = (humidity9am + humidity3pm) / 2;
    } else if (Number.isFinite(humidity9am)) {
      avgHumidity = humidity9am;
    } else if (Number.isFinite(humidity3pm)) {
      avgHumidity = humidity3pm;
    }

    parsed.push({
      temp: avgTemp,
      wind: Number.isFinite(wind) ? wind : null,
      humidity: avgHumidity
    });
  }

  return parsed;
}

async function fetchMonth(city, productId, year, month) {
  const ym = `${year}${String(month).padStart(2, "0")}`;

  const url = `https://www.bom.gov.au/climate/dwo/${productId}.${ym}.shtml`;

  console.log(`Fetching ${city} ${ym}...`);

  try {
    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        "User-Agent": "Mozilla/5.0"
      }
    });

    return extractRows(response.data);

  } catch (err) {
    console.warn(`Skipped ${city} ${ym}: ${err.message}`);
    return [];
  }
}

async function generate() {

  const grouped = {};

  for (const [city, productId] of Object.entries(cities)) {

    for (const year of years) {

      for (let month = 1; month <= 12; month++) {

        const season = getSeason(month);

        const rows = await fetchMonth(
          city,
          productId,
          year,
          month
        );

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

        for (const row of rows) {

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

        // avoid hammering BOM
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }
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
      "../data/processed/weather_seasonal_medians.json"
    ),
    JSON.stringify(output, null, 2)
  );

  console.log(
    `Generated weather_seasonal_medians.json with ${output.length} records`
  );
}

generate();
