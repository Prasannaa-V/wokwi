#!/usr/bin/env python3
"""
Wokwi Output File Watcher - Reads JSON from Wokwi log file
"""

import os
import time
import json
import requests
import sys

LOG_FILE = "wokwi_output.log"
FIREBASE_BRIDGE_URL = "http://localhost:3001/api/sensor"

last_position = 0
data_count = 0

def send_to_firebase(data):
    """Send sensor data to Firebase bridge"""
    try:
        response = requests.post(FIREBASE_BRIDGE_URL, json=data, timeout=5)
        return response.status_code == 200
    except:
        return False

def watch_file():
    """Watch log file for new JSON lines"""
    global last_position, data_count
    
    print(f"\n👀 Watching {LOG_FILE} for sensor data...\n")
    
    while True:
        try:
            if not os.path.exists(LOG_FILE):
                print(f"⏳ Waiting for {LOG_FILE}...")
                time.sleep(1)
                continue
            
            file_size = os.path.getsize(LOG_FILE)
            
            if file_size < last_position:
                # File was cleared
                last_position = 0
            
            if file_size > last_position:
                with open(LOG_FILE, 'r') as f:
                    f.seek(last_position)
                    lines = f.readlines()
                    last_position = file_size
                    
                    for line in lines:
                        line = line.strip()
                        if line.startswith('{'):
                            try:
                                data = json.loads(line)
                                if 'ch4' in data and 'h2s' in data and 'water' in data:
                                    if send_to_firebase(data):
                                        data_count += 1
                                        alert = "🚨" if data.get('alert') else "✓"
                                        print(f"[{data_count}] {alert} CH4: {data['ch4']}ppm | H2S: {data['h2s']}ppm | Water: {data['water']}cm")
                            except json.JSONDecodeError:
                                pass
            
            time.sleep(0.5)
        
        except KeyboardInterrupt:
            print("\n\n👋 Stopped")
            sys.exit(0)
        except Exception as e:
            print(f"Error: {e}")
            time.sleep(1)

if __name__ == '__main__':
    print("=" * 60)
    print("📝 Wokwi Output File Watcher")
    print("=" * 60)
    print(f"\n📌 Setup Instructions:")
    print(f"   1. In terminal, run: wokwi > wokwi_output.log 2>&1")
    print(f"   2. Or in platformio.ini, add:")
    print(f"      monitor_filters = log2file")
    print(f"   3. Or manually redirect output")
    print(f"\n✅ This script will read from: {LOG_FILE}")
    print(f"📡 And forward to: {FIREBASE_BRIDGE_URL}\n")
    
    watch_file()
