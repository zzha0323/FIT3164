const fs = require("fs").promises;
const path = require("path");

const cities = ["Melbourne", "Sydney", "Brisbane", "Perth"];
const years = [2021, 2022, 2023, 2024];
const seasons = ["Summer", "Autumn", "Winter", "Spring"];

const base = {
  Melbourne: { temp: 18, wind: 16, humidity: 65 },
  Sydney: { temp: 20, wind: 18, humidity: 63 },
  Brisbane: { temp: 24, wind: 14, humidity: 68 },
  Perth: { temp: 22, wind: 20, humidity: 55 }
};

function randOffset(range) {
  return (Math.random() * range * 2 - range);
}

async function generate() {
  const data = [];

  for (const city of cities) {
    for (const year of years) {
      for (const season of seasons) {

        const seasonEffect = {
          Summer: 5,
          Autumn: 0,
          Winter: -6,
          Spring: 2
        }[season];

        const yearTrend = (year - 2021) * 0.4; // slight warming trend

        const temp = base[city].temp + seasonEffect + yearTrend + randOffset(1);
        const wind = base[city].wind + randOffset(2);
        const humidity = base[city].humidity - seasonEffect + randOffset(3);

        data.push(
          { city, year, season, variable: "Temperature", value: Number(temp.toFixed(1)) },
          { city, year, season, variable: "Wind", value: Number(wind.toFixed(1)) },
          { city, year, season, variable: "Humidity", value: Number(humidity.toFixed(1)) }
        );
      }
    }
  }

  await fs.mkdir(path.join(__dirname, "../data/processed"), { recursive: true });

  await fs.writeFile(
    path.join(__dirname, "../data/processed/weather_seasonal_medians.json"),
    JSON.stringify(data, null, 2)
  );

  console.log("Generated weather_seasonal_medians.json");
}

generate();
