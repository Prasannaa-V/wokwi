#include <Arduino.h>

// Pin Definitions
#define CH4_PIN 34
#define H2S_PIN 35
#define WATER_LEVEL_PIN 32
#define BUZZER_PIN 4

const int ADC_MAX = 1023;
const float CH4_MAX_PPM = 2000.0f;
const float H2S_MAX_PPM = 50.0f;
const float MANHOLE_DEPTH_CM = 100.0f;

// ADC smoothing - keep last 5 readings for averaging
const int SMOOTH_COUNT = 5;
int ch4_buffer[SMOOTH_COUNT] = {0};
int h2s_buffer[SMOOTH_COUNT] = {0};
int water_level_buffer[SMOOTH_COUNT] = {0};
int ch4_index = 0;
int h2s_index = 0;
int water_level_index = 0;

int smoothReading(int new_value, int *buffer, int &index) {
  buffer[index] = new_value;
  index = (index + 1) % SMOOTH_COUNT;

  int sum = 0;
  for (int i = 0; i < SMOOTH_COUNT; i++) {
    sum += buffer[i];
  }
  return sum / SMOOTH_COUNT;
}

float mapToRange(int raw_value, float max_output) {
  float normalized = static_cast<float>(raw_value) / static_cast<float>(ADC_MAX);
  normalized = constrain(normalized, 0.0f, 1.0f);
  return normalized * max_output;
}

void setup() {
  Serial.begin(115200);
  delay(1000);

  analogReadResolution(10);

  Serial.println("\n=== Manhole Monitoring System ===");
  Serial.println("Starting manual sensor control mode...");
  Serial.println("Use the Wokwi sliders to control CH4, H2S, and water level.");

  pinMode(BUZZER_PIN, OUTPUT);

  Serial.println("Setup complete!");
}

void loop() {
  int ch4_raw = smoothReading(analogRead(CH4_PIN), ch4_buffer, ch4_index);
  int h2s_raw = smoothReading(analogRead(H2S_PIN), h2s_buffer, h2s_index);
  int water_level_raw = smoothReading(
    analogRead(WATER_LEVEL_PIN),
    water_level_buffer,
    water_level_index
  );

  float ch4_ppm = mapToRange(ch4_raw, CH4_MAX_PPM);
  float h2s_ppm = mapToRange(h2s_raw, H2S_MAX_PPM);
  float water_level_cm = mapToRange(water_level_raw, MANHOLE_DEPTH_CM);
  float distance_cm = MANHOLE_DEPTH_CM - water_level_cm;

  // Threshold Logic: H2S > 10 ppm, CH4 > 1000 ppm, Water < 50 cm
  bool ch4_alert = ch4_ppm > 1000;
  bool h2s_alert = h2s_ppm > 10;
  bool flood_alert = water_level_cm >= 50;

  if (ch4_alert || h2s_alert || flood_alert) {
    digitalWrite(BUZZER_PIN, HIGH); // Trigger local alarm
  } else {
    digitalWrite(BUZZER_PIN, LOW);
  }

  // Output JSON for parsing
  // Format: {"ch4":117.5,"h2s":1.2,"water":45.3,"alert":false}
  Serial.print("{\"ch4\":");
  Serial.print(ch4_ppm, 2);
  Serial.print(",\"h2s\":");
  Serial.print(h2s_ppm, 2);
  Serial.print(",\"water\":");
  Serial.print(distance_cm, 2);
  Serial.print(",\"waterLevel\":");
  Serial.print(water_level_cm, 2);
  Serial.print(",\"alert\":");
  Serial.print((ch4_alert || h2s_alert || flood_alert) ? "true" : "false");
  Serial.println("}");

  delay(1000);
}
