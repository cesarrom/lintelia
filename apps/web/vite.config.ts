import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv, type Plugin } from "vite";

/**
 * Clickjacking protection: pages of the app may only be framed by the app itself, except hosted forms
 * (`/embed/forms/:publicKey`), which the sites listed when the form was published may frame. The policy comes from
 * the API (`GET /public/forms/:key/embed-policy`). In production the same header is set by the web server/CDN.
 */
function frameAncestors(apiBaseUrl: string): Plugin {
  const apply = async (url: string, setHeader: (value: string) => void) => {
    const match = url.match(/^\/embed\/forms\/([A-Za-z0-9_-]+)/);
    if (!match) return setHeader("frame-ancestors 'self'");
    try {
      const response = await fetch(`${apiBaseUrl}/public/forms/${match[1]}/embed-policy`);
      const policy = response.ok ? ((await response.json()) as { frameAncestors: string[] }) : { frameAncestors: [] };
      setHeader(`frame-ancestors 'self' ${policy.frameAncestors.join(' ')}`.trim());
    } catch {
      setHeader("frame-ancestors 'self'");
    }
  };
  return {
    name: "fintivio-frame-ancestors",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const accept = req.headers.accept ?? "";
        if (req.method === "GET" && accept.includes("text/html") && req.url) {
          await apply(req.url, (value) => res.setHeader("Content-Security-Policy", value));
        }
        next();
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react(), frameAncestors(env.VITE_FILES_API_BASE_URL || "http://localhost:8000")],
    resolve: {
      alias: {
        "@": "/src",
      },
    },
  };
});
