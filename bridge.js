const admin = require("firebase-admin");
const express = require("express");

// Initialize Firebase Admin SDK
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: "manhole-monitoring-e5d2b",
});

const db = admin.firestore();
const app = express();

app.use(express.json());

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "Bridge is running ✓" });
});

// Receive sensor data from ESP32
app.post("/api/sensor", async (req, res) => {
  try {
    const data = req.body;
    console.log("[RECEIVED]", data);

    // Send to Firebase
    const docRef = await db.collection("sensor_readings").add({
      ch4: parseFloat(data.ch4),
      h2s: parseFloat(data.h2s),
      water: parseFloat(data.water),
      alert: data.alert === "true" || data.alert === true,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log("[✓ SENT TO FIREBASE]", docRef.id);
    res.json({ status: "ok", docId: docRef.id });
  } catch (error) {
    console.error("[ERROR]", error.message);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`\n🚀 Firebase Bridge running on http://localhost:${PORT}`);
  console.log(`📡 POST sensor data to: http://localhost:${PORT}/api/sensor`);
  console.log(`💚 Health check: http://localhost:${PORT}/health\n`);
});
