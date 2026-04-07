#!/usr/bin/env python3
"""
Wokwi Serial to Firebase Bridge
Reads JSON sensor data from Wokwi serial port and sends to Firebase
"""

import serial
import serial.tools.list_ports
import json
import requests
import time
import sys

FIREBASE_BRIDGE_URL = "http://localhost:3001/api/sensor"
BAUD_RATE = 115200

def find_wokwi_port():
    """Detect which COM port Wokwi is using"""
    ports = serial.tools.list_ports.comports()
    
    print("\n🔍 Available Serial Ports:")
    for port in ports:
        print(f"  • {port.device} - {port.description}")
    
    if not ports:
        print("❌ No serial ports found!")
        return None
    
    # Try each port
    for port in ports:
        try:
            print(f"\n🔌 Trying {port.device}...")
            ser = serial.Serial(port.device, BAUD_RATE, timeout=2)
            
            # Read a few lines to see if it's Wokwi
            for _ in range(5):
                line = ser.readline().decode('utf-8', errors='ignore').strip()
                if 'Manhole Monitoring' in line or 'CH4' in line or '{"ch4"' in line:
                    print(f"✅ Found Wokwi on {port.device}")
                    ser.close()
                    return port.device
            
            ser.close()
        except Exception as e:
            pass
    
    print("⚠️  Could not auto-detect Wokwi port")
    return None

def send_to_firebase(data):
    """Send sensor data to Firebase bridge"""
    try:
        response = requests.post(FIREBASE_BRIDGE_URL, json=data, timeout=5)
        if response.status_code == 200:
            return True
    except Exception as e:
        print(f"❌ Error sending to Firebase: {e}")
    return False

def read_wokwi(port_name):
    """Read from Wokwi serial port and send JSON to Firebase"""
    try:
        ser = serial.Serial(port_name, BAUD_RATE, timeout=1)
        print(f"\n🚀 Reading from {port_name} at {BAUD_RATE} baud")
        print(f"📡 Forwarding to: {FIREBASE_BRIDGE_URL}\n")
        
        data_count = 0
        
        while True:
            try:
                line = ser.readline().decode('utf-8', errors='ignore').strip()
                
                if not line:
                    continue
                
                # Look for JSON lines
                if line.startswith('{'):
                    try:
                        data = json.loads(line)
                        
                        # Validate required fields
                        if 'ch4' in data and 'h2s' in data and 'water' in data:
                            if send_to_firebase(data):
                                data_count += 1
                                alert_str = "🚨 ALERT" if data.get('alert') else "✓"
                                print(f"[{data_count}] {alert_str} | CH4: {data['ch4']}ppm | H2S: {data['h2s']}ppm | Water: {data['water']}cm")
                    except json.JSONDecodeError:
                        pass
            
            except Exception as e:
                print(f"Error reading line: {e}")
                time.sleep(0.1)
    
    except serial.SerialException as e:
        print(f"❌ Serial error: {e}")
        print("Make sure Wokwi is running and the port is correct")
    except KeyboardInterrupt:
        print("\n\n👋 Stopped")
        sys.exit(0)

if __name__ == '__main__':
    print("=" * 60)
    print("🌐 Wokwi Serial to Firebase Bridge")
    print("=" * 60)
    
    # Auto-detect port
    port = find_wokwi_port()
    
    if not port:
        print("\n⚙️  Manual configuration:")
        print("Edit this script and set port_name manually")
        sys.exit(1)
    
    # Read and forward data
    read_wokwi(port)
