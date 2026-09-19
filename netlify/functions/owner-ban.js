// POST /api/owner-ban  (header: x-owner-password)  { username, action, hours }
// action: 'ban_permanent' | 'ban_trial' | 'unban'
const { getStore, connectLambda } = require('@netlify/blobs');

exports.handler = async (event) => {
  connectLambda(event);

  const password = event.headers['x-owner-password'];
  if (!process.env.OWNER_PASSWORD || password !== process.env.OWNER_PASSWORD) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Password owner salah' }) };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch (e) { body = {}; }
  const { username, action, hours } = body;
  if (!username || !action) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Data tidak lengkap' }) };
  }

  const store = getStore('vidfeed-users');
  const key = username.toLowerCase();
  let user = await store.get(key, { type: 'json' });
  if (!user) {
    return { statusCode: 404, body: JSON.stringify({ error: 'User tidak ditemukan' }) };
  }

  if (action === 'ban_permanent') {
    user.status = 'banned';
    user.bannedUntil = null;
  } else if (action === 'ban_trial') {
    user.status = 'trial_banned';
    user.bannedUntil = Date.now() + (hours || 24) * 3600 * 1000;
  } else if (action === 'unban') {
    user.status = 'active';
    user.bannedUntil = null;
  } else {
    return { statusCode: 400, body: JSON.stringify({ error: 'Aksi tidak dikenal' }) };
  }

  await store.set(key, JSON.stringify(user));
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ok: true, user }),
  };
};
