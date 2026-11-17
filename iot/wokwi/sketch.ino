// InovaCity - Módulo IoT (ESP32 no Wokwi)
// Sensores: DHT22 (temperatura e umidade) com dados no GPIO13 e HC-SR04 (obstrução de calçada) TRIG=GPIO23 / ECHO=GPIO22
// Publica JSON via MQTT em inovacity/bairro-piloto/poste01/leituras
#include <WiFi.h>
#include <PubSubClient.h>
#include <DHT.h>

const char* WIFI_SSID = "Wokwi-GUEST";   // rede padrão do simulador
const char* WIFI_PASS = "";
const char* MQTT_HOST = "broker.hivemq.com"; // broker público (apenas para demonstração; sem dados pessoais)
const int   MQTT_PORT = 1883;
const char* TOPICO    = "inovacity/bairro-piloto/poste01/leituras";
const char* DEVICE_ID = "poste01";

const int PIN_DHT = 13, PIN_TRIG = 22, PIN_ECHO = 23;
DHT dht(PIN_DHT, DHT22);
WiFiClient wifi; PubSubClient mqtt(wifi);

float lerDistanciaCm() {
  digitalWrite(PIN_TRIG, LOW); delayMicroseconds(2);
  digitalWrite(PIN_TRIG, HIGH); delayMicroseconds(10);
  digitalWrite(PIN_TRIG, LOW);
  long dur = pulseIn(PIN_ECHO, HIGH, 30000);
  if (dur == 0) return -1;            // sem eco
  return dur * 0.0343f / 2.0f;
}

void conectar() {
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  while (WiFi.status() != WL_CONNECTED) { delay(300); Serial.print("."); }
  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  while (!mqtt.connected()) {
    String id = String("inovacity-") + DEVICE_ID + "-" + String(random(0xffff), HEX);
    if (!mqtt.connect(id.c_str())) delay(1000);
  }
  Serial.println("\nMQTT conectado");
}

void setup() {
  Serial.begin(115200);
  pinMode(PIN_TRIG, OUTPUT); pinMode(PIN_ECHO, INPUT);
  dht.begin();
  conectar();
}

void loop() {
  if (!mqtt.connected()) conectar();
  mqtt.loop();
  float temp = dht.readTemperature();         // °C
  float umid = dht.readHumidity();            // % de umidade relativa
  float dist = lerDistanciaCm();
  if (isnan(temp) || isnan(umid)) { Serial.println("Falha na leitura do DHT22"); delay(2000); return; }
  char msg[200];
  snprintf(msg, sizeof(msg),
    "{\"device\":\"%s\",\"temp_c\":%.1f,\"umid\":%.1f,\"dist_cm\":%.1f,\"uptime_s\":%lu}",
    DEVICE_ID, temp, umid, dist, millis() / 1000);
  mqtt.publish(TOPICO, msg);
  Serial.println(msg);
  delay(5000);
}
