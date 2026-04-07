#!/usr/bin/env python3
"""
Wokwi Output File Watcher - Reads JSON from Wokwi log file and sends to the bridge
"""

import os
import time
import json
import sys
from urllib import request, error

LOG_FILES = ["wokwi_output.log", "wokwi-output.log"]
BRIDGE_URL = "http://localhost:3001/api/sensor"

last_positions = {log_file: 0 for log_file in LOG_FILES}
data_count = 0

def get_active_log_file():
    for log_file in LOG_FILES:
        if os.path.exists(log_file):
            return log_file
    return LOG_FILES[0]

def send_to_bridge(data):
    """Send sensor data to the local bridge without external dependencies"""
    try:
        payload = json.dumps(data).encode("utf-8")
        bridge_request = request.Request(
            BRIDGE_URL,
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with request.urlopen(bridge_request, timeout=5) as response:
            return response.status == 200
    except error.URLError as exc:
        print(f"❌ Bridge error: {exc}")
        return False
    except Exception as exc:
        print(f"❌ Bridge error: {exc}")
        return False

def watch_file():
    """Watch log file for new JSON lines"""
    global data_count
    
    print(f"\n👀 Watching {' or '.join(LOG_FILES)} for sensor data...")
    print(f"📡 Sending to: {BRIDGE_URL}\n")
    print("⏳ Waiting for Wokwi to start...\n")
    
    first_read = True
    
    while True:
        try:
            log_file = get_active_log_file()

            if not os.path.exists(log_file):
                if first_read:
                    print(f"⏳ Waiting for {log_file} to be created...")
                    print("   (Start the simulator with: npm run simulate)\n")
                    first_read = False
                time.sleep(1)
                continue
            
            file_size = os.path.getsize(log_file)
            last_position = last_positions.get(log_file, 0)
            
            if file_size < last_position:
                # File was cleared
                print("🔄 Log file was cleared, resetting position...")
                last_position = 0
                last_positions[log_file] = 0
            
            if file_size > last_position:
                with open(log_file, 'r', encoding='utf-8') as f:
                    f.seek(last_position)
                    lines = f.readlines()
                    last_positions[log_file] = file_size
                    
                    for line in lines:
                        line = line.strip()
                        if line.startswith('{'):
                            try:
                                data = json.loads(line)
                                if 'ch4' in data and 'h2s' in data and 'water' in data:
                                    if send_to_bridge(data):
                                        data_count += 1
                                        alert = "🚨" if data.get('alert') else "✓"
                                        timestamp = time.strftime('%H:%M:%S')
                                        print(f"[{timestamp}] [{data_count}] {alert} CH4: {data['ch4']:7.1f}ppm | H2S: {data['h2s']:6.1f}ppm | Water: {data['water']:7.1f}cm")
                            except json.JSONDecodeError:
                                pass
            
            time.sleep(0.5)
        
        except KeyboardInterrupt:
            print("\n\n✅ Watcher stopped - data sent to bridge")
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
