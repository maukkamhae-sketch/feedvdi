// Netlify Function: /api/get-video?url=<link_tiktok>
// Mengambil link video TikTok (tanpa watermark) lewat API publik tikwm.com

exports.handler = async function (event) {
  const url = event.queryStringParameters && event.queryStringParameters.url;

  if (!url) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Parameter 'url' wajib diisi." }),
    };
  }

  try {
    const apiUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`;
    const res = await fetch(apiUrl);
    const data = await res.json();

    if (data.code !== 0 || !data.data) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Gagal mengambil video. Cek link TikTok-nya." }),
      };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        videoUrl: data.data.play,
        cover: data.data.cover,
        title: data.data.title || "",
        author: (data.data.author && data.data.author.nickname) || "",
      }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Terjadi kesalahan: " + err.message }),
    };
  }
};
