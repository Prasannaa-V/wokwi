#!/usr/bin/env python3
"""
Wokwi Output File Watcher - Reads JSON from Wokwi log file and sends to Firebase
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
    except Exception as e:
        print(f"❌ Firebase error: {e}")
        return False

def watch_file():
    """Watch log file for new JSON lines"""
    global last_position, data_count
    
    print(f"\n👀 Watching {LOG_FILE} for sensor data...")
    print(f"📡 Sending to: {FIREBASE_BRIDGE_URL}\n")
    print("⏳ Waiting for Wokwi to start...\n")
    
    first_read = True
    
    while True:
        try:
            if not os.path.exists(LOG_FILE):
                if first_read:
                    print(f"⏳ Waiting for {LOG_FILE} to be created...")
                    print("   (Make sure Wokwi is running: wokwi simulate . > wokwi_output.log)\n")
                    first_read = False
                time.sleep(1)
                continue
            
            file_size = os.path.getsize(LOG_FILE)
            
            if file_size < last_position:
                # File was cleared
                print("🔄 Log file was cleared, resetting position...")
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
                                        timestamp = time.strftime('%H:%M:%S')
                                        print(f"[{timestamp}] [{data_count}] {alert} CH4: {data['ch4']:7.1f}ppm | H2S: {data['h2s']:6.1f}ppm | Water: {data['water']:7.1f}cm")
                            except json.JSONDecodeError:
                                pass
            
            time.sleep(0.5)
        
        except KeyboardInterrupt:
            print("\n\n✅ Watcher stopped - data sent to Firebase")
            print(f"📊 Total readings: {data_count}")
            print("📲 Check http://localhost:3000 for live dashboard!\n")
            sys.exit(0)
        except Exception as e:
            print(f"❌ Error: {e}")
            time.sleep(1)

if __name__ == '__main__':
    print("=" * 60)
    print("📝 Wokwi Output File Watcher")
    print("=" * 60)
    
    watch_file()
