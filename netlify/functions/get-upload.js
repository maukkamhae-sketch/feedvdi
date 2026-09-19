// GET /api/get-upload?id=xxx
// Kirim balik file video yang sudah diupload user
const { getStore, connectLambda } = require('@netlify/blobs');

exports.handler = async (event) => {
  connectLambda(event);

  const id = event.queryStringParameters && event.queryStringParameters.id;
  if (!id) return { statusCode: 400, body: 'id wajib diisi' };

  const videoStore = getStore('vidfeed-videos');
  const result = await videoStore.getWithMetadata(id, { type: 'arrayBuffer' });
  if (!result) return { statusCode: 404, body: 'Video tidak ditemukan' };

  const buffer = Buffer.from(result.data);
  return {
    statusCode: 200,
    headers: {
      'Content-Type': (result.metadata && result.metadata.mimeType) || 'video/mp4',
      'Cache-Control': 'public, max-age=31536000',
    },
    body: buffer.toString('base64'),
    isBase64Encoded: true,
  };
};
