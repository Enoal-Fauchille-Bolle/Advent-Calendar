# Contributing

Advent-Calendar has a single maintainer. Bug reports and small fixes are welcome; for a larger change, open an issue first, so the idea can be agreed on before the work starts.

Everyone taking part follows the [code of conduct](CODE_OF_CONDUCT.md).

## Setup

- **Tools**: Node 24 and pnpm (the version is in `packageManager`, in `package.json`).
- **Install**: `pnpm install` installs the dependencies and the Git hooks (lefthook).
- **Run**: on the example calendar, as in "Without Docker" in the [README](README.md#without-docker).
- **Image**: to build and run it from the checkout, write `deploy/.env` as in [Hosting](docs/hosting.md#docker), with `ADVENT_CONTENT=../examples/content` for the examples, then:

  ```bash
  docker compose -f deploy/docker-compose.yml -f deploy/docker-compose.dev.yml up --build
  ```

  The dev file names the image `advent-calendar:dev`, so a local build never replaces the published one.

- **Media**: `examples/tools/make-media.ts` draws the pictures and plays the melodies of the examples (ffmpeg). `examples/tools/make-screenshot.ts` takes the picture of the README (Firefox and ffmpeg): run it again after a visual change.

## Checks

- `pnpm check` runs the type check, eslint, prettier and the tests (vitest). The release workflow runs it too.
- Before each commit, a hook formats the staged files with prettier and lints them with eslint.
- A test keeps the compose file shown in the README equal to `deploy/docker-compose.yml`.

## Commits

- [Conventional Commits](https://www.conventionalcommits.org/), checked by commitlint in the `commit-msg` hook (`commitlint.config.mjs`): one lowercase line, with no body, no footer and no `!`.
- The release notes (`cliff.toml`) keep `feat`, `fix`, `perf`, `build(deps…)` and reverts. `feat(security)` and `fix(security)` go in a Security group at the top. `fix(ci)` and the other types are left out, so the type follows what someone running the calendar would notice.

## AI assistance

Code, docs and issues written with an AI assistant follow the same rules as any other contribution:

- The author has read, understood and tested every line, and answers review questions about it.
- The pull request says which tool helped, and with what. One line is enough.

## Releases

1. Set the new version in the `image` line of `deploy/docker-compose.yml`, copy the file into the quick start of the README (`pnpm check` fails until both match), and commit.
2. Push a tag `vX.Y.Z`. The "Docker image" workflow (`.github/workflows/docker-publish.yml`) runs `pnpm check`, builds the image for `linux/amd64`, pushes `ghcr.io/enoal-fauchille-bolle/advent-calendar` as `X.Y.Z` and `latest`, then creates a GitHub release. git-cliff writes its notes from the commits since the previous final tag.
3. To test first, push `vX.Y.Z-rc.N`: the image only gets the tag `X.Y.Z-rc.N`, and the GitHub release is marked as a pre-release.
