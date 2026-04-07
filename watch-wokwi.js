// Watch file for new Wokwi JSON data and send it to the local bridge
const fs = require('fs');
const path = require('path');
const http = require('http');

const LOG_FILES = [
  path.join(__dirname, 'wokwi_output.log'),
  path.join(__dirname, 'wokwi-output.log'),
];
const fileOffsets = new Map(LOG_FILES.map((filePath) => [filePath, 0]));

function getActiveLogFile() {
  return LOG_FILES.find((filePath) => fs.existsSync(filePath)) || LOG_FILES[0];
}

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
    const logFile = getActiveLogFile();

    if (!fs.existsSync(logFile)) {
      return;
    }

    const stats = fs.statSync(logFile);
    const fileSize = stats.size;
    const lastPosition = fileOffsets.get(logFile) || 0;

    if (fileSize < lastPosition) {
      // File was cleared/rotated
      fileOffsets.set(logFile, 0);
    }

    const effectivePosition = fileOffsets.get(logFile) || 0;

    if (fileSize > effectivePosition) {
      const readable = fs.createReadStream(logFile, {
        start: effectivePosition,
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
        fileOffsets.set(logFile, fileSize);
      });
    }
  } catch (error) {
    // Silently ignore file read errors
  }
}

console.log('\n👀 Watching for Wokwi output...');
console.log(`📄 Log file: ${LOG_FILES.map((filePath) => path.basename(filePath)).join(' or ')}\n`);
console.log('📌 To redirect Wokwi output to this file:');
console.log('   1. Start the simulator with `npm run simulate`');
console.log('   2. Or run wokwi-cli with `--serial-log-file wokwi_output.log`');
console.log('   3. Then keep this watcher running\n');

// Watch file every 500ms
setInterval(readNewLines, 500);

// Check immediately
readNewLines();
