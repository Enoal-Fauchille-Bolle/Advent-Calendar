export class ConfigError extends Error {}

export interface Config {
  host: string;
  port: number;
  contentDir: string;
  /** Hash of the shared password, from `pnpm make-hash`. */
  passwordHash: string;
  /** Hash of the author password, which opens every door early; optional. */
  authorPasswordHash: string | undefined;
  /** Key that signs the login cookie; changing it logs everyone out. */
  sessionSecret: string;
}

const SESSION_SECRET_MIN_LENGTH = 32;

function isHash(value: string): boolean {
  return value.startsWith("scrypt:") && value.split(":").length === 6;
}

/** Reads the configuration from environment variables. */
export function readConfig(env: NodeJS.ProcessEnv): Config {
  const problems: string[] = [];

  const portText = env.ADVENT_PORT ?? "3000";
  const port = Number(portText);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    problems.push(`ADVENT_PORT must be a port number, got "${portText}"`);
  }

  const passwordHash = env.ADVENT_PASSWORD_HASH ?? "";
  if (!isHash(passwordHash)) {
    problems.push(
      "ADVENT_PASSWORD_HASH must be set to the output of `pnpm make-hash`",
    );
  }

  const author = env.ADVENT_AUTHOR_PASSWORD_HASH;
  const authorPasswordHash =
    author === undefined || author === "" ? undefined : author;
  if (authorPasswordHash !== undefined && !isHash(authorPasswordHash)) {
    problems.push(
      "ADVENT_AUTHOR_PASSWORD_HASH must be empty or the output of `pnpm make-hash`",
    );
  }
  if (authorPasswordHash !== undefined && authorPasswordHash === passwordHash) {
    problems.push(
      "ADVENT_AUTHOR_PASSWORD_HASH must differ from ADVENT_PASSWORD_HASH",
    );
  }

  const sessionSecret = env.ADVENT_SESSION_SECRET ?? "";
  if (sessionSecret.length < SESSION_SECRET_MIN_LENGTH) {
    problems.push(
      `ADVENT_SESSION_SECRET must hold at least ${String(SESSION_SECRET_MIN_LENGTH)} characters (for example \`openssl rand -base64 48\`)`,
    );
  }

  if (problems.length > 0) {
    throw new ConfigError(`Invalid configuration:\n- ${problems.join("\n- ")}`);
  }

  return {
    host: env.ADVENT_HOST ?? "127.0.0.1",
    port,
    contentDir: env.ADVENT_CONTENT_DIR ?? "content",
    passwordHash,
    authorPasswordHash,
    sessionSecret,
  };
}
