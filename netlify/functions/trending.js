// Netlify Function: /api/trending?keyword=lucu
// Ambil video "viral/lucu" TikTok lewat fitur search hashtag dari API publik tikwm.com
// Catatan: ini API pihak ketiga tidak resmi, jadi hasil pencarian bisa berubah-ubah / kadang gagal.

const DEFAULT_KEYWORDS = ["lucu", "viral", "fyp", "kocak", "receh"];

exports.handler = async function (event) {
  const keyword =
    (event.queryStringParameters && event.queryStringParameters.keyword) ||
    DEFAULT_KEYWORDS[Math.floor(Math.random() * DEFAULT_KEYWORDS.length)];

  try {
    const params = new URLSearchParams();
    params.append("keywords", keyword);
    params.append("count", "15");
    params.append("cursor", "0");
    params.append("web", "1");
    params.append("hd", "1");

    const res = await fetch("https://www.tikwm.com/api/feed/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "Mozilla/5.0",
      },
      body: params.toString(),
    });

    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      return {
        statusCode: 502,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          error: "Sumber video pihak ketiga sedang tidak merespons dengan benar. Coba lagi nanti atau ganti kata kunci.",
        }),
      };
    }

    const data = await res.json();

    if (data.code !== 0 || !data.data || !data.data.videos) {
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Gagal ambil video trending untuk kata kunci ini." }),
      };
    }

    const videos = data.data.videos.map((v) => ({
      videoUrl: v.play,
      cover: v.cover,
      title: v.title || "",
      author: (v.author && v.author.nickname) || "",
    }));

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keyword, videos }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Terjadi kesalahan: " + err.message }),
    };
  }
};
