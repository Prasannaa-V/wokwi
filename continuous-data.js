// Continuous sensor data sender - simulates Wokwi firmware output
const http = require('http');

const MANHOLE_DEPTH_CM = 100;
const manualCh4 = Number.parseFloat(process.env.CH4 ?? '');
const manualH2s = Number.parseFloat(process.env.H2S ?? '');
const manualWaterLevel = Number.parseFloat(process.env.WATER_LEVEL ?? '');
const manualMode =
  Number.isFinite(manualCh4) ||
  Number.isFinite(manualH2s) ||
  Number.isFinite(manualWaterLevel);

// Simulated sensor state (matches the ESP32 leak progression)
let ch4 = 180;
let h2s = 2;
let water = 95; // Ultrasonic distance from sensor to water surface
let counter = 0;

function sendData(data) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(data);
    
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: '/api/sensor',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': payload.length
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        resolve(JSON.parse(body));
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function generateAndSendData() {
  let data;

  if (manualMode) {
    const resolvedWaterLevel = Number.isFinite(manualWaterLevel)
      ? Math.min(Math.max(manualWaterLevel, 0), MANHOLE_DEPTH_CM)
      : MANHOLE_DEPTH_CM - water;

    data = {
      ch4: Number.isFinite(manualCh4) ? manualCh4 : parseFloat(ch4.toFixed(2)),
      h2s: Number.isFinite(manualH2s) ? manualH2s : parseFloat(h2s.toFixed(2)),
      waterLevel: parseFloat(resolvedWaterLevel.toFixed(2)),
      water: parseFloat((MANHOLE_DEPTH_CM - resolvedWaterLevel).toFixed(2)),
      source: 'continuous-simulator-manual',
    };
  } else {
    // Simulate the Wokwi leak pattern - gradually increasing gas and rising water.
    counter++;
    if (counter > 4) {
      if (ch4 < 1500) ch4 += 140;
      if (h2s < 18) h2s += 1.5;
      if (water > 18) water -= 6;
      counter = 0;
    }

    data = {
      ch4: parseFloat(ch4.toFixed(2)),
      h2s: parseFloat(h2s.toFixed(2)),
      water: parseFloat((water + (Math.random() - 0.5) * 2).toFixed(2)),
      source: 'continuous-simulator',
    };
  }

  try {
    const response = await sendData(data);
    const reading = response.reading;
    console.log(
      `📤 [${new Date().toLocaleTimeString()}] CH4: ${reading.ch4} ppm | H2S: ${reading.h2s} ppm | Water Level: ${reading.waterLevel}/${MANHOLE_DEPTH_CM} cm | ${reading.status}`
    );
  } catch (error) {
    console.error('❌ Error sending data:', error.message);
  }
}

console.log('\n🚀 Starting continuous sensor data stream...');
console.log('📡 Sending Wokwi-compatible data to http://localhost:3001/api/sensor');
if (manualMode) {
  console.log(
    `🎛️  Manual mode enabled: CH4=${Number.isFinite(manualCh4) ? manualCh4 : 'auto'}, H2S=${Number.isFinite(manualH2s) ? manualH2s : 'auto'}, WATER_LEVEL=${Number.isFinite(manualWaterLevel) ? manualWaterLevel : 'auto'}`
  );
}
console.log('');

// Send data every 2 seconds
setInterval(generateAndSendData, 2000);

// Send first data immediately
generateAndSendData();
