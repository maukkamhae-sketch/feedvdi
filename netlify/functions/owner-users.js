// GET /api/owner-users  (header: x-owner-password)
// Daftar semua user buat dipantau owner
const { getStore, connectLambda } = require('@netlify/blobs');

exports.handler = async (event) => {
  // WAJIB dipanggil di awal, sebelum getStore() — ini yang "nyambungin"
  // function ke database Blobs pas jalan di production (bukan di dev).
  connectLambda(event);

  const password = event.headers['x-owner-password'];
  if (!process.env.OWNER_PASSWORD || password !== process.env.OWNER_PASSWORD) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Password owner salah' }) };
  }

  const store = getStore('vidfeed-users');
  const { blobs } = await store.list();
  const users = [];
  for (const b of blobs) {
    const data = await store.get(b.key, { type: 'json' });
    if (data) users.push(data);
  }
  users.sort((a, b) => (b.lastSeen || 0) - (a.lastSeen || 0));

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ users }),
  };
};
