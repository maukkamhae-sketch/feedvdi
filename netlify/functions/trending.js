// Netlify Function: /api/trending?keyword=lucu
// Urutan sumber video: tikwm.com (TikTok asli) -> Pexels -> Pixabay
// Kalau satu sumber gagal/kosong, otomatis lanjut ke sumber berikutnya.
//
// Environment variables yang dibutuhkan (set di Netlify -> Environment variables):
// - PEXELS_API_KEY
// - PIXABAY_API_KEY

const DEFAULT_KEYWORDS = ["lucu", "viral", "fyp", "kocak", "receh"];
const PEXELS_API_KEY = process.env.PEXELS_API_KEY;
const PIXABAY_API_KEY = process.env.PIXABAY_API_KEY;

// ---------- Sumber 1: tikwm.com (TikTok asli) ----------
async function getFromTikwm(keyword) {
  const params = new URLSearchParams();
  params.append("keywords", keyword);
  params.append("count", "20");
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

  const rawText = await res.text();
  console.log("[tikwm] status:", res.status, "body:", rawText.substring(0, 200));

  const data = JSON.parse(rawText); // kalau bukan JSON, ini otomatis throw -> ditangkap di handler

  if (data.code !== 0 || !data.data || !data.data.videos || data.data.videos.length === 0) {
    throw new Error("tikwm: tidak ada video valid");
  }

  return data.data.videos.map((v) => ({
    videoUrl: v.play,
    cover: v.cover,
    title: v.title || "",
    author: (v.author && v.author.nickname) || "",
    source: "tiktok",
  }));
}

// ---------- Sumber 2: Pexels ----------
async function getFromPexels(keyword) {
  if (!PEXELS_API_KEY) throw new Error("PEXELS_API_KEY belum diset");

  const searchUrl = `https://api.pexels.com/videos/search?query=${encodeURIComponent(
    keyword
  )}&per_page=30&orientation=portrait`;

  const res = await fetch(searchUrl, { headers: { Authorization: PEXELS_API_KEY } });
  const rawText = await res.text();
  console.log("[pexels] status:", res.status);

  const data = JSON.parse(rawText);
  let videos = data.videos || [];

  if (videos.length === 0) {
    // fallback ke video populer kalau keyword nggak ketemu
    const popRes = await fetch("https://api.pexels.com/videos/popular?per_page=30", {
      headers: { Authorization: PEXELS_API_KEY },
    });
    const popData = await popRes.json();
    videos = popData.videos || [];
  }

  if (videos.length === 0) throw new Error("pexels: tidak ada video");

  return videos.map((v) => {
    const file = v.video_files.find((f) => f.quality === "sd") || v.video_files[0];
    return {
      videoUrl: file.link,
      cover: v.image,
      title: "Video trending",
      author: (v.user && v.user.name) || "Pexels",
      source: "pexels",
    };
  });
}

// ---------- Sumber 3: Pixabay ----------
async function getFromPixabay(keyword) {
  if (!PIXABAY_API_KEY) throw new Error("PIXABAY_API_KEY belum diset");

  const searchUrl = `https://pixabay.com/api/videos/?key=${PIXABAY_API_KEY}&q=${encodeURIComponent(
    keyword
  )}&per_page=30&safesearch=true`;

  const res = await fetch(searchUrl);
  const rawText = await res.text();
  console.log("[pixabay] status:", res.status);

  const data = JSON.parse(rawText);
  const hits = data.hits || [];

  if (hits.length === 0) throw new Error("pixabay: tidak ada video");

  return hits.map((v) => {
    const file = v.videos.medium || v.videos.small || v.videos.tiny;
    return {
      videoUrl: file.url,
      cover: "",
      title: v.tags || "Video trending",
      author: v.user || "Pixabay",
      source: "pixabay",
    };
  });
}

exports.handler = async function (event) {
  const keyword =
    (event.queryStringParameters && event.queryStringParameters.keyword) ||
    DEFAULT_KEYWORDS[Math.floor(Math.random() * DEFAULT_KEYWORDS.length)];

  const sources = [
    { name: "tikwm", fn: getFromTikwm },
    { name: "pexels", fn: getFromPexels },
    { name: "pixabay", fn: getFromPixabay },
  ];

  let lastError = "";

  for (const src of sources) {
    try {
      const videos = await src.fn(keyword);
      console.log(`[trending] berhasil pakai sumber: ${src.name}, jumlah video: ${videos.length}`);
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyword,
          videos,
          usedSource: src.name,
        }),
      };
    } catch (err) {
      console.log(`[trending] sumber ${src.name} gagal:`, err.message);
      lastError = err.message;
      // lanjut ke sumber berikutnya
    }
  }

  // Semua sumber gagal
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      keyword,
      videos: [],
      error: "Semua sumber video gagal diakses. Error terakhir: " + lastError,
    }),
  };
};
