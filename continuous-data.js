// Continuous sensor data sender - simulates Wokwi simulator output
const http = require('http');

// Simulated sensor state (matches Wokwi leak pattern)
let ch4 = 117;
let h2s = 1;
let water = 0;
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
  // Simulate the Wokwi leak pattern - gradually increasing values
  counter++;
  if (counter > 4) {
    if (ch4 < 3500) ch4 += 150;
    if (h2s < 3000) h2s += 100;
    counter = 0;
  }

  // Add some randomness to water level
  water = 399.96 + (Math.random() - 0.5) * 10;

  const data = {
    ch4: parseFloat(ch4.toFixed(2)),
    h2s: parseFloat(h2s.toFixed(2)),
    water: parseFloat(water.toFixed(2)),
    alert: ch4 > 1000 || h2s > 15 || water > 50
  };

  try {
    await sendData(data);
    console.log(`📤 [${new Date().toLocaleTimeString()}] CH4: ${data.ch4} ppm | H2S: ${data.h2s} ppm | Alert: ${data.alert ? 'YES' : 'NO'}`);
  } catch (error) {
    console.error('❌ Error sending data:', error.message);
  }
}

console.log('\n🚀 Starting continuous sensor data stream...');
console.log('📡 Sending to http://localhost:3001/api/sensor\n');

// Send data every 2 seconds
setInterval(generateAndSendData, 2000);

// Send first data immediately
generateAndSendData();
