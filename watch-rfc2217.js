const http = require('http');
const net = require('net');

const RFC2217_PORT = Number(process.env.WOKWI_RFC2217_PORT || 4000);
const RFC2217_HOST = process.env.WOKWI_RFC2217_HOST || '127.0.0.1';
const BRIDGE_PORT = Number(process.env.BRIDGE_PORT || 3001);
const BRIDGE_HOST = process.env.BRIDGE_HOST || '127.0.0.1';
const RECONNECT_DELAY_MS = 2000;

let socket = null;
let reconnectTimer = null;
let lineBuffer = '';
let receivedCount = 0;

let iacMode = false;
let pendingCommand = null;
let inSubnegotiation = false;
let subnegotiationSawIac = false;

function sendData(data) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      ...data,
      source: data.source || 'wokwi-gui',
    });

    const request = http.request(
      {
        hostname: BRIDGE_HOST,
        port: BRIDGE_PORT,
        path: '/api/sensor',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
      },
      (response) => {
        let body = '';
        response.on('data', (chunk) => {
          body += chunk;
        });
        response.on('end', () => {
          if (response.statusCode && response.statusCode >= 200 && response.statusCode < 300) {
            resolve(body ? JSON.parse(body) : {});
            return;
          }

          reject(new Error(`Bridge responded with status ${response.statusCode}`));
        });
      }
    );

    request.on('error', reject);
    request.write(payload);
    request.end();
  });
}

function scheduleReconnect() {
  if (reconnectTimer) {
    return;
  }

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectToSimulator();
  }, RECONNECT_DELAY_MS);
}

function replyToTelnetNegotiation(command, option) {
  if (!socket || socket.destroyed) {
    return;
  }

  const IAC = 255;
  const DONT = 254;
  const WONT = 252;

  if (command === 251) {
    socket.write(Buffer.from([IAC, DONT, option]));
  } else if (command === 253) {
    socket.write(Buffer.from([IAC, WONT, option]));
  }
}

function extractPayload(buffer) {
  const output = [];

  for (const byte of buffer) {
    if (inSubnegotiation) {
      if (subnegotiationSawIac) {
        if (byte === 240) {
          inSubnegotiation = false;
        }
        subnegotiationSawIac = false;
      } else if (byte === 255) {
        subnegotiationSawIac = true;
      }
      continue;
    }

    if (pendingCommand !== null) {
      replyToTelnetNegotiation(pendingCommand, byte);
      pendingCommand = null;
      continue;
    }

    if (iacMode) {
      if (byte === 255) {
        output.push(byte);
      } else if ([251, 252, 253, 254].includes(byte)) {
        pendingCommand = byte;
      } else if (byte === 250) {
        inSubnegotiation = true;
        subnegotiationSawIac = false;
      }
      iacMode = false;
      continue;
    }

    if (byte === 255) {
      iacMode = true;
      continue;
    }

    output.push(byte);
  }

  return Buffer.from(output);
}

async function processLine(line) {
  const trimmedLine = line.trim();
  if (!trimmedLine.startsWith('{')) {
    return;
  }

  try {
    const data = JSON.parse(trimmedLine);
    if (
      Object.prototype.hasOwnProperty.call(data, 'ch4') &&
      Object.prototype.hasOwnProperty.call(data, 'h2s') &&
      (Object.prototype.hasOwnProperty.call(data, 'water') ||
        Object.prototype.hasOwnProperty.call(data, 'waterLevel'))
    ) {
      const response = await sendData(data);
      receivedCount += 1;
      const reading = response.reading || data;
      console.log(
        `✅ [${new Date().toLocaleTimeString()}] [${receivedCount}] CH4=${reading.ch4}ppm H2S=${reading.h2s}ppm WaterLevel=${reading.waterLevel ?? 'n/a'}cm`
      );
    }
  } catch (error) {
    console.error(`❌ Failed to process simulator line: ${error.message}`);
  }
}

function handlePayload(buffer) {
  lineBuffer += buffer.toString('utf8');
  const lines = lineBuffer.split(/\r?\n/);
  lineBuffer = lines.pop() || '';

  for (const line of lines) {
    void processLine(line);
  }
}

function connectToSimulator() {
  console.log(
    `🔌 Connecting to Wokwi VS Code simulator serial port at rfc2217://${RFC2217_HOST}:${RFC2217_PORT}`
  );
  console.log('📌 Start the GUI simulator in VS Code and keep the simulator tab visible.\n');

  socket = net.createConnection(
    {
      host: RFC2217_HOST,
      port: RFC2217_PORT,
    },
    () => {
      console.log('✅ Connected to Wokwi RFC2217 serial server\n');
    }
  );

  socket.on('data', (chunk) => {
    const payload = extractPayload(chunk);
    if (payload.length > 0) {
      handlePayload(payload);
    }
  });

  socket.on('error', (error) => {
    console.log(`⏳ Waiting for GUI simulator: ${error.message}`);
  });

  socket.on('close', () => {
    console.log('🔄 GUI simulator disconnected. Retrying...\n');
    scheduleReconnect();
  });
}

console.log('============================================================');
console.log('🖥️  Wokwi GUI Serial Watcher');
console.log('============================================================');
console.log(`📡 Forwarding simulator data to http://${BRIDGE_HOST}:${BRIDGE_PORT}/api/sensor`);
console.log('');

connectToSimulator();
