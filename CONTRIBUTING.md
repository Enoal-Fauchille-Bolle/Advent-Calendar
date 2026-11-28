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

- **Media**: `examples/tools/make-media.ts` draws the pictures and plays the melodies of the examples (ffmpeg). Screenshots have their own section below.

## Checks

- `pnpm check` runs the type check, eslint, prettier and the tests (vitest). The release workflow runs it too.
- Before each commit, a hook formats the staged files with prettier and lints them with eslint.
- A test keeps the compose file shown in the README equal to `deploy/docker-compose.yml`.

## Interface languages

Every text of the interface lives in `src/i18n/`, one file per language (`en.ts`, `fr.ts`), each implementing the `Strings` type of `types.ts`.

- **Change a text**: edit it in every language file. The texts the browser script shows sit under `client`, sent with the page.
- **Add a text**: add its key to `Strings` in `types.ts` first. The type check in `pnpm check` then fails until every language file has it.
- **Add a language**: copy `en.ts` to a file named after the language code (`de.ts`, for example), translate it, and add it to `TRANSLATIONS` in `index.ts`. From then on, `language` in `calendar.json` accepts the code. Add it to the `language` row of [docs/content.md](docs/content.md) and to the features list of the README, and update the test "has English and French, English first" in `i18n.test.ts`.
- **Typography**: `typography.ts` applies a language's spacing rules to the text of the days. In French, the space before `: ; ! ?` and `»`, and after `«`, becomes a no-break space (U+00A0, since Fraunces and Nunito lack the narrow U+202F). A language with rules of its own gets a function there, called from `polishDay`.

## Screenshots

`examples/tools/make-screenshot.ts` takes the README pictures (`docs/images/screenshot-light.png`, `screenshot-dark.png`), the picture of a shared link's card (`assets/og.png`) and the repository's social preview on GitHub (`docs/images/social-preview.png`). Run it again after a visual change, from the repository root:

```bash
node examples/tools/make-screenshot.ts --date 2026-12-14          # all three
node examples/tools/make-screenshot.ts readme --date 2026-12-14   # the README pictures only
node examples/tools/make-screenshot.ts share --date 2026-12-14    # assets/og.png only
node examples/tools/make-screenshot.ts github --date 2026-12-14   # the social preview only
```

It needs Firefox and an ffmpeg built with librsvg. `--date` sets the day shown in the header, so the date fits the calendar; without it, the header shows the day the script runs. The social preview is not read from the repository: after a change, upload it by hand under the repository's Settings → Social preview → Edit.

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
