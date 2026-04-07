const { SerialPort } = require('serialport');

async function listPorts() {
  try {
    const ports = await SerialPort.list();
    console.log('\n=== Available Serial Ports ===');
    if (ports.length === 0) {
      console.log('No ports found!');
      return;
    }
    ports.forEach((port, i) => {
      console.log(`${i + 1}. ${port.path}`);
      console.log(`   Manufacturer: ${port.manufacturer || 'Unknown'}`);
      console.log(`   Serial: ${port.serialNumber || 'N/A'}`);
      console.log('');
    });
  } catch (err) {
    console.error('Error listing ports:', err.message);
  }
}

listPorts();
