/* ============================================================
 * SISTEM DETEKSI GEMPA - ESP32
 * Sensor : SW420 (getaran awal), MPU6050 (getaran lanjutan), PIR (gerak manusia)
 * Output : LED, Buzzer, Servo (pintu), LCD I2C
 * Kirim data ke Backend (Railway) via HTTP POST setiap ada perubahan status
 * ============================================================
 *
 * LIBRARY YANG HARUS DIINSTALL (Arduino IDE > Library Manager):
 * - "Adafruit MPU6050" by Adafruit
 * - "Adafruit Unified Sensor" by Adafruit (dependency)
 * - "LiquidCrystal I2C" by Frank de Brabander
 * - "ESP32Servo" by Kevin Harrington
 * - ArduinoJson by Benoit Blanchon
 * (WiFi.h dan HTTPClient.h sudah bawaan board ESP32)
 * ============================================================ */

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>
#include <LiquidCrystal_I2C.h>
#include <ESP32Servo.h>

// ================== KONFIGURASI WIFI & BACKEND ==================
const char* WIFI_SSID     = "NAMA_WIFI_ANDA";
const char* WIFI_PASSWORD = "PASSWORD_WIFI_ANDA";

// Ganti dengan URL backend Railway kamu, contoh: https://gempa-backend.up.railway.app
const char* BACKEND_URL   = "https://GANTI-DENGAN-URL-RAILWAY-KAMU.up.railway.app/api/events";
const char* DEVICE_ID     = "esp32-01";

// ================== PIN CONFIG (sesuai punya kamu) ==================
const int sw420      = 2;
const int pir         = 15;
const int tombolRST   = 4;
const int buzzer      = 12;
const int speaker      = 14;   // opsional, tidak dipakai wajib di logika utama
const int ledBahaya   = 13;
const int servoPin    = 27;
// I2C default ESP32: SDA = 21, SCL = 22 (dipakai otomatis oleh Wire.h untuk LCD & MPU6050)

// ================== OBJEK SENSOR/OUTPUT ==================
Adafruit_MPU6050 mpu;
LiquidCrystal_I2C lcd(0x27, 16, 2);   // Ganti 0x27 jadi 0x3F kalau LCD tidak menyala/blank
Servo pintu;

// ================== KONFIGURASI THRESHOLD MPU6050 ==================
// Getaran "berkelanjutan" gempa dideteksi dari percepatan (accel) yang melebihi ambang ini
const float MPU_THRESHOLD = 1.2;   // satuan m/s^2 di luar gravitasi normal, kalibrasi di lapangan

// ================== STATE MACHINE ==================
enum Kondisi { NORMAL, AKTIVITAS_MANUSIA, GEMPA };
Kondisi statusSaatIni = NORMAL;
Kondisi statusSebelumnya = NORMAL;

unsigned long lastKirim = 0;
const unsigned long INTERVAL_KIRIM = 3000; // kirim heartbeat tiap 3 detik walau status sama

const int SUDUT_TUTUP = 0;
const int SUDUT_BUKA  = 90;

// ==================================================================
void setup() {
  Serial.begin(115200);

  pinMode(sw420, INPUT);
  pinMode(pir, INPUT);
  pinMode(tombolRST, INPUT_PULLUP);
  pinMode(buzzer, OUTPUT);
  pinMode(speaker, OUTPUT);
  pinMode(ledBahaya, OUTPUT);

  digitalWrite(buzzer, LOW);
  digitalWrite(speaker, LOW);
  digitalWrite(ledBahaya, LOW);

  Wire.begin(); // SDA=21, SCL=22 default

  lcd.init();
  lcd.backlight();
  lcd.setCursor(0, 0);
  lcd.print("Inisialisasi...");

  if (!mpu.begin()) {
    Serial.println("MPU6050 tidak terdeteksi!");
    lcd.clear();
    lcd.print("MPU6050 Error!");
    while (1) delay(10);
  }
  mpu.setAccelerometerRange(MPU6050_RANGE_8_G);
  mpu.setGyroRange(MPU6050_RANGE_500_DEG);
  mpu.setFilterBandwidth(MPU6050_BAND_21_HZ);

  pintu.setPeriodHertz(50);
  pintu.attach(servoPin, 500, 2400);
  pintu.write(SUDUT_TUTUP);

  connectWiFi();

  lcd.clear();
  lcd.print("Sistem Siap");
  delay(1000);
}

// ==================================================================
void loop() {
  // Tombol reset manual (opsional): tahan untuk paksa kembali ke NORMAL
  if (digitalRead(tombolRST) == LOW) {
    paksaReset();
  }

  bool sw420Terbaca = digitalRead(sw420) == HIGH;   // sesuaikan HIGH/LOW dengan modul SW420 kamu
  bool pirTerbaca   = digitalRead(pir) == HIGH;
  bool mpuTerbaca   = bacaMPU6050();

  // ============ LOGIKA 3 KONDISI ============
  if (sw420Terbaca && mpuTerbaca && !pirTerbaca) {
    statusSaatIni = GEMPA;
  } else if (pirTerbaca) {
    statusSaatIni = AKTIVITAS_MANUSIA;
  } else {
    statusSaatIni = NORMAL;
  }

  terapkanOutput(statusSaatIni, sw420Terbaca, mpuTerbaca, pirTerbaca);
  tampilkanLCD(statusSaatIni);

  // Kirim data ke backend jika status berubah ATAU sudah lewat interval heartbeat
  bool statusBerubah = (statusSaatIni != statusSebelumnya);
  bool waktunyaKirim  = (millis() - lastKirim >= INTERVAL_KIRIM);

  if (statusBerubah || waktunyaKirim) {
    kirimKeBackend(statusSaatIni, sw420Terbaca, mpuTerbaca, pirTerbaca);
    lastKirim = millis();
  }

  statusSebelumnya = statusSaatIni;
  delay(200); // sampling rate, sesuaikan bila perlu
}

// ==================================================================
bool bacaMPU6050() {
  sensors_event_t a, g, temp;
  mpu.getEvent(&a, &g, &temp);

  // Hitung selisih dari gravitasi normal (~9.8 m/s^2) di sumbu manapun
  float getaranX = abs(a.acceleration.x);
  float getaranY = abs(a.acceleration.y);
  float getaranZ = abs(a.acceleration.z - 9.8);

  float totalGetaran = getaranX + getaranY + getaranZ;
  return totalGetaran > MPU_THRESHOLD;
}

// ==================================================================
void terapkanOutput(Kondisi status, bool sw420On, bool mpuOn, bool pirOn) {
  switch (status) {
    case GEMPA:
      digitalWrite(ledBahaya, HIGH);
      digitalWrite(buzzer, HIGH);
      pintu.write(SUDUT_BUKA);
      break;

    case AKTIVITAS_MANUSIA:
      digitalWrite(ledBahaya, LOW);
      digitalWrite(buzzer, LOW);
      pintu.write(SUDUT_TUTUP);
      break;

    case NORMAL:
    default:
      digitalWrite(ledBahaya, LOW);
      digitalWrite(buzzer, LOW);
      pintu.write(SUDUT_TUTUP);
      break;
  }
}

// ==================================================================
void tampilkanLCD(Kondisi status) {
  static Kondisi statusTerakhirDitampilkan = (Kondisi)-1;
  if (status == statusTerakhirDitampilkan) return; // hindari flicker, update LCD hanya saat berubah
  statusTerakhirDitampilkan = status;

  lcd.clear();
  lcd.setCursor(0, 0);
  switch (status) {
    case GEMPA:
      lcd.print("!! GEMPA !!");
      lcd.setCursor(0, 1);
      lcd.print("Pintu Terbuka");
      break;
    case AKTIVITAS_MANUSIA:
      lcd.print("Aktivitas Manusia");
      lcd.setCursor(0, 1);
      lcd.print("Kondisi Aman");
      break;
    case NORMAL:
    default:
      lcd.print("Kondisi Normal");
      lcd.setCursor(0, 1);
      lcd.print("Semua Aman");
      break;
  }
}

// ==================================================================
void connectWiFi() {
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  lcd.clear();
  lcd.print("Konek WiFi...");
  int percobaan = 0;
  while (WiFi.status() != WL_CONNECTED && percobaan < 30) {
    delay(500);
    Serial.print(".");
    percobaan++;
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi terhubung: " + WiFi.localIP().toString());
  } else {
    Serial.println("\nGagal konek WiFi, lanjut tanpa koneksi (sensor tetap jalan).");
  }
}

// ==================================================================
String namaStatus(Kondisi status) {
  switch (status) {
    case GEMPA: return "GEMPA";
    case AKTIVITAS_MANUSIA: return "AKTIVITAS_MANUSIA";
    default: return "NORMAL";
  }
}

// ==================================================================
void kirimKeBackend(Kondisi status, bool sw420On, bool mpuOn, bool pirOn) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi tidak terhubung, coba reconnect...");
    connectWiFi();
    if (WiFi.status() != WL_CONNECTED) return;
  }

  HTTPClient http;
  http.begin(BACKEND_URL);
  http.addHeader("Content-Type", "application/json");

  StaticJsonDocument<256> doc;
  doc["status"]        = namaStatus(status);
  doc["sw420"]         = sw420On;
  doc["mpu6050"]       = mpuOn;
  doc["pir"]           = pirOn;
  doc["led"]           = (status == GEMPA);
  doc["buzzer"]        = (status == GEMPA);
  doc["pintu_terbuka"] = (status == GEMPA);
  doc["device_id"]     = DEVICE_ID;

  String body;
  serializeJson(doc, body);

  int kodeRespon = http.POST(body);
  if (kodeRespon > 0) {
    Serial.printf("Kirim data OK, kode: %d\n", kodeRespon);
  } else {
    Serial.printf("Gagal kirim data, error: %s\n", http.errorToString(kodeRespon).c_str());
  }
  http.end();
}

// ==================================================================
void paksaReset() {
  statusSaatIni = NORMAL;
  digitalWrite(ledBahaya, LOW);
  digitalWrite(buzzer, LOW);
  pintu.write(SUDUT_TUTUP);
  lcd.clear();
  lcd.print("Reset Manual");
  delay(1000);
}
