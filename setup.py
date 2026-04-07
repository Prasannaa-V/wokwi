#!/usr/bin/env python3
"""
Complete Setup Script - Start Everything for Real Wokwi Integration
Captures Wokwi output and streams to dashboard
"""

import subprocess
import time
import sys
import os

def print_header(title):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}\n")

def main():
    print_header("🚀 Manhole Monitoring - Complete Setup")
    
    print("📌 IMPORTANT: Follow these steps in order\n")
    
    print("STEP 1: Start Firebase Bridge")
    print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    print("Run in Terminal 1:")
    print("  cd c:\\Users\\sw\\Downloads\\Manhole")
    print("  node bridge.js")
    print("\n✓ Wait until you see: '🚀 Firebase Bridge running on http://localhost:3001'\n")
    
    print("STEP 2: Start React Dashboard")
    print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    print("Run in Terminal 2:")
    print("  cd c:\\Users\\sw\\Downloads\\Manhole\\Sewerly")
    print("  npm run dev")
    print("\n✓ Wait until you see: '➜  Local:   http://localhost:3000/'\n")
    
    print("STEP 3: Start Wokwi Watcher")
    print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    print("Run in Terminal 3 (this one):")
    print("  python watch_wokwi_file.py")
    print("\n✓ The watcher will wait for Wokwi output...\n")
    
    print("STEP 4: Start Wokwi Simulation")
    print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    print("Run in Terminal 4:")
    print("  cd c:\\Users\\sw\\Downloads\\Manhole")
    print("  wokwi simulate . > wokwi_output.log 2>&1")
    print("\nOR click the Play button in VS Code Wokwi extension\n")
    
    print("STEP 5: Watch the Magic!")
    print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    print("Open http://localhost:3000 in your browser")
    print("You should see REAL Wokwi data updating live!\n")
    
    print("="*60)
    print("🔄 Now starting the Wokwi file watcher...")
    print("="*60 + "\n")
    
    # Start the watcher
    try:
        subprocess.run([sys.executable, "watch_wokwi_file.py"])
    except KeyboardInterrupt:
        print("\n\n👋 Watcher stopped")
        sys.exit(0)

if __name__ == '__main__':
    main()
