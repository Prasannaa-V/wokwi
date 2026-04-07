#include <Arduino.h>

// Pin Definitions
#define TRIG_PIN 5
#define ECHO_PIN 18
#define CH4_PIN 34
#define H2S_PIN 35
#define BUZZER_PIN 4

bool alarmSilenced = false;

// ADC smoothing - keep last 5 readings for averaging
const int SMOOTH_COUNT = 5;
int ch4_buffer[SMOOTH_COUNT] = {0};
int h2s_buffer[SMOOTH_COUNT] = {0};
int ch4_index = 0;
int h2s_index = 0;

// Leak simulation variables
static int leak_ch4 = 1200;   // Start at 586 ppm CH4
static int leak_h2s = 700;    // Start at ~8.5 ppm H2S
static int leak_counter = 0;

int smoothCH4(int new_value) {
  ch4_buffer[ch4_index] = new_value;
  ch4_index = (ch4_index + 1) % SMOOTH_COUNT;
  
  int sum = 0;
  for (int i = 0; i < SMOOTH_COUNT; i++) {
    sum += ch4_buffer[i];
  }
  return sum / SMOOTH_COUNT;
}

int smoothH2S(int new_value) {
  h2s_buffer[h2s_index] = new_value;
  h2s_index = (h2s_index + 1) % SMOOTH_COUNT;
  
  int sum = 0;
  for (int i = 0; i < SMOOTH_COUNT; i++) {
    sum += h2s_buffer[i];
  }
  return sum / SMOOTH_COUNT;
}

void setup() {
  Serial.begin(115200);
  delay(1000);
  
  Serial.println("\n=== Manhole Monitoring System ===");
  Serial.println("Starting simulation...");
  
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  
  Serial.println("Setup complete!");
}

void loop() {
  // ========== GAS LEAK SIMULATION ==========
  // Gradually increase gas levels to simulate a leak
  leak_counter++;
  if (leak_counter > 4) {  // Increment every 5 loops (~5 seconds)
    if (leak_ch4 < 3500) leak_ch4 += 150;   // Increase CH4 toward alert
    if (leak_h2s < 3000) leak_h2s += 100;   // Increase H2S toward alert
    leak_counter = 0;
  }
  
  int ch4_raw = leak_ch4;
  int h2s_raw = leak_h2s;
  // =========================================
  
  // Smooth the readings with separate buffers
  ch4_raw = smoothCH4(ch4_raw);
  h2s_raw = smoothH2S(h2s_raw);

  // Map analog values to PPM 
  float ch4_ppm = map(ch4_raw, 0, 4095, 0, 2000); 
  float h2s_ppm = map(h2s_raw, 0, 4095, 0, 50);

  // Read Ultrasonic Sensor for Water Level
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);
  long duration = pulseIn(ECHO_PIN, HIGH, 30000);
  float distance_cm = (duration > 0) ? (duration * 0.034 / 2) : 0;

  // Threshold Logic: H2S > 10 ppm, CH4 > 1000 ppm, Water < 50 cm
  bool ch4_alert = ch4_ppm > 1000;
  bool h2s_alert = h2s_ppm > 10;
  bool flood_alert = (distance_cm > 0 && distance_cm < 50);

  if ((ch4_alert || h2s_alert || flood_alert) && !alarmSilenced) {
    digitalWrite(BUZZER_PIN, HIGH); // Trigger local alarm
  } else {
    digitalWrite(BUZZER_PIN, LOW);
    if (!ch4_alert && !h2s_alert && !flood_alert) {
      alarmSilenced = false; // Reset silenced state
    }
  }

  // Output JSON for parsing
  // Format: {"ch4":117.5,"h2s":1.2,"water":45.3,"alert":false}
  Serial.print("{\"ch4\":");
  Serial.print(ch4_ppm, 2);
  Serial.print(",\"h2s\":");
  Serial.print(h2s_ppm, 2);
  Serial.print(",\"water\":");
  Serial.print(distance_cm, 2);
  Serial.print(",\"alert\":");
  Serial.print((ch4_alert || h2s_alert || flood_alert) ? "true" : "false");
  Serial.println("}");

  delay(1000);
}