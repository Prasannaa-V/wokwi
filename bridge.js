const fs = require("fs");
const path = require("path");
const express = require("express");

const PORT = Number(process.env.PORT || 3001);
const FIREBASE_KEY_PATH = path.join(__dirname, "serviceAccountKey.json");
const READINGS_FILE_PATH = path.join(__dirname, "sensor-readings.json");
const MAX_HISTORY = 200;
const MANHOLE_DEPTH_CM = 100;

const DEFAULT_LOCATION = {
  id: "MH-1023",
  lat: 12.9692,
  lng: 79.1559,
};

const thresholds = {
  h2sWarning: 7,
  h2sDanger: 10,
  ch4Warning: 700,
  ch4Danger: 1000,
  waterLevelWarning: 35,
  waterLevelDanger: 50,
};

const app = express();
app.use(express.json());
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});

let admin = null;
let db = null;
let storageMode = "local-cache";
let historicalReadings = loadHistoricalReadings();

initializeFirebase();

function initializeFirebase() {
  if (!fs.existsSync(FIREBASE_KEY_PATH)) {
    console.warn(
      "⚠️  serviceAccountKey.json not found. Starting bridge in local-cache mode."
    );
    return;
  }

  try {
    admin = require("firebase-admin");
    const serviceAccount = require(FIREBASE_KEY_PATH);

    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id || "manhole-monitoring-e5d2b",
      });
    }

    db = admin.firestore();
    storageMode = "firebase+local-cache";
    console.log("✅ Firebase connected. Bridge will mirror readings to Firestore.");
  } catch (error) {
    admin = null;
    db = null;
    storageMode = "local-cache";
    console.warn(
      `⚠️  Firebase initialization failed (${error.message}). Using local-cache mode instead.`
    );
  }
}

function loadHistoricalReadings() {
  if (!fs.existsSync(READINGS_FILE_PATH)) {
    return [];
  }

  try {
    const fileContents = fs.readFileSync(READINGS_FILE_PATH, "utf8");
    const parsedReadings = JSON.parse(fileContents);

    if (!Array.isArray(parsedReadings)) {
      return [];
    }

    return parsedReadings.filter(isValidReading).slice(-MAX_HISTORY);
  } catch (error) {
    console.warn(
      `⚠️  Could not read cached sensor history (${error.message}). Starting fresh.`
    );
    return [];
  }
}

function persistHistoricalReadings() {
  try {
    fs.writeFileSync(
      READINGS_FILE_PATH,
      JSON.stringify(historicalReadings.slice(-MAX_HISTORY), null, 2)
    );
  } catch (error) {
    console.warn(`⚠️  Could not persist sensor history (${error.message}).`);
  }
}

function isValidReading(reading) {
  return (
    reading &&
    Number.isFinite(Number(reading.ch4)) &&
    Number.isFinite(Number(reading.h2s)) &&
    Number.isFinite(Number(reading.waterLevel)) &&
    typeof reading.lastUpdated === "string"
  );
}

function parseNumber(value, fallback = null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function roundToTwo(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getMetricStatus(value, warningThreshold, dangerThreshold) {
  if (value >= dangerThreshold) {
    return "danger";
  }

  if (value >= warningThreshold) {
    return "warning";
  }

  return "safe";
}

function getOverallStatus(metricStatuses) {
  if (metricStatuses.includes("danger")) {
    return "Danger";
  }

  if (metricStatuses.includes("warning")) {
    return "Warning";
  }

  return "Safe";
}

function normalizeLocation(location) {
  if (!location) {
    return DEFAULT_LOCATION;
  }

  return {
    id: location.id || DEFAULT_LOCATION.id,
    lat: parseNumber(location.lat, DEFAULT_LOCATION.lat),
    lng: parseNumber(location.lng, DEFAULT_LOCATION.lng),
  };
}

function normalizeSensorData(rawData = {}) {
  const ch4 = parseNumber(rawData.ch4);
  const h2s = parseNumber(rawData.h2s);
  const requestedWaterLevel = parseNumber(rawData.waterLevel);
  const requestedWaterDistance = parseNumber(
    rawData.waterDistance,
    parseNumber(rawData.water)
  );

  if (
    ch4 === null ||
    h2s === null ||
    (requestedWaterLevel === null && requestedWaterDistance === null)
  ) {
    return null;
  }

  const waterLevel =
    requestedWaterLevel !== null
      ? clamp(requestedWaterLevel, 0, MANHOLE_DEPTH_CM)
      : clamp(
          MANHOLE_DEPTH_CM - Math.max(requestedWaterDistance, 0),
          0,
          MANHOLE_DEPTH_CM
        );
  const normalizedWaterDistance =
    requestedWaterDistance !== null
      ? Math.max(requestedWaterDistance, 0)
      : clamp(MANHOLE_DEPTH_CM - waterLevel, 0, MANHOLE_DEPTH_CM);

  const ch4Status = getMetricStatus(
    ch4,
    thresholds.ch4Warning,
    thresholds.ch4Danger
  );
  const h2sStatus = getMetricStatus(
    h2s,
    thresholds.h2sWarning,
    thresholds.h2sDanger
  );
  const waterStatus = getMetricStatus(
    waterLevel,
    thresholds.waterLevelWarning,
    thresholds.waterLevelDanger
  );

  const status = getOverallStatus([ch4Status, h2sStatus, waterStatus]);
  const parsedTimestamp = new Date(rawData.lastUpdated || Date.now());
  const lastUpdated = Number.isNaN(parsedTimestamp.getTime())
    ? new Date().toISOString()
    : parsedTimestamp.toISOString();

  return {
    ch4: roundToTwo(ch4),
    h2s: roundToTwo(h2s),
    waterDistance: roundToTwo(normalizedWaterDistance),
    waterLevel: roundToTwo(waterLevel),
    alert: status === "Danger",
    status,
    battery: clamp(Math.round(parseNumber(rawData.battery, 100)), 0, 100),
    sensorStatus: rawData.sensorStatus || "Working",
    source: rawData.source || "wokwi",
    location: normalizeLocation(rawData.location),
    thresholds,
    lastUpdated,
    metricStatus: {
      ch4: ch4Status,
      h2s: h2sStatus,
      waterLevel: waterStatus,
    },
  };
}

function addReading(reading) {
  historicalReadings = historicalReadings.concat(reading).slice(-MAX_HISTORY);
  persistHistoricalReadings();
  return reading;
}

function getLatestReading() {
  return historicalReadings.length
    ? historicalReadings[historicalReadings.length - 1]
    : null;
}

async function mirrorReadingToFirebase(reading) {
  if (!db || !admin) {
    return null;
  }

  try {
    const timestamp = admin.firestore.Timestamp.fromDate(
      new Date(reading.lastUpdated)
    );

    const docRef = await db.collection("sensor_readings").add({
      ch4: reading.ch4,
      h2s: reading.h2s,
      water: reading.waterDistance,
      waterLevel: reading.waterLevel,
      alert: reading.alert,
      status: reading.status,
      battery: reading.battery,
      source: reading.source,
      sensorStatus: reading.sensorStatus,
      location: reading.location,
      metricStatus: reading.metricStatus,
      timestamp,
    });

    return docRef.id;
  } catch (error) {
    console.error(`❌ Firebase mirror failed: ${error.message}`);
    return null;
  }
}

app.get("/health", (req, res) => {
  const latestReading = getLatestReading();

  res.json({
    status: "ok",
    storageMode,
    firebaseEnabled: Boolean(db),
    totalReadings: historicalReadings.length,
    latestReadingAt: latestReading ? latestReading.lastUpdated : null,
    manholeDepthCm: MANHOLE_DEPTH_CM,
    thresholds,
    apiBase: `http://localhost:${PORT}`,
  });
});

app.get("/api/sensor/latest", (req, res) => {
  res.json({
    storageMode,
    totalReadings: historicalReadings.length,
    reading: getLatestReading(),
  });
});

app.get("/api/sensor/history", (req, res) => {
  const requestedLimit = Number.parseInt(req.query.limit, 10);
  const limit = clamp(Number.isFinite(requestedLimit) ? requestedLimit : 20, 1, MAX_HISTORY);

  res.json({
    storageMode,
    totalReadings: historicalReadings.length,
    readings: historicalReadings.slice(-limit),
  });
});

app.post("/api/sensor", async (req, res) => {
  try {
    const reading = normalizeSensorData(req.body);

    if (!reading) {
      return res.status(400).json({
        error: "Expected numeric ch4, h2s, and water fields in the sensor payload.",
      });
    }

    addReading(reading);
    const firebaseDocId = await mirrorReadingToFirebase(reading);

    console.log(
      `[INGESTED] ${reading.source} | CH4 ${reading.ch4} ppm | H2S ${reading.h2s} ppm | Water Level ${reading.waterLevel} cm | ${reading.status}`
    );

    res.json({
      status: "ok",
      storageMode,
      firebaseDocId,
      reading,
    });
  } catch (error) {
    console.error(`❌ Bridge error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`\n🚀 Wokwi bridge running on http://localhost:${PORT}`);
  console.log(`📡 POST sensor data to: http://localhost:${PORT}/api/sensor`);
  console.log(`📈 Latest reading: http://localhost:${PORT}/api/sensor/latest`);
  console.log(`🕒 History feed: http://localhost:${PORT}/api/sensor/history?limit=20`);
  console.log(`💚 Health check: http://localhost:${PORT}/health`);
  console.log(`🗂️  Storage mode: ${storageMode}\n`);
});
