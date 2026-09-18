// Netlify Function: /api/video-proxy?url=<link video tiktok>
//
// Video asli dari TikTok itu dilindungi (hotlink protection) dan kadang
// punya masa berlaku terbatas. Kalau dibuka LANGSUNG dari browser (tanpa
// header yang "wajar"), server TikTok kadang nolak/putus di tengah jalan —
// makanya video kadang hitam, kadang berhenti di tengah, acak.
//
// Function ini "menitipkan" request ke TikTok lewat server dulu, pakai
// header User-Agent & Referer yang bikin TikTok nganggep request-nya wajar,
// baru hasilnya dikirim balik ke video player di HP kamu.
//
// Catatan: ini function biasa (bukan streaming), jadi ada batas ukuran.
// Kalau videonya kebesaran (~5MB+), proxy ini akan gagal dengan sengaja
// (daripada nge-hang) — dan watchdog di index.html otomatis skip ke video
// berikutnya kalau itu terjadi, jadi tetap aman buat user.

exports.handler = async function (event) {
  const videoUrl = event.queryStringParameters && event.queryStringParameters.url;

  if (!videoUrl) {
    return { statusCode: 400, body: 'Parameter "url" wajib diisi' };
  }

  try {
    const forwardHeaders = {
      'User-Agent':
        'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0 Mobile Safari/537.36',
      Referer: 'https://www.tiktok.com/',
    };

    const rangeHeader = event.headers['range'] || event.headers['Range'];
    if (rangeHeader) forwardHeaders['Range'] = rangeHeader;

    const originRes = await fetch(videoUrl, { headers: forwardHeaders });

    if (!originRes.ok && originRes.status !== 206) {
      console.log('[video-proxy] sumber nolak, status:', originRes.status);
      return { statusCode: 502, body: 'Sumber video menolak (status ' + originRes.status + ')' };
    }

    const arrayBuffer = await originRes.arrayBuffer();

    // Batas aman respons Netlify Function biasa (sekitar 6MB).
    // Lebih baik gagal cepat & rapi daripada function timeout/crash.
    const MAX_BYTES = 5.5 * 1024 * 1024;
    if (arrayBuffer.byteLength > MAX_BYTES) {
      console.log('[video-proxy] video kebesaran:', arrayBuffer.byteLength, 'bytes');
      return { statusCode: 413, body: 'Video terlalu besar untuk di-proxy' };
    }

    const base64Body = Buffer.from(arrayBuffer).toString('base64');

    const responseHeaders = {
      'Content-Type': originRes.headers.get('content-type') || 'video/mp4',
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=3600',
    };
    const contentRange = originRes.headers.get('content-range');
    if (contentRange) responseHeaders['Content-Range'] = contentRange;

    return {
      statusCode: originRes.status === 206 ? 206 : 200,
      headers: responseHeaders,
      body: base64Body,
      isBase64Encoded: true,
    };
  } catch (err) {
    console.log('[video-proxy] error:', err.message);
    return { statusCode: 502, body: 'Proxy error: ' + err.message };
  }
};

