
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

function appsScriptProxy(apiUrl) {
  const allowedActions = new Set([
    "login",
    "logout",
    "dashboard",
    "listParticipants",
    "saveParticipant",
    "deactivateParticipant",
    "listContests",
    "listResults",
    "saveResult",
    "publishContest",
  ]);

  return {
    name: "pmr-smanel-local-api",

    configureServer(server) {
      server.middlewares.use("/api/proxy", async (req, res) => {
        res.setHeader("Cache-Control", "no-store");

        try {
          const incoming = new URL(
            req.url || "/",
            "http://localhost"
          );

          const target = new URL(apiUrl);

          if (req.method === "GET") {
            const action = incoming.searchParams.get("action");

            if (
              !["search", "listEvents", "listLombaByEvent"].includes(action)
            ) {
              res.statusCode = 400;
              res.setHeader("Content-Type", "application/json");
              return res.end(JSON.stringify({
                success: false,
                message: "Aksi GET tidak diizinkan.",
              }));
            }

            target.searchParams.set("action", action);

            if (action === "search") {
              target.searchParams.set(
                "name",
                incoming.searchParams.get("name") || ""
              );
              target.searchParams.set(
                "eventId",
                incoming.searchParams.get("eventId") || ""
              );
            }

            if (action === "listLombaByEvent") {
              target.searchParams.set(
                "eventId",
                incoming.searchParams.get("eventId") || ""
              );
            }

            const upstream = await fetch(target.toString(), {
              method: "GET",
              redirect: "follow",
            });

            return await sendResponse(upstream, res);
          }

          if (req.method === "POST") {
            let rawBody = "";

            for await (const chunk of req) {
              rawBody += chunk.toString();

              if (rawBody.length > 100_000) {
                res.statusCode = 413;
                res.setHeader("Content-Type", "application/json");
                return res.end(JSON.stringify({
                  success: false,
                  message: "Permintaan terlalu besar.",
                }));
              }
            }

            let payload;

            try {
              payload = JSON.parse(rawBody);
            } catch {
              res.statusCode = 400;
              res.setHeader("Content-Type", "application/json");
              return res.end(JSON.stringify({
                success: false,
                message: "Format JSON tidak valid.",
              }));
            }

            if (!allowedActions.has(payload.action)) {
              res.statusCode = 400;
              res.setHeader("Content-Type", "application/json");
              return res.end(JSON.stringify({
                success: false,
                message: "Aksi tidak diizinkan.",
              }));
            }

            const upstream = await fetch(target.toString(), {
              method: "POST",
              redirect: "follow",
              headers: {
                "Content-Type": "text/plain;charset=utf-8",
              },
              body: JSON.stringify(payload),
            });

            return await sendResponse(upstream, res);
          }

          res.statusCode = 405;
          res.setHeader("Allow", "GET, POST");
          res.setHeader("Content-Type", "application/json");
          return res.end(JSON.stringify({
            success: false,
            message: "Metode tidak diizinkan.",
          }));
        } catch (error) {
          console.error("[PMR API]", error);

          if (!res.headersSent) {
            res.statusCode = 502;
            res.setHeader("Content-Type", "application/json");
          }

          res.end(JSON.stringify({
            success: false,
            message: "Proxy gagal menghubungi Apps Script.",
          }));
        }
      });
    },
  };
}

async function sendResponse(upstream, res) {
  const text = await upstream.text();
  const contentType = upstream.headers.get("content-type") || "";

  res.statusCode = upstream.ok ? 200 : 502;

  res.setHeader(
    "Content-Type",
    contentType.includes("json")
      ? "application/json; charset=utf-8"
      : "text/plain; charset=utf-8"
  );

  res.end(text);
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiUrl = env.VITE_API_URL;

  if (!apiUrl) {
    throw new Error("VITE_API_URL belum diatur dalam file .env");
  }

  return {
    // Nama repository GitHub Pages
    base: mode === "production" ? "/portal-pmr-smanel/" : "/",

    plugins: [
      react(),
      appsScriptProxy(apiUrl),
    ],
  };
});
