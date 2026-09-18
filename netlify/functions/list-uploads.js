// GET /api/list-uploads
// Daftar semua video yang diupload user, terbaru duluan
const { getStore } = require('@netlify/blobs');

exports.handler = async () => {
  const metaStore = getStore('vidfeed-uploads-meta');
  const { blobs } = await metaStore.list();
  const uploads = [];
  for (const b of blobs) {
    const data = await metaStore.get(b.key, { type: 'json' });
    if (data) uploads.push(data);
  }
  uploads.sort((a, b) => b.createdAt - a.createdAt);

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uploads }),
  };
};
