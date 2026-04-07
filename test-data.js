// Test script to send sample sensor data to the bridge
const http = require('http');

// Sample data points from the Wokwi simulation
const testData = [
  { ch4: 117.00, h2s: 1.00, water: 0.00, alert: false },
  { ch4: 234.00, h2s: 3.00, water: 399.96, alert: false },
  { ch4: 351.00, h2s: 5.00, water: 399.96, alert: false },
  { ch4: 468.00, h2s: 6.00, water: 399.96, alert: false },
  { ch4: 747.00, h2s: 11.00, water: 399.96, alert: true },
  { ch4: 1289.00, h2s: 20.00, water: 399.96, alert: true },
];

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
        console.log(`✓ [${data.ch4}ppm] Sent to Firebase`);
        resolve(JSON.parse(body));
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function run() {
  console.log('\n📤 Sending test data to Firebase Bridge...\n');
  
  for (const data of testData) {
    await sendData(data);
    await new Promise(r => setTimeout(r, 500)); // 500ms delay between sends
  }
  
  console.log('\n✅ All test data sent! Check Firebase Firestore.\n');
}

run().catch(console.error);
