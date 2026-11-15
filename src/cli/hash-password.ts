// Prints the hash of a password, for ADVENT_PASSWORD_HASH or ADVENT_AUTHOR_PASSWORD_HASH.
// Usage: pnpm make-hash            (asks for the password)
//        printf %s 'secret' | pnpm make-hash
import { createInterface } from "node:readline/promises";
import { hashPassword, PASSWORD_MAX_LENGTH } from "../auth/password.ts";

async function readPassword(): Promise<string> {
  // Piped in: readline would wait for a line end that `printf %s` never sends.
  if (!process.stdin.isTTY) {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
    return Buffer.concat(chunks)
      .toString("utf8")
      .replace(/\r?\n$/, "");
  }
  const input = createInterface({
    input: process.stdin,
    output: process.stderr,
  });
  const answer = await input.question("Password: ");
  input.close();
  return answer;
}

const password = await readPassword();
if (password === "" || password.length > PASSWORD_MAX_LENGTH) {
  console.error(
    `The password must hold 1 to ${String(PASSWORD_MAX_LENGTH)} characters.`,
  );
  process.exit(1);
}
console.log(await hashPassword(password));
