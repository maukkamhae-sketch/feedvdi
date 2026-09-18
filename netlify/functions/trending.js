// Netlify Function: /api/trending?keyword=lucu
// Urutan sumber video:
//   1. RapidAPI "TikTok Scraper7" (TikTok asli, ADA SUARA, lewat proxy RapidAPI biar nggak keblokir)
//   2. tikwm.com langsung (TikTok asli, ADA SUARA) - dicoba beberapa kali dengan keyword berbeda
//   3. Pexels (fallback, kebanyakan TANPA suara)
//   4. Pixabay (fallback, kebanyakan TANPA suara)
//
// Environment variables yang dibutuhkan (set di Netlify -> Environment variables):
// - RAPIDAPI_KEY
// - PEXELS_API_KEY
// - PIXABAY_API_KEY

const DEFAULT_KEYWORDS = ["lucu", "viral", "fyp", "kocak", "receh", "comedy", "prank", "kucing", "meme"];
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const PEXELS_API_KEY = process.env.PEXELS_API_KEY;
const PIXABAY_API_KEY = process.env.PIXABAY_API_KEY;

function pickRandomKeyword(exclude) {
  const options = DEFAULT_KEYWORDS.filter((k) => k !== exclude);
  return options[Math.floor(Math.random() * options.length)];
}

// ---------- Sumber 1: RapidAPI "TikTok Scraper7" ----------
async function getFromRapidApiOnce(keyword) {
  if (!RAPIDAPI_KEY) throw new Error("RAPIDAPI_KEY belum diset");

  const url = `https://tiktok-scraper7.p.rapidapi.com/feed/search?keywords=${encodeURIComponent(
    keyword
  )}&region=us&count=20&cursor=0&publish_time=0&sort_type=0`;

  const res = await fetch(url, {
    headers: {
      "x-rapidapi-key": RAPIDAPI_KEY,
      "x-rapidapi-host": "tiktok-scraper7.p.rapidapi.com",
    },
  });

  const rawText = await res.text();
  console.log(`[rapidapi] keyword="${keyword}" status:`, res.status, "body:", rawText.substring(0, 150));

  const data = JSON.parse(rawText);

  if (data.code !== 0 || !data.data || !data.data.videos || data.data.videos.length === 0) {
    throw new Error(`rapidapi kosong untuk keyword "${keyword}"`);
  }

  return data.data.videos.map((v) => ({
    videoUrl: v.play,
    cover: v.cover,
    title: v.title || "",
    author: (v.author && v.author.nickname) || "",
    source: "tiktok",
  }));
}

async function getFromRapidApiWithRetry(initialKeyword, maxAttempts) {
  let keyword = initialKeyword;
  let lastError = "";

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const videos = await getFromRapidApiOnce(keyword);
      console.log(`[rapidapi] berhasil di percobaan ke-${attempt} dengan keyword "${keyword}"`);
      return videos;
    } catch (err) {
      lastError = err.message;
      console.log(`[rapidapi] percobaan ke-${attempt} gagal (keyword "${keyword}"):`, err.message);
      keyword = pickRandomKeyword(keyword);
    }
  }

  throw new Error(`rapidapi gagal setelah ${maxAttempts}x percobaan. Error terakhir: ${lastError}`);
}

// ---------- Sumber 2: tikwm.com langsung ----------
async function getFromTikwmOnce(keyword) {
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
  console.log(`[tikwm] keyword="${keyword}" status:`, res.status, "body:", rawText.substring(0, 150));

  const data = JSON.parse(rawText);

  if (data.code !== 0 || !data.data || !data.data.videos || data.data.videos.length === 0) {
    throw new Error(`tikwm kosong untuk keyword "${keyword}"`);
  }

  return data.data.videos.map((v) => ({
    videoUrl: v.play,
    cover: v.cover,
    title: v.title || "",
    author: (v.author && v.author.nickname) || "",
    source: "tiktok",
  }));
}

async function getFromTikwmWithRetry(initialKeyword, maxAttempts) {
  let keyword = initialKeyword;
  let lastError = "";

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const videos = await getFromTikwmOnce(keyword);
      console.log(`[tikwm] berhasil di percobaan ke-${attempt} dengan keyword "${keyword}"`);
      return videos;
    } catch (err) {
      lastError = err.message;
      console.log(`[tikwm] percobaan ke-${attempt} gagal (keyword "${keyword}"):`, err.message);
      keyword = pickRandomKeyword(keyword);
    }
  }

  throw new Error(`tikwm gagal setelah ${maxAttempts}x percobaan. Error terakhir: ${lastError}`);
}

// ---------- Sumber 3: Pexels (fallback) ----------
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
      noAudio: true,
    };
  });
}

// ---------- Sumber 4: Pixabay (fallback) ----------
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
      noAudio: true,
    };
  });
}

exports.handler = async function (event) {
  const keyword =
    (event.queryStringParameters && event.queryStringParameters.keyword) ||
    DEFAULT_KEYWORDS[Math.floor(Math.random() * DEFAULT_KEYWORDS.length)];

  // 1. Coba RapidAPI dulu (paling mungkin berhasil, proxy resmi + ada suara)
  try {
    const videos = await getFromRapidApiWithRetry(keyword, 3);
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keyword, videos, usedSource: "tiktok-rapidapi" }),
    };
  } catch (err) {
    console.log("[trending] rapidapi total gagal:", err.message);
  }

  // 2. Coba tikwm langsung
  try {
    const videos = await getFromTikwmWithRetry(keyword, 3);
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keyword, videos, usedSource: "tiktok-direct" }),
    };
  } catch (err) {
    console.log("[trending] tikwm total gagal:", err.message);
  }

  // 3. Fallback ke Pexels
  try {
    const videos = await getFromPexels(keyword);
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        keyword,
        videos,
        usedSource: "pexels",
        notice: "Sumber TikTok sedang gangguan, menampilkan video pengganti (tanpa suara).",
      }),
    };
  } catch (err) {
    console.log("[trending] pexels gagal:", err.message);
  }

  // 4. Fallback ke Pixabay
  try {
    const videos = await getFromPixabay(keyword);
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        keyword,
        videos,
        usedSource: "pixabay",
        notice: "Sumber TikTok sedang gangguan, menampilkan video pengganti (tanpa suara).",
      }),
    };
  } catch (err) {
    console.log("[trending] pixabay gagal:", err.message);
  }

  // Semua sumber gagal total
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      keyword,
      videos: [],
      error: "Semua sumber video gagal diakses. Coba lagi nanti.",
    }),
  };
};
