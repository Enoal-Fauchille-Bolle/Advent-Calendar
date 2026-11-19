import { serve } from "@hono/node-server";
import webpush from "web-push";
import { createApp, type PushDeps } from "./app.tsx";
import { LoginThrottle } from "./auth/throttle.ts";
import {
  loadClientScript,
  loadFonts,
  loadIcons,
  loadServiceWorker,
  loadStyle,
} from "./client-script.ts";
import { ConfigError, readConfig } from "./config.ts";
import { sendTest, startDoorSchedule } from "./push/schedule.ts";
import { PushStore } from "./push/store.ts";
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

const log = (line: string) => {
  console.log(`${new Date().toISOString()} ${line}`);
};

// Web push, when a VAPID key is set: the state folder must be writable.
let push: PushDeps | undefined;
let stopSchedule = () => {};
if (config.push !== undefined) {
  const store = new PushStore(config.stateDir);
  try {
    store.prepare();
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    fail(`Cannot write in ADVENT_STATE_DIR (${config.stateDir}): ${reason}`);
  }
  const vapidDetails = {
    subject: config.push.subject,
    publicKey: config.push.publicKey,
    privateKey: config.push.privateKey,
  };
  const pushDeps = {
    settings,
    contentDir: config.contentDir,
    store,
    send: async (
      subscription: webpush.PushSubscription,
      payload: string,
      options: { TTL: number; urgency: "high" },
    ) => {
      await webpush.sendNotification(subscription, payload, {
        ...options,
        vapidDetails,
      });
    },
    now: () => new Date(),
    log,
  };
  push = {
    publicKey: config.push.publicKey,
    store,
    test: (endpoint) => sendTest(pushDeps, endpoint),
  };
  stopSchedule = startDoorSchedule(pushDeps);
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
  serviceWorker: loadServiceWorker(),
  icons: loadIcons(),
  push,
});

const server = serve(
  { fetch: app.fetch, hostname: config.host, port: config.port },
  (info) => {
    console.log(
      `${new Date().toISOString()} listening on http://${info.address}:${String(info.port)} content=${config.contentDir} author_mode=${config.authorPasswordHash === undefined ? "off" : "on"} push=${push === undefined ? "off" : `on state=${config.stateDir}`}`,
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
  stopSchedule();
  server.close(() => process.exit(0));
}
process.on("SIGINT", () => {
  shutdown("SIGINT");
});
process.on("SIGTERM", () => {
  shutdown("SIGTERM");
});
