import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

// The quick start shows the compose file in full: it must not drift from it.
it("shows deploy/docker-compose.yml in the README as it is", () => {
  const readme = readFileSync("README.md", "utf8");
  const block = /```yaml\n([\s\S]*?)```/.exec(readme)?.[1];
  expect(block).toBe(readFileSync("deploy/docker-compose.yml", "utf8"));
});
