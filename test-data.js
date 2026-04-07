// Test script to send sample sensor data to the bridge
const http = require('http');

// Sample data points from the Wokwi simulation
const testData = [
  { ch4: 180.0, h2s: 2.0, water: 95.0, source: 'test-sequence' },
  { ch4: 320.0, h2s: 4.5, water: 88.0, source: 'test-sequence' },
  { ch4: 640.0, h2s: 7.2, water: 72.0, source: 'test-sequence' },
  { ch4: 860.0, h2s: 8.8, water: 58.0, source: 'test-sequence' },
  { ch4: 1120.0, h2s: 10.5, water: 46.0, source: 'test-sequence' },
  { ch4: 1360.0, h2s: 14.0, water: 22.0, source: 'test-sequence' },
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
        const parsedBody = JSON.parse(body);
        console.log(`✓ [${parsedBody.reading.ch4} ppm] Stored in ${parsedBody.storageMode}`);
        resolve(parsedBody);
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function run() {
  console.log('\n📤 Sending test data to Wokwi bridge...\n');
  
  for (const data of testData) {
    await sendData(data);
    await new Promise(r => setTimeout(r, 500)); // 500ms delay between sends
  }
  
  console.log('\n✅ All test data sent! Check the dashboard or /api/sensor/history.\n');
}

run().catch(console.error);
