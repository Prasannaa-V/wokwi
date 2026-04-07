#!/usr/bin/env python3
"""
Wokwi Serial Bridge - Reads JSON data from Wokwi simulation and sends to Firebase
"""

import serial
import json
import requests
import time
import sys
from pathlib import Path

# Configuration
BRIDGE_URL = "http://localhost:3001/api/sensor"
BAUD_RATE = 115200
TIMEOUT = 2

def find_wokwi_port():
    """Find Wokwi serial port"""
    import serial.tools.list_ports
    
    ports = serial.tools.list_ports.comports()
    
    print("\n📋 Available Serial Ports:")
    for i, port in enumerate(ports, 1):
        print(f"  {i}. {port.device} - {port.description}")
    
    if not ports:
        print("❌ No serial ports found!")
        return None
    
    # Try to detect Wokwi (usually shows as "Microsoft" USB device)
    for port in ports:
        if "Wokwi" in port.description or "usbserial" in port.description:
            return port.device
    
    # Default to first port
    return ports[0].device if ports else None

def send_to_firebase(data):
    """Send sensor data to Firebase bridge"""
    try:
        headers = {"Content-Type": "application/json"}
        response = requests.post(BRIDGE_URL, json=data, headers=headers, timeout=5)
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ [{time.strftime('%H:%M:%S')}] Sent: CH4={data['ch4']} ppm | H2S={data['h2s']} ppm | Water={data['water']} cm | Alert={data['alert']}")
            return True
        else:
            print(f"❌ Bridge error: {response.status_code}")
            return False
    except requests.exceptions.ConnectionError:
        print("⚠️  Bridge not running at http://localhost:3001")
        return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def main():
    print("\n🔌 Wokwi Serial Bridge - Connecting to Simulation")
    print("=" * 50)
    
    # Find port
    port_name = find_wokwi_port()
    if not port_name:
        print("❌ Could not find Wokwi port. Make sure Wokwi simulation is running!")
        return
    
    print(f"\n📡 Using port: {port_name}")
    print(f"🌐 Forwarding to: {BRIDGE_URL}\n")
    
    try:
        # Open serial connection
        ser = serial.Serial(port_name, BAUD_RATE, timeout=TIMEOUT)
        print(f"✅ Connected to {port_name}\n")
        print("Waiting for data from Wokwi...\n")
        
        buffer = ""
        
        while True:
            try:
                # Read data
                if ser.in_waiting:
                    char = ser.read(1).decode('utf-8', errors='ignore')
                    buffer += char
                    
                    # Check for complete JSON line
                    if char == '\n':
                        line = buffer.strip()
                        buffer = ""
                        
                        # Skip non-JSON lines
                        if not line.startswith('{'):
                            continue
                        
                        try:
                            data = json.loads(line)
                            
                            # Validate data
                            if all(k in data for k in ['ch4', 'h2s', 'water', 'alert']):
                                send_to_firebase(data)
                        except json.JSONDecodeError:
                            pass
                
            except KeyboardInterrupt:
                print("\n\n🛑 Stopped by user")
                break
            except Exception as e:
                print(f"Error reading serial: {e}")
                time.sleep(1)
    
    finally:
        if 'ser' in locals() and ser.is_open:
            ser.close()
            print("✅ Serial connection closed")

if __name__ == "__main__":
    main()
