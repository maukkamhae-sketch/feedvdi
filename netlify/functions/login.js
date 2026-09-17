// POST /api/login  { username }
// Daftar/cek user, cek status ban, dan catat device + lokasi (dari IP)
const { getStore } = require('@netlify/blobs');

async function lookupLocation(ip) {
  if (!ip || ip === '127.0.0.1') return null;
  try {
    const res = await fetch(`http://ip-api.com/json/${ip}?fields=city,regionName,country`);
    const data = await res.json();
    if (data && data.city) {
      return `${data.city}, ${data.regionName || ''} ${data.country || ''}`.trim();
    }
  } catch (e) { /* biarin null kalau gagal */ }
  return null;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch (e) { body = {}; }
  const username = (body.username || '').trim();
  if (!username) {
    return { statusCode: 400, body: JSON.stringify({ error: 'username wajib diisi' }) };
  }

  const store = getStore('vidfeed-users');
  const key = username.toLowerCase();
  let user = await store.get(key, { type: 'json' });
  const now = Date.now();

  if (user && user.status === 'banned') {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ banned: true, type: 'permanent' }),
    };
  }

  if (user && user.status === 'trial_banned') {
    if (user.bannedUntil && now < user.bannedUntil) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ banned: true, type: 'trial', until: user.bannedUntil }),
      };
    }
    user.status = 'active';
    user.bannedUntil = null;
  }

  const ip = event.headers['x-nf-client-connection-ip'] || event.headers['client-ip'] || '';
  const device = event.headers['user-agent'] || 'Tidak diketahui';
  const location = await lookupLocation(ip);

  if (!user) {
    user = { username, status: 'active', createdAt: now, lastSeen: now };
  } else {
    user.lastSeen = now;
  }
  user.device = device;
  user.ip = ip || null;
  user.location = location;

  await store.set(key, JSON.stringify(user));

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ banned: false }),
  };
};
