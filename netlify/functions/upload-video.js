// POST /api/upload-video  { username, caption, videoBase64, mimeType }
// Simpan video upload user ke Netlify Blobs
const { getStore, connectLambda } = require('@netlify/blobs');
const crypto = require('crypto');

exports.handler = async (event) => {
  connectLambda(event);

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch (e) { body = {}; }
  const { username, caption, videoBase64, mimeType } = body;

  if (!username || !videoBase64) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Data tidak lengkap' }) };
  }

  // Batas ukuran supaya aman di bawah limit request Netlify Functions (~6MB)
  const approxBytes = (videoBase64.length * 3) / 4;
  if (approxBytes > 4.5 * 1024 * 1024) {
    return {
      statusCode: 413,
      body: JSON.stringify({ error: 'Video terlalu besar. Maksimal sekitar 4MB (video pendek/kualitas rendah).' }),
    };
  }

  const videoStore = getStore('vidfeed-videos');
  const metaStore = getStore('vidfeed-uploads-meta');

  const id = crypto.randomUUID();
  const buffer = Buffer.from(videoBase64, 'base64');
  await videoStore.set(id, buffer, { metadata: { mimeType: mimeType || 'video/mp4' } });

  const meta = {
    id,
    username,
    caption: caption || '',
    mimeType: mimeType || 'video/mp4',
    createdAt: Date.now(),
  };
  await metaStore.set(id, JSON.stringify(meta));

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ok: true, id }),
  };
};
