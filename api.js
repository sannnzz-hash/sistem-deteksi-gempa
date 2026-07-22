const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

export async function getLatestStatus() {
  const res = await fetch(`${BACKEND_URL}/api/status/latest`);
  if (!res.ok) throw new Error('Gagal ambil status terbaru');
  return res.json();
}

export async function getEvents(limit = 50) {
  const res = await fetch(`${BACKEND_URL}/api/events?limit=${limit}`);
  if (!res.ok) throw new Error('Gagal ambil history event');
  return res.json();
}

export async function getStats() {
  const res = await fetch(`${BACKEND_URL}/api/stats`);
  if (!res.ok) throw new Error('Gagal ambil statistik');
  return res.json();
}
