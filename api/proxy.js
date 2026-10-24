
export default async function handler(req, res) {
  const upstream = process.env.APPS_SCRIPT_URL;

  if (!upstream) {
    return res.status(500).json({
      success: false,
      message: "Konfigurasi API server belum tersedia."
    });
  }

  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({
      success: false,
      message: "Metode tidak diizinkan."
    });
  }

  try {
    const target = new URL(upstream);

    if (req.method === "GET") {
      const params = req.query || {};

      // Hanya izinkan parameter pencarian publik.
      if (params.action !== "search") {
        return res.status(400).json({
          success: false,
          message: "Aksi GET tidak diizinkan."
        });
      }

      target.searchParams.set("action", "search");
      target.searchParams.set("name", String(params.name || ""));

      if (params.callback) {
        const callback = String(params.callback);
        if (!/^[a-zA-Z_$][\w.$]*$/.test(callback)) {
          return res.status(400).json({
            success: false,
            message: "Callback tidak valid."
          });
        }
        target.searchParams.set("callback", callback);
      }
    }

    const options = {
      method: req.method,
      redirect: "follow",
      headers: {}
    };

    if (req.method === "POST") {
      const body = typeof req.body === "string"
        ? req.body
        : JSON.stringify(req.body || {});

      if (body.length > 100000) {
        return res.status(413).json({
          success: false,
          message: "Ukuran permintaan terlalu besar."
        });
      }

      let payload;
      try {
        payload = JSON.parse(body);
      } catch {
        return res.status(400).json({
          success: false,
          message: "Format JSON tidak valid."
        });
      }

      const allowedActions = [
        "login",
        "dashboard",
        "listParticipants",
        "saveParticipant",
        "deactivateParticipant",
        "listResults",
        "saveResult",
        "publishContest",
        "listContests",
        "logout"
      ];

      if (!allowedActions.includes(String(payload.action || ""))) {
        return res.status(400).json({
          success: false,
          message: "Aksi tidak diizinkan."
        });
      }

      options.headers["Content-Type"] = "text/plain;charset=utf-8";
      options.body = JSON.stringify(payload);
    }

    const response = await fetch(target.toString(), options);
    const text = await response.text();

    if (!response.ok) {
      console.error("Apps Script HTTP status:", response.status);
      return res.status(502).json({
        success: false,
        message: "Server pengumuman gagal memproses permintaan."
      });
    }

    const contentType = response.headers.get("content-type") || "";

    if (contentType.includes("javascript")) {
      res.setHeader("Content-Type", "application/javascript; charset=utf-8");
      return res.status(200).send(text);
    }

    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.status(200).send(text);
  } catch (error) {
    console.error("Proxy error:", error.message);

    return res.status(502).json({
      success: false,
      message: "Tidak dapat terhubung ke server pengumuman."
    });
  }
}
