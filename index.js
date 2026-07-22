import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { supabase } from './supabaseClient.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors()); // untuk kemudahan, izinkan semua origin (bisa dibatasi ke domain vercel kamu)
app.use(express.json());

// ============ HEALTH CHECK ============
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Backend Sistem Deteksi Gempa aktif' });
});

// ============ ESP32 -> KIRIM DATA EVENT BARU ============
app.post('/api/events', async (req, res) => {
  try {
    const {
      status,
      sw420,
      mpu6050,
      pir,
      led,
      buzzer,
      pintu_terbuka,
      device_id,
    } = req.body;

    if (!status || !['GEMPA', 'AKTIVITAS_MANUSIA', 'NORMAL'].includes(status)) {
      return res.status(400).json({ error: 'Field status wajib diisi dan harus valid.' });
    }

    const { data, error } = await supabase
      .from('earthquake_events')
      .insert([
        {
          status,
          sw420: !!sw420,
          mpu6050: !!mpu6050,
          pir: !!pir,
          led: !!led,
          buzzer: !!buzzer,
          pintu_terbuka: !!pintu_terbuka,
          device_id: device_id || 'esp32-01',
        },
      ])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({ message: 'Event tersimpan', data });
  } catch (err) {
    console.error('Gagal simpan event:', err.message);
    res.status(500).json({ error: 'Gagal menyimpan data', detail: err.message });
  }
});

// ============ FRONTEND -> AMBIL STATUS TERBARU ============
app.get('/api/status/latest', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('earthquake_events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    res.json({ data: data || null });
  } catch (err) {
    console.error('Gagal ambil status terbaru:', err.message);
    res.status(500).json({ error: 'Gagal mengambil status terbaru', detail: err.message });
  }
});

// ============ FRONTEND -> AMBIL HISTORY EVENT ============
app.get('/api/events', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 500);
    const statusFilter = req.query.status; // opsional: ?status=GEMPA

    let query = supabase
      .from('earthquake_events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (statusFilter) {
      query = query.eq('status', statusFilter);
    }

    const { data, error } = await query;
    if (error) throw error;

    res.json({ data, count: data.length });
  } catch (err) {
    console.error('Gagal ambil history:', err.message);
    res.status(500).json({ error: 'Gagal mengambil history event', detail: err.message });
  }
});

// ============ STATISTIK RINGKAS (opsional untuk dashboard) ============
app.get('/api/stats', async (req, res) => {
  try {
    const { count: totalGempa } = await supabase
      .from('earthquake_events')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'GEMPA');

    const { count: totalAktivitas } = await supabase
      .from('earthquake_events')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'AKTIVITAS_MANUSIA');

    const { count: totalEvent } = await supabase
      .from('earthquake_events')
      .select('*', { count: 'exact', head: true });

    res.json({
      total_event: totalEvent || 0,
      total_gempa: totalGempa || 0,
      total_aktivitas_manusia: totalAktivitas || 0,
    });
  } catch (err) {
    console.error('Gagal ambil statistik:', err.message);
    res.status(500).json({ error: 'Gagal mengambil statistik', detail: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Backend jalan di port ${PORT}`);
});
