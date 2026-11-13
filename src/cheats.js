// Original street words. Typed after the tilde key, not borrowed from another game.
export const CHEAT_WORDS = {
  bazaar: "pedestrians",
  rushhour: "traffic",
  monsoon: "weather",
};

export const WEATHER_CYCLE = ["clear", "drizzle", "monsoon", "blue-hour"];

export const PEDESTRIAN_BOOST = 18;
export const PEDESTRIAN_CAP = 120;
export const TRAFFIC_BOOST = { cars: 6, motorcycles: 12 };
export const TRAFFIC_CAP = 130;

export function normalizeCheat(raw) {
  return String(raw ?? "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
}

export function matchCheat(raw) {
  const word = normalizeCheat(raw);
  const effect = CHEAT_WORDS[word];
  if (!effect) return null;
  return { word, effect };
}

export function nextWeather(current) {
  const index = WEATHER_CYCLE.indexOf(current);
  const from = index < 0 ? 0 : index;
  return WEATHER_CYCLE[(from + 1) % WEATHER_CYCLE.length];
}

export function weatherLook(name) {
  if (name === "drizzle") {
    return {
      night: false,
      rain: true,
      density: 0.0024,
      background: 0x9aa7a4,
      sun: 1.05,
      hemi: 1.35,
      label: "DRIZZLE",
      temp: "22°C",
      clock: "17:55",
      streak: 0.55,
    };
  }
  if (name === "monsoon") {
    return {
      night: false,
      rain: true,
      density: 0.0046,
      background: 0x667680,
      sun: 0.38,
      hemi: 0.85,
      label: "MONSOON",
      temp: "19°C",
      clock: "18:10",
      streak: 1,
    };
  }
  if (name === "blue-hour") {
    return {
      night: true,
      rain: false,
      density: 0.0017,
      background: 0x526675,
      sun: 0.4,
      hemi: 1,
      label: "BLUE HOUR",
      temp: "21°C",
      clock: "19:05",
      streak: 0,
    };
  }
  return {
    night: false,
    rain: false,
    density: 0.0013,
    background: 0xc6c8ac,
    sun: 3.5,
    hemi: 2.3,
    label: "GOLDEN HOUR",
    temp: "24°C",
    clock: "17:42",
    streak: 0,
  };
}

export function cheatNotice(effect, weatherName, added) {
  if (effect === "pedestrians") {
    return added > 0
      ? "More people are out on the footpath."
      : "The footpaths are already full.";
  }
  if (effect === "traffic") {
    return added > 0
      ? "Traffic thickens along the road."
      : "The roads cannot take any more traffic.";
  }
  if (weatherName === "drizzle") return "A drizzle moves over the neighbourhood.";
  if (weatherName === "monsoon") return "Monsoon rain closes in.";
  if (weatherName === "blue-hour") return "The light drops into blue hour.";
  return "The sky clears to golden hour.";
}

export function populationRoom(count, cap, boost) {
  return Math.max(0, Math.min(boost, cap - count));
}
