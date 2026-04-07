// Watch file for new Wokwi JSON data and send to Firebase
const fs = require('fs');
const path = require('path');
const http = require('http');

const LOG_FILE = path.join(__dirname, 'wokwi-output.log');
let lastPosition = 0;

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
      res.on('end', () => resolve(JSON.parse(body)));
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function readNewLines() {
  try {
    if (!fs.existsSync(LOG_FILE)) {
      return;
    }

    const stats = fs.statSync(LOG_FILE);
    const fileSize = stats.size;

    if (fileSize < lastPosition) {
      // File was cleared/rotated
      lastPosition = 0;
    }

    if (fileSize > lastPosition) {
      const readable = fs.createReadStream(LOG_FILE, {
        start: lastPosition,
        encoding: 'utf8'
      });

      let buffer = '';

      readable.on('data', async (chunk) => {
        buffer += chunk;
        const lines = buffer.split('\n');

        // Keep last incomplete line in buffer
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          
          // Skip non-JSON lines
          if (!trimmed.startsWith('{')) {
            continue;
          }

          try {
            const data = JSON.parse(trimmed);
            
            // Validate it has the fields we need
            if (data.hasOwnProperty('ch4') && data.hasOwnProperty('h2s') && data.hasOwnProperty('water')) {
              await sendData(data);
              console.log(`✅ [${new Date().toLocaleTimeString()}] Sent: CH4=${data.ch4}ppm H2S=${data.h2s}ppm Water=${data.water}cm`);
            }
          } catch (e) {
            // Ignore parse errors for non-JSON lines
          }
        }
      });

      readable.on('end', () => {
        lastPosition = fileSize;
      });
    }
  } catch (error) {
    // Silently ignore file read errors
  }
}

console.log('\n👀 Watching for Wokwi output...');
console.log(`📄 Log file: ${LOG_FILE}\n`);
console.log('📌 To redirect Wokwi output to this file:');
console.log('   1. Stop the Wokwi simulation');
console.log('   2. Redirect serial output: `wokwi > wokwi-output.log 2>&1`');
console.log('   3. Or manually configure PlatformIO monitor_speed in platformio.ini\n');

// Watch file every 500ms
setInterval(readNewLines, 500);

// Check immediately
readNewLines();
