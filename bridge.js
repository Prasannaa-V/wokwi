const fs = require("fs");
const path = require("path");
const express = require("express");

loadEnvFile(path.join(__dirname, ".env"));

const PORT = Number(process.env.PORT || process.env.BRIDGE_PORT || 3001);
const FIREBASE_KEY_PATH = path.join(__dirname, "serviceAccountKey.json");
const READINGS_FILE_PATH = path.join(__dirname, "sensor-readings.json");
const FIRESTORE_COLLECTION = process.env.FIRESTORE_COLLECTION || "sensor_readings";
const STORAGE_BACKEND = (process.env.SENSOR_STORAGE_BACKEND || "auto").toLowerCase();
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
let storageMode = "initializing";
let localCacheEnabled = false;
let historicalReadings = [];

initializeStorage();

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const fileContents = fs.readFileSync(filePath, "utf8");

  for (const line of fileContents.split(/\r?\n/)) {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmedLine.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmedLine.slice(0, separatorIndex).trim();
    let value = trimmedLine.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function initializeStorage() {
  const firestoreReady = initializeFirebase();
  const useFirestoreAsPrimary =
    firestoreReady &&
    (STORAGE_BACKEND === "auto" || STORAGE_BACKEND === "firestore");

  if (useFirestoreAsPrimary) {
    localCacheEnabled = process.env.LOCAL_CACHE_ENABLED === "true";
    storageMode = localCacheEnabled ? "firestore+local-cache" : "firestore";
  } else {
    if (STORAGE_BACKEND === "firestore") {
      console.warn(
        "⚠️  Firestore was requested but Firebase credentials are missing or invalid. Falling back to local-cache mode."
      );
    }

    localCacheEnabled = true;
    storageMode = "local-cache";
  }

  historicalReadings = localCacheEnabled ? loadHistoricalReadings() : [];
}

function getFirebaseCredentialsFromEnv() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    return null;
  }

  return {
    project_id: projectId,
    client_email: clientEmail,
    private_key: privateKey.replace(/\\n/g, "\n"),
  };
}

function initializeFirebase() {
  const envCredentials = getFirebaseCredentialsFromEnv();

  if (!envCredentials && !fs.existsSync(FIREBASE_KEY_PATH)) {
    console.warn(
      "⚠️  Firebase credentials not found. Bridge will use local-cache mode until Firestore credentials are configured."
    );
    return false;
  }

  try {
    admin = require("firebase-admin");
    const serviceAccount = envCredentials || require(FIREBASE_KEY_PATH);

    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id || "manhole-monitoring-e5d2b",
      });
    }

    db = admin.firestore();
    console.log(
      `✅ Firebase connected. Firestore collection: ${FIRESTORE_COLLECTION}`
    );
    return true;
  } catch (error) {
    admin = null;
    db = null;
    console.warn(
      `⚠️  Firebase initialization failed (${error.message}).`
    );
    return false;
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
  if (!localCacheEnabled) {
    return;
  }

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
  if (!localCacheEnabled) {
    return reading;
  }

  historicalReadings = historicalReadings.concat(reading).slice(-MAX_HISTORY);
  persistHistoricalReadings();
  return reading;
}

function isFirestorePrimary() {
  return Boolean(db) && storageMode.startsWith("firestore");
}

function toIsoString(value) {
  if (!value) {
    return new Date().toISOString();
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }

  const parsedDate = new Date(value);
  return Number.isNaN(parsedDate.getTime())
    ? new Date().toISOString()
    : parsedDate.toISOString();
}

function mapStoredReading(data = {}, id = null) {
  const normalized = normalizeSensorData({
    ...data,
    lastUpdated: data.lastUpdated || toIsoString(data.timestamp),
  });

  if (!normalized) {
    return null;
  }

  return {
    ...normalized,
    id: id || data.id || undefined,
    alert:
      typeof data.alert === "boolean" ? data.alert : normalized.alert,
    status: data.status || normalized.status,
    battery: clamp(
      Math.round(parseNumber(data.battery, normalized.battery)),
      0,
      100
    ),
    sensorStatus: data.sensorStatus || normalized.sensorStatus,
    source: data.source || normalized.source,
    location: normalizeLocation(data.location || normalized.location),
    thresholds: data.thresholds || normalized.thresholds,
    metricStatus: data.metricStatus || normalized.metricStatus,
    lastUpdated: data.lastUpdated || normalized.lastUpdated,
  };
}

async function storeReadingInFirestore(reading) {
  if (!db || !admin) {
    return null;
  }

  const timestamp = admin.firestore.Timestamp.fromDate(
    new Date(reading.lastUpdated)
  );

  const docRef = await db.collection(FIRESTORE_COLLECTION).add({
    ...reading,
    timestamp,
  });

  return docRef.id;
}

async function getLatestReadingFromFirestore() {
  if (!db) {
    return null;
  }

  const snapshot = await db
    .collection(FIRESTORE_COLLECTION)
    .orderBy("timestamp", "desc")
    .limit(1)
    .get();

  if (snapshot.empty) {
    return null;
  }

  return mapStoredReading(snapshot.docs[0].data(), snapshot.docs[0].id);
}

async function getHistoryFromFirestore(limit) {
  if (!db) {
    return [];
  }

  const snapshot = await db
    .collection(FIRESTORE_COLLECTION)
    .orderBy("timestamp", "desc")
    .limit(limit)
    .get();

  return snapshot.docs
    .map((doc) => mapStoredReading(doc.data(), doc.id))
    .filter(Boolean)
    .reverse();
}

async function getTotalReadingsFromFirestore() {
  if (!db) {
    return historicalReadings.length;
  }

  try {
    const snapshot = await db.collection(FIRESTORE_COLLECTION).count().get();
    return snapshot.data().count;
  } catch (error) {
    console.warn(`⚠️  Could not count Firestore readings (${error.message}).`);
    return null;
  }
}

async function getLatestReading() {
  if (isFirestorePrimary()) {
    return getLatestReadingFromFirestore();
  }

  return historicalReadings.length
    ? historicalReadings[historicalReadings.length - 1]
    : null;
}

async function getHistory(limit) {
  if (isFirestorePrimary()) {
    return getHistoryFromFirestore(limit);
  }

  return historicalReadings.slice(-limit);
}

async function getTotalReadings() {
  if (isFirestorePrimary()) {
    return getTotalReadingsFromFirestore();
  }

  return historicalReadings.length;
}

app.get("/health", async (req, res) => {
  try {
    const [latestReading, totalReadings] = await Promise.all([
      getLatestReading(),
      getTotalReadings(),
    ]);

    res.json({
      status: "ok",
      storageMode,
      firebaseEnabled: Boolean(db),
      firestoreCollection: db ? FIRESTORE_COLLECTION : null,
      totalReadings,
      latestReadingAt: latestReading ? latestReading.lastUpdated : null,
      manholeDepthCm: MANHOLE_DEPTH_CM,
      thresholds,
      apiBase: `http://localhost:${PORT}`,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/sensor/latest", async (req, res) => {
  try {
    res.json({
      storageMode,
      totalReadings: await getTotalReadings(),
      reading: await getLatestReading(),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/sensor/history", async (req, res) => {
  try {
    const requestedLimit = Number.parseInt(req.query.limit, 10);
    const limit = clamp(
      Number.isFinite(requestedLimit) ? requestedLimit : 20,
      1,
      MAX_HISTORY
    );

    res.json({
      storageMode,
      totalReadings: await getTotalReadings(),
      readings: await getHistory(limit),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/sensor", async (req, res) => {
  try {
    const reading = normalizeSensorData(req.body);

    if (!reading) {
      return res.status(400).json({
        error: "Expected numeric ch4, h2s, and water fields in the sensor payload.",
      });
    }

    let firebaseDocId = null;

    if (isFirestorePrimary()) {
      firebaseDocId = await storeReadingInFirestore(reading);
    }

    addReading(reading);

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
  console.log(`🗂️  Storage mode: ${storageMode}`);
  if (db) {
    console.log(`🔥 Firestore collection: ${FIRESTORE_COLLECTION}`);
  }
  console.log("");
});
