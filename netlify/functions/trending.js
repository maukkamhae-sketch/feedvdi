// Netlify Function: /api/trending?keyword=lucu
// Ambil video "viral/lucu" TikTok lewat fitur search hashtag dari API publik tikwm.com
// Catatan: ini API pihak ketiga tidak resmi, jadi hasil pencarian bisa berubah-ubah / kadang gagal.
//
// Versi ini menambahkan:
// - logging respons asli (biar gampang debug di Netlify Function Logs)
// - fallback ke video dari Pexels API kalau tikwm.com gagal / diblokir
//
// PENTING: API key Pexels JANGAN ditulis langsung di sini.
// Simpan di Netlify -> Site configuration -> Environment variables
// dengan nama PEXELS_API_KEY, lalu deploy ulang.

const DEFAULT_KEYWORDS = ["lucu", "viral", "fyp", "kocak", "receh"];
const PEXELS_API_KEY = process.env.PEXELS_API_KEY;

// Ambil video fallback dari Pexels (video pendek/vertikal populer)
async function getFallbackVideos(keyword) {
  if (!PEXELS_API_KEY) {
    console.log("[fallback] PEXELS_API_KEY belum diset di environment variables");
    return [];
  }

  try {
    // Coba search berdasarkan keyword dulu, biar masih nyambung sama yang dicari user
    const searchUrl = `https://api.pexels.com/videos/search?query=${encodeURIComponent(
      keyword
    )}&per_page=10&orientation=portrait`;

    const res = await fetch(searchUrl, {
      headers: { Authorization: PEXELS_API_KEY },
    });

    const rawText = await res.text();
    console.log("[fallback] pexels status:", res.status);

    const data = JSON.parse(rawText);

    let videos = (data.videos || []).map((v) => {
      // Pexels punya beberapa kualitas file, ambil yang paling kecil/hd biar ringan
      const file =
        v.video_files.find((f) => f.quality === "sd") || v.video_files[0];
      return {
        videoUrl: file.link,
        cover: v.image,
        title: "Video trending (fallback)",
        author: (v.user && v.user.name) || "Pexels",
      };
    });

    // Kalau search keyword-nya kosong, ambil video populer aja
    if (videos.length === 0) {
      const popRes = await fetch(
        "https://api.pexels.com/videos/popular?per_page=10",
        { headers: { Authorization: PEXELS_API_KEY } }
      );
      const popData = await popRes.json();
      videos = (popData.videos || []).map((v) => {
        const file =
          v.video_files.find((f) => f.quality === "sd") || v.video_files[0];
        return {
          videoUrl: file.link,
          cover: v.image,
          title: "Video trending (fallback)",
          author: (v.user && v.user.name) || "Pexels",
        };
      });
    }

    return videos;
  } catch (e) {
    console.log("[fallback] gagal ambil dari Pexels:", e.message);
    return [];
  }
}

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

    // Ambil body sebagai teks dulu, biar kita bisa lihat isi aslinya di log
    // walaupun ternyata bukan JSON (misal HTML halaman error/captcha).
    const rawText = await res.text();

    console.log("[trending] tikwm status:", res.status);
    console.log("[trending] tikwm content-type:", res.headers.get("content-type"));
    console.log("[trending] tikwm body (potongan):", rawText.substring(0, 500));

    let data;
    try {
      data = JSON.parse(rawText);
    } catch (parseErr) {
      console.log("[trending] gagal parse JSON, pakai fallback Pexels. Error:", parseErr.message);
      const fallback = await getFallbackVideos(keyword);
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyword,
          videos: fallback,
          notice: "Sumber video utama sedang bermasalah, menampilkan video sementara.",
        }),
      };
    }

    if (data.code !== 0 || !data.data || !data.data.videos || data.data.videos.length === 0) {
      console.log("[trending] respons tikwm tidak berisi video valid, pakai fallback Pexels. data.code:", data.code);
      const fallback = await getFallbackVideos(keyword);
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyword,
          videos: fallback,
          notice: "Tidak ada video ditemukan untuk kata kunci ini, menampilkan video sementara.",
        }),
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
    console.log("[trending] error tak terduga, pakai fallback Pexels:", err.message);
    const fallback = await getFallbackVideos(keyword);
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        keyword,
        videos: fallback,
        notice: "Terjadi kesalahan saat mengambil video, menampilkan video sementara.",
      }),
    };
  }
}; 
