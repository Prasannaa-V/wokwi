# Manhole Monitoring System - Dashboard Integration

Complete real-time monitoring system integrating Wokwi ESP32 simulator with React dashboard via Firebase.

## Architecture

```
Wokwi Simulation → Firebase Bridge → Firestore Database → React Dashboard
```

## Setup Instructions

### 1. Firebase Setup

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create/select project: `manhole-monitoring-e5d2b`
3. Create Firestore Database (test mode)
4. Download service account key:
   - Go to **Project Settings** → **Service Accounts**
   - Click **Generate New Private Key**
   - Save as `serviceAccountKey.json` in this folder
   - **Never commit this file!**

### 2. React Dashboard Setup

```bash
cd Sewerly
npm install
npm run dev
```

Dashboard runs at: **http://localhost:3000**

### 3. Firebase Bridge Setup

```bash
# Install Node.js dependencies
npm install

# Start the bridge (port 3001)
node bridge.js
```

Bridge endpoint: **http://localhost:3001/api/sensor**

### 4. Start Data Stream

**Option A: Continuous Test Data**
```bash
node continuous-data.js
```

**Option B: From Wokwi Simulation**
```bash
# Terminal 1: Run Wokwi
wokwi simulate . > wokwi_output.log 2>&1

# Terminal 2: Watch Wokwi output and send to Firebase
python watch_wokwi_file.py
```

## Running Everything

### Quick Start (3 terminals)

**Terminal 1: Firebase Bridge**
```bash
cd c:\Users\sw\Downloads\Manhole
node bridge.js
```

**Terminal 2: React Dashboard**
```bash
cd c:\Users\sw\Downloads\Manhole\Sewerly
npm run dev
```

**Terminal 3: Data Stream**
```bash
cd c:\Users\sw\Downloads\Manhole
node continuous-data.js
```

Then open http://localhost:3000 to see live updates!

## File Structure

```
Manhole/
├── src/main.cpp                 # ESP32 code (outputs JSON)
├── bridge.js                    # Express server (Firebase bridge)
├── continuous-data.js           # Simulated sensor stream
├── watch_wokwi_file.py         # Python file watcher for Wokwi output
├── test-data.js                 # One-time test data sender
├── serviceAccountKey.json       # Firebase credentials (NEVER COMMIT)
├── .env.example                 # Environment variables template
└── Sewerly/                      # React dashboard
    ├── src/
    │   └── utils/firebase.js    # Firebase configuration & listeners
    └── package.json
```

## Data Flow

1. **ESP32 generates JSON**: `{"ch4": 117, "h2s": 1.0, "water": 0.0, "alert": false}`
2. **Bridge receives** via HTTP POST to `/api/sensor`
3. **Firestore stores** in `sensor_readings` collection
4. **Dashboard subscribes** via Firestore listeners
5. **Charts & alerts** update in real-time

## Features

✅ Real-time sensor data streaming
✅ Live metric cards (H2S, CH4, Water Level)
✅ Historical trend charts
✅ Automatic alert generation
✅ Firebase real-time listeners
✅ Responsive React UI with Tailwind CSS

## Troubleshooting

**Dashboard not updating?**
- Check browser console (F12) for Firebase connection errors
- Ensure `continuous-data.js` or `watch_wokwi_file.py` is running
- Verify Firestore rules allow public read access

**Bridge not receiving data?**
- Check firebasebridge logs: `node bridge.js`
- Verify Firestore credentials (`serviceAccountKey.json`) exists
- Test with: `node test-data.js`

**Firestore permission errors?**
- Go to Firebase Console → Firestore Database → Rules
- Set to test mode (allows all reads/writes) for development

## Production Notes

⚠️ For production:
- Use environment variables for credentials
- Implement proper Firestore security rules
- Add authentication to React dashboard
- Use HTTPS for bridge endpoint
- Monitor Firebase costs

## Next Steps

- [ ] Add historical data filtering
- [ ] Implement user authentication
- [ ] Export data to CSV
- [ ] Mobile app version
- [ ] SMS/Email alerts
- [ ] Predictive analytics
