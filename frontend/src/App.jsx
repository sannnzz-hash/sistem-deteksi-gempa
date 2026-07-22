import React, { useEffect, useState, useCallback, useRef } from 'react';
import { getLatestStatus, getEvents, getStats } from './api';

const STATUS_INFO = {
  GEMPA: {
    label: 'Gempa Terdeteksi',
    tag: 'ALARM',
    accent: '#ef4444',
    glow: 'rgba(239,68,68,0.18)',
    desc: 'Getaran awal dan getaran lanjutan terkonfirmasi. Pintu darurat terbuka otomatis.',
  },
  AKTIVITAS_MANUSIA: {
    label: 'Aktivitas Manusia',
    tag: 'INFO',
    accent: '#f5a623',
    glow: 'rgba(245,166,35,0.16)',
    desc: 'Gerakan tertangkap sensor PIR. Bukan aktivitas seismik.',
  },
  NORMAL: {
    label: 'Kondisi Normal',
    tag: 'STABIL',
    accent: '#22c55e',
    glow: 'rgba(34,197,94,0.14)',
    desc: 'Seluruh sensor berada pada baseline. Tidak ada anomali.',
  },
};

function formatWaktu(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'medium',
  });
}

function formatWaktuSingkat(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('id-ID', { timeStyle: 'medium' });
}

// Garis seismograf: bentuk beda tergantung status
function Seismograph({ status }) {
  const isGempa = status === 'GEMPA';
  const isAktivitas = status === 'AKTIVITAS_MANUSIA';

  let path;
  if (isGempa) {
    path =
      'M0,40 L20,40 L30,10 L40,70 L50,5 L60,75 L70,15 L80,65 L90,20 L100,40 L120,40 ' +
      'L130,12 L140,68 L150,8 L160,72 L170,18 L180,60 L190,25 L200,40 L220,40 ' +
      'L230,14 L240,66 L250,10 L260,70 L270,20 L280,55 L290,30 L300,40 L320,40';
  } else if (isAktivitas) {
    path =
      'M0,40 L60,40 L68,28 L76,52 L84,32 L92,40 L160,40 L168,30 L176,50 L184,34 L192,40 L320,40';
  } else {
    path = 'M0,40 L320,40';
  }

  return (
    <svg
      className={`seismo ${isGempa ? 'seismo-alarm' : ''}`}
      viewBox="0 0 320 80"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path d={path} fill="none" strokeWidth="2" />
    </svg>
  );
}

export default function App() {
  const [latest, setLatest] = useState(null);
  const [events, setEvents] = useState([]);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [clock, setClock] = useState(new Date());
  const firstLoad = useRef(true);

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
      firstLoad.current = false;
    }
  }, []);

  useEffect(() => {
    muatData();
    const interval = setInterval(muatData, 4000);
    return () => clearInterval(interval);
  }, [muatData]);

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const status = latest?.status || 'NORMAL';
  const info = STATUS_INFO[status];

  return (
    <div className="page" style={{ '--accent': info.accent }}>
      <header className="topbar">
        <div className="topbar-left">
          <span className="dot" />
          <div>
            <h1>Stasiun Pemantau Getaran</h1>
            <p className="topbar-sub">ESP32 · SW420 &middot; MPU6050 &middot; PIR</p>
          </div>
        </div>
        <div className="topbar-right">
          <span className="clock">{clock.toLocaleTimeString('id-ID')}</span>
        </div>
      </header>

      <Seismograph status={status} />

      {error && (
        <div className="banner banner-error">
          Koneksi ke server gagal — {error}
        </div>
      )}

      {loading ? (
        <div className="loading-state">Menghubungkan ke sensor…</div>
      ) : (
        <main className="grid">
          <section
            className="status-panel"
            style={{ boxShadow: `0 0 0 1px ${info.accent}33, 0 20px 60px -20px ${info.glow}` }}
          >
            <div className="status-head">
              <span className="status-tag" style={{ color: info.accent, borderColor: `${info.accent}55` }}>
                {info.tag}
              </span>
              <span className="status-time">Update: {formatWaktu(latest?.created_at)}</span>
            </div>
            <h2 style={{ color: info.accent }}>{info.label}</h2>
            <p className="status-desc">{info.desc}</p>

            <div className="sensor-row">
              <SensorCell label="SW420" sub="Getaran awal" aktif={latest?.sw420} />
              <SensorCell label="MPU6050" sub="Getaran lanjutan" aktif={latest?.mpu6050} />
              <SensorCell label="PIR" sub="Gerakan manusia" aktif={latest?.pir} />
              <SensorCell label="LED" sub="Indikator visual" aktif={latest?.led} />
              <SensorCell label="Buzzer" sub="Alarm suara" aktif={latest?.buzzer} />
              <SensorCell label="Pintu" sub="Jalur evakuasi" aktif={latest?.pintu_terbuka} />
            </div>
          </section>

          <aside className="stat-stack">
            <StatCard value={stats?.total_event ?? 0} label="Total Event Tercatat" accent="#e8ecf1" />
            <StatCard value={stats?.total_gempa ?? 0} label="Kejadian Gempa" accent="#ef4444" />
            <StatCard value={stats?.total_aktivitas_manusia ?? 0} label="Aktivitas Manusia" accent="#f5a623" />
          </aside>

          <section className="log-panel">
            <div className="log-head">
              <h3>Log Peristiwa</h3>
              <span className="log-count">{events.length} entri terbaru</span>
            </div>
            <div className="log-table-wrap">
              <table className="log-table">
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
                  {events.length === 0 && (
                    <tr>
                      <td colSpan="5" className="empty-row">
                        Belum ada data masuk dari perangkat.
                      </td>
                    </tr>
                  )}
                  {events.map((ev) => (
                    <tr key={ev.id}>
                      <td className="mono">{formatWaktuSingkat(ev.created_at)}</td>
                      <td>
                        <span
                          className="pill"
                          style={{ color: STATUS_INFO[ev.status]?.accent, borderColor: `${STATUS_INFO[ev.status]?.accent}44` }}
                        >
                          {STATUS_INFO[ev.status]?.label || ev.status}
                        </span>
                      </td>
                      <td className="mono">{ev.sw420 ? 'ON' : '–'}</td>
                      <td className="mono">{ev.mpu6050 ? 'ON' : '–'}</td>
                      <td className="mono">{ev.pir ? 'ON' : '–'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </main>
      )}

      <footer className="foot">
        Data diperbarui otomatis setiap 4 detik &middot; device_id: {latest?.device_id || 'esp32-01'}
      </footer>
    </div>
  );
}

function SensorCell({ label, sub, aktif }) {
  return (
    <div className={`sensor-cell ${aktif ? 'is-on' : ''}`}>
      <span className="sensor-led" />
      <div className="sensor-text">
        <strong>{label}</strong>
        <small>{sub}</small>
      </div>
      <span className="sensor-state">{aktif ? 'ON' : 'OFF'}</span>
    </div>
  );
}

function StatCard({ value, label, accent }) {
  return (
    <div className="stat-card">
      <span className="stat-value" style={{ color: accent }}>{value}</span>
      <span className="stat-label">{label}</span>
    </div>
  );
}
