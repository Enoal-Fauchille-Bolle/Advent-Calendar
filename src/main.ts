import { serve } from "@hono/node-server";
import { createApp } from "./app.tsx";
import { LoginThrottle } from "./auth/throttle.ts";
import { loadClientScript, loadFonts, loadStyle } from "./client-script.ts";
import { ConfigError, readConfig } from "./config.ts";
import { readSettings, SettingsError } from "./settings.ts";

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

let config;
let settings;
try {
  config = readConfig(process.env);
  settings = readSettings(config.contentDir);
} catch (error) {
  if (error instanceof ConfigError || error instanceof SettingsError) {
    fail(error.message);
  }
  throw error;
}

const app = createApp({
  settings,
  contentDir: config.contentDir,
  passwordHash: config.passwordHash,
  authorPasswordHash: config.authorPasswordHash,
  sessionSecret: config.sessionSecret,
  throttle: new LoginThrottle(),
  clientScript: loadClientScript(),
  style: loadStyle(),
  fonts: loadFonts(),
});

const server = serve(
  { fetch: app.fetch, hostname: config.host, port: config.port },
  (info) => {
    console.log(
      `${new Date().toISOString()} listening on http://${info.address}:${String(info.port)} content=${config.contentDir} author_mode=${config.authorPasswordHash === undefined ? "off" : "on"}`,
    );
  },
);

server.on("error", (error: Error) => {
  fail(
    `Cannot listen on ${config.host}:${String(config.port)}: ${error.message}`,
  );
});

// Stop accepting connections and let running requests finish.
function shutdown(signal: string): void {
  console.log(`${new Date().toISOString()} stopping on ${signal}`);
  server.close(() => process.exit(0));
}
process.on("SIGINT", () => {
  shutdown("SIGINT");
});
process.on("SIGTERM", () => {
  shutdown("SIGTERM");
});
