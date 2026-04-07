#!/usr/bin/env python3
"""
Simulate Wokwi output to wokwi_output.log file
This mimics the ESP32 JSON output that the watch_wokwi_file.py watcher reads
Run this while Wokwi simulation is active to send data to the dashboard
"""

import time
import json
import sys

def simulate_sensor_data():
    """Generate realistic sensor data matching ESP32 output"""
    ch4 = 180.0
    h2s = 2.0
    water = 95.0
    
    with open("wokwi_output.log", "w") as f:
        print("\n📝 Creating wokwi_output.log with simulated sensor data...")
        print("💾 Writing JSON output to wokwi_output.log\n")
        
        count = 0
        try:
            while True:
                # Simulate gas leak progression (as in main.cpp)
                ch4 += 35.0 + (count % 3) * 10
                h2s += 0.7 + (count % 2) * 0.4
                water = max(15.0, water - (1.8 + (count % 4) * 0.3))
                
                # Trigger alert when thresholds match the firmware bridge.
                alert = ch4 >= 1000 or h2s >= 10 or (100 - water) >= 50
                
                # Create JSON line matching ESP32 format
                data = {
                    "ch4": round(ch4, 2),
                    "h2s": round(h2s, 2),
                    "water": round(water, 2),
                    "alert": alert
                }
                
                json_line = json.dumps(data)
                f.write(json_line + "\n")
                f.flush()
                
                count += 1
                alert_str = "🚨 ALERT!" if alert else "✓"
                water_level = max(0.0, 100.0 - water)
                print(f"[{count:3d}] {alert_str} CH4: {ch4:7.1f}ppm | H2S: {h2s:6.1f}ppm | Water Level: {water_level:6.1f}cm")
                
                time.sleep(1)
        
        except KeyboardInterrupt:
            print(f"\n\n✅ Simulation stopped after {count} readings")
            print("📊 Data saved to wokwi_output.log")
            sys.exit(0)

if __name__ == "__main__":
    print("""
╔══════════════════════════════════════════════════════════════╗
║         Wokwi Output Simulator - Dashboard Testing          ║
╚══════════════════════════════════════════════════════════════╝

This script generates simulated sensor data that matches your ESP32 output.
The watch_wokwi_file.py watcher will read this and send to dashboard.

HOW TO USE:
1. Keep watch_wokwi_file.py running in Terminal 1
2. Run this script in Terminal 2
3. Watch the data appear on http://localhost:3000
4. Press Ctrl+C to stop

""")
    simulate_sensor_data()
