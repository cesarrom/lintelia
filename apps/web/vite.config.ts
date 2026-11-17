import react from "@vitejs/plugin-react";
import { build as esbuild } from "esbuild";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv, type Plugin } from "vite";

/**
 * Clickjacking protection: pages of the app may only be framed by the app itself, except hosted forms
 * (`/embed/forms/:publicKey`), which the sites listed when the form was published may frame. The policy comes from
 * the API (`GET /public/forms/:key/embed-policy`); so may the client app (`/embed/app`, SDK embedded mode): the origins
 * listed in the app's settings (`GET /auth/client/embed-policy`, tenant from the host). In production the same header is set by the web server/CDN.
 */
function frameAncestors(apiBaseUrl: string): Plugin {
  const apply = async (url: string, host: string, setHeader: (value: string) => void) => {
    // The client app in embedded mode (SDK): the sites the institution listed in its app's settings.
    if (/^\/embed\/app(\/|\?|$)/.test(url)) {
      try {
        const response = await fetch(`${apiBaseUrl}/auth/client/embed-policy`, { headers: { "X-Tenant": host } });
        const policy = response.ok ? ((await response.json()) as { frameAncestors: string[] }) : { frameAncestors: [] };
        return setHeader(`frame-ancestors 'self' ${policy.frameAncestors.join(' ')}`.trim());
      } catch {
        return setHeader("frame-ancestors 'self'");
      }
    }
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
          await apply(req.url, String(req.headers.host ?? ""), (value) => res.setHeader("Content-Security-Policy", value));
        }
        next();
      });
    },
  };
}

/**
 * The client SDK for script tags (`<script src="https://<institution host>/fintivio-client.js">`, then
 * `FintivioClient.mount(...)`): built from packages/client-sdk, served in development and emitted with the build.
 */
function clientSdk(): Plugin {
  const entry = fileURLToPath(new URL("../../packages/client-sdk/src/browser.ts", import.meta.url));
  const bundle = async () => {
    const result = await esbuild({ entryPoints: [entry], bundle: true, format: "iife", minify: true, write: false, target: "es2019" });
    return result.outputFiles[0].text;
  };
  return {
    name: "fintivio-client-sdk",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url?.split("?")[0] !== "/fintivio-client.js") return next();
        try {
          res.setHeader("Content-Type", "text/javascript; charset=utf-8");
          res.setHeader("Access-Control-Allow-Origin", "*");
          res.end(await bundle());
        } catch (error) {
          res.statusCode = 500;
          res.end(String(error));
        }
      });
    },
    async generateBundle() {
      this.emitFile({ type: "asset", fileName: "fintivio-client.js", source: await bundle() });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react(), frameAncestors(env.VITE_FILES_API_BASE_URL || "http://localhost:8000"), clientSdk()],
    resolve: {
      alias: {
        "@": "/src",
      },
    },
  };
});
