import React, { useEffect, useState, useCallback } from 'react';
import { getLatestStatus, getEvents, getStats } from './api';

const STATUS_INFO = {
  GEMPA: {
    label: 'GEMPA TERDETEKSI',
    color: '#dc2626',
    bg: '#fee2e2',
    desc: 'Getaran awal & lanjutan terdeteksi. Pintu darurat terbuka otomatis.',
  },
  AKTIVITAS_MANUSIA: {
    label: 'Aktivitas Manusia',
    color: '#d97706',
    bg: '#fef3c7',
    desc: 'Gerakan terdeteksi oleh sensor PIR, bukan gempa.',
  },
  NORMAL: {
    label: 'Kondisi Normal',
    color: '#16a34a',
    bg: '#dcfce7',
    desc: 'Semua sensor tidak mendeteksi anomali.',
  },
};

function formatWaktu(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'medium',
  });
}

export default function App() {
  const [latest, setLatest] = useState(null);
  const [events, setEvents] = useState([]);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const muatData = useCallback(async () => {
    try {
      const [latestRes, eventsRes, statsRes] = await Promise.all([
        getLatestStatus(),
        getEvents(30),
        getStats(),
      ]);
      setLatest(latestRes.data);
      setEvents(eventsRes.data);
      setStats(statsRes);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    muatData();
    const interval = setInterval(muatData, 1000); // polling tiap 1 detik
    return () => clearInterval(interval);
  }, [muatData]);

  const info = latest ? STATUS_INFO[latest.status] : STATUS_INFO.NORMAL;

  return (
    <div className="container">
      <header>
        <h1>Dashboard Sistem Deteksi Gempa</h1>
        <p className="subtitle">Realtime monitoring sensor ESP32 (SW420, MPU6050, PIR)</p>
      </header>

      {error && <div className="error-box">Error: {error}</div>}

      {loading ? (
        <p>Memuat data...</p>
      ) : (
        <>
          <section className="status-card" style={{ background: info.bg, borderColor: info.color }}>
            <h2 style={{ color: info.color }}>{info.label}</h2>
            <p>{info.desc}</p>
            <p className="timestamp">Update terakhir: {formatWaktu(latest?.created_at)}</p>

            <div className="sensor-grid">
              <SensorBadge label="SW420" aktif={latest?.sw420} />
              <SensorBadge label="MPU6050" aktif={latest?.mpu6050} />
              <SensorBadge label="PIR" aktif={latest?.pir} />
              <SensorBadge label="LED" aktif={latest?.led} />
              <SensorBadge label="Buzzer" aktif={latest?.buzzer} />
              <SensorBadge label="Pintu Terbuka" aktif={latest?.pintu_terbuka} />
            </div>
          </section>

          {stats && (
            <section className="stats-row">
              <StatCard label="Total Event" value={stats.total_event} />
              <StatCard label="Total Gempa" value={stats.total_gempa} color="#dc2626" />
              <StatCard label="Aktivitas Manusia" value={stats.total_aktivitas_manusia} color="#d97706" />
            </section>
          )}

          <section className="history">
            <h3>Riwayat Event Terbaru</h3>
            <table>
              <thead>
                <tr>
                  <th>Waktu</th>
                  <th>Status</th>
                  <th>SW420</th>
                  <th>MPU6050</th>
                  <th>PIR</th>
                </tr>
              </thead>
              <tbody>
                {events.map((ev) => (
                  <tr key={ev.id}>
                    <td>{formatWaktu(ev.created_at)}</td>
                    <td style={{ color: STATUS_INFO[ev.status]?.color, fontWeight: 600 }}>
                      {STATUS_INFO[ev.status]?.label || ev.status}
                    </td>
                    <td>{ev.sw420 ? '✅' : '—'}</td>
                    <td>{ev.mpu6050 ? '✅' : '—'}</td>
                    <td>{ev.pir ? '✅' : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}
    </div>
  );
}

function SensorBadge({ label, aktif }) {
  return (
    <div className={`badge ${aktif ? 'badge-on' : 'badge-off'}`}>
      <span>{label}</span>
      <strong>{aktif ? 'ON' : 'OFF'}</strong>
    </div>
  );
}

function StatCard({ label, value, color = '#111827' }) {
  return (
    <div className="stat-card">
      <p className="stat-value" style={{ color }}>{value}</p>
      <p className="stat-label">{label}</p>
    </div>
  );
}
