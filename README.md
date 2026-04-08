# Manhole Monitoring System

This folder contains the simulator-side pieces that feed the React dashboard in `../sewerly`.

## Supported workflow

The supported live path is:

`Wokwi VS Code sliders -> RFC2217 serial bridge -> local bridge API -> dashboard`

## Main files

- `src/main.cpp`
  Reads the three Wokwi sliders, smooths the values, and prints JSON sensor data once per second.
- `diagram.json`
  Defines the ESP32 and the slider controls in the Wokwi circuit.
- `wokwi.toml`
  Enables RFC2217 serial forwarding from the VS Code Wokwi simulator.
- `watch-rfc2217.js`
  Connects to the simulator serial stream and forwards sensor JSON to the local bridge.
- `bridge.js`
  Normalizes readings, stores them in Firestore when configured, and serves the API used by the dashboard.

## How to run it

1. Open the `wokwi` folder in VS Code.
2. Run the VS Code task `System: Start GUI Slider Stack`.
3. Start the Wokwi simulator from the VS Code GUI.
4. Move the sliders and watch the dashboard update.

## Important limitation

The Wokwi VS Code simulator tab must stay visible while using the GUI sliders. If you hide the tab, Wokwi may pause and stop sending serial output.

## Data storage

- Firestore mode:
  Set `SENSOR_STORAGE_BACKEND=firestore` and add Firebase admin credentials in `.env` or `serviceAccountKey.json`. In this mode, the bridge reads and writes from Firestore instead of using `sensor-readings.json` as the main store.
- Local fallback mode:
  If Firestore is not configured, the bridge falls back to `sensor-readings.json`.

## Utility scripts kept on purpose

- `continuous-data.js`
  Sends a continuous sample stream to the bridge when you want to test without Wokwi.
- `test-data.js`
  Sends a single sample payload for quick verification.
