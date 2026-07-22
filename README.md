# Sistem Deteksi Gempa (ESP32 + Railway + Vercel + Supabase)

Struktur folder:
```
project/
├── esp32_gempa/esp32_gempa.ino   # Firmware ESP32
├── backend/                       # Express API -> deploy ke Railway
├── frontend/                      # React (Vite) dashboard -> deploy ke Vercel
└── supabase_schema.sql            # Skema database
```

## 1. Setup Supabase (database)
1. Buat project baru di https://supabase.com
2. Buka **SQL Editor** > jalankan seluruh isi file `supabase_schema.sql`
3. Buka **Project Settings > API**, catat:
   - `Project URL` → dipakai sebagai `SUPABASE_URL`
   - `service_role` key (bukan `anon`!) → dipakai sebagai `SUPABASE_SERVICE_ROLE_KEY` di backend

## 2. Deploy Backend ke Railway
1. Push folder `backend/` ke repo GitHub (bisa 1 repo dengan `frontend/`, root directory beda)
2. Di https://railway.app → New Project → Deploy from GitHub repo
3. Set **Root Directory** ke `backend`
4. Railway otomatis jalankan `npm install` lalu `npm start` (karena ada `package.json`)
5. Di tab **Variables**, tambahkan:
   - `SUPABASE_URL` = URL project supabase kamu
   - `SUPABASE_SERVICE_ROLE_KEY` = service role key supabase kamu
   - `PORT` = 3000 (Railway biasanya override otomatis, tidak masalah)
6. Setelah deploy sukses, Railway kasih URL publik, contoh:
   `https://gempa-backend-production.up.railway.app`
7. Test: buka `https://URL-KAMU/` di browser, harus muncul `{"status":"ok", ...}`

## 3. Deploy Frontend ke Vercel
1. Di https://vercel.com → New Project → Import repo GitHub yang sama
2. Set **Root Directory** ke `frontend`
3. Framework preset: **Vite** (otomatis terdeteksi)
4. Tambahkan Environment Variable:
   - `VITE_BACKEND_URL` = URL backend Railway kamu (dari langkah 2, TANPA trailing slash)
5. Deploy. Vercel akan kasih URL seperti `https://gempa-dashboard.vercel.app`

## 4. Setup Firmware ESP32
1. Install library di Arduino IDE: **Adafruit MPU6050**, **Adafruit Unified Sensor**,
   **LiquidCrystal I2C** (Frank de Brabander), **ESP32Servo**, **ArduinoJson**
2. Buka `esp32_gempa/esp32_gempa.ino`, ganti bagian atas:
   ```cpp
   const char* WIFI_SSID     = "NAMA_WIFI_ANDA";
   const char* WIFI_PASSWORD = "PASSWORD_WIFI_ANDA";
   const char* BACKEND_URL   = "https://URL-BACKEND-RAILWAY-KAMU/api/events";
   ```
3. Wiring sesuai pin yang sudah kamu tentukan:
   - SW420 → GPIO 2
   - PIR → GPIO 15
   - Tombol reset → GPIO 4 (pakai INPUT_PULLUP, tombol ke GND)
   - Buzzer → GPIO 12
   - Speaker (opsional) → GPIO 14
   - LED bahaya → GPIO 13
   - Servo pintu → GPIO 27
   - MPU6050 & LCD I2C → SDA=GPIO 21, SCL=GPIO 22 (default I2C ESP32)
4. Upload ke ESP32, buka Serial Monitor (115200 baud) untuk lihat status koneksi WiFi & pengiriman data
5. **Kalibrasi**: nilai `MPU_THRESHOLD` di kode (default `1.2`) mungkin perlu disesuaikan
   sesuai sensitivitas sensor & tempat pemasangan — uji coba dengan getaran ringan vs kuat

## 5. Alur kerja sistem
- ESP32 baca sensor tiap 200ms, tentukan kondisi (GEMPA / AKTIVITAS_MANUSIA / NORMAL)
- ESP32 kontrol output (LED, buzzer, servo, LCD) langsung secara lokal — **tidak** menunggu server
- ESP32 kirim data ke backend Railway setiap ada perubahan status, atau tiap 3 detik (heartbeat)
- Backend simpan ke Supabase & sediakan API untuk frontend
- Frontend polling backend tiap 4 detik untuk update dashboard real-time

## 6. Testing API tanpa ESP32 (opsional, untuk cek backend jalan)
```bash
curl -X POST https://URL-BACKEND-KAMU/api/events \
  -H "Content-Type: application/json" \
  -d '{"status":"GEMPA","sw420":true,"mpu6050":true,"pir":false,"led":true,"buzzer":true,"pintu_terbuka":true,"device_id":"esp32-01"}'
```

## Troubleshooting
- **LCD blank**: coba ganti alamat I2C di kode dari `0x27` ke `0x3F` (cek pakai I2C scanner)
- **CORS error di frontend**: backend sudah pakai `cors()` global, pastikan URL `VITE_BACKEND_URL` benar & tanpa `/` di akhir
- **Data tidak masuk Supabase**: cek Railway logs, pastikan `SUPABASE_SERVICE_ROLE_KEY` benar (bukan anon key)
