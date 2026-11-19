# Advent-Calendar

A password-protected advent calendar for one person, self-hosted. Each door opens at a set time on its day and holds a surprise: a letter, a list, a voucher, photos or a voice message.

The server keeps each surprise until its door opens: a locked day and its media answer `403`, so reading the page source or guessing a URL reveals nothing early. An optional author password opens every door ahead of time, to check the content.

The interface is in French.

## Content

Everything personal lives in a content folder outside the repository (`content/` is ignored by Git). `examples/content/` shows the layout:

```
content/
  calendar.json        settings
  days/
    01/
      day.json         the blocks of door 1
      letter.txt       a text file a block points to
    02/
      day.json
      photo.jpg
```

### `calendar.json`

| Key            | Meaning                                                                                              | Example           |
| -------------- | ---------------------------------------------------------------------------------------------------- | ----------------- |
| `title`        | Page title                                                                                           | `"Calendrier"`    |
| `banner`       | Scrolling text at the top; `""` or absent hides it                                                   | `"Joyeux Noël ★"` |
| `notification` | Notification sent when a door opens, `{day}` for its number; absent: "La porte {day} est ouverte 🎁" | `"Porte {day} !"` |
| `year`         | Year of the calendar                                                                                 | `2026`            |
| `month`        | Month, 1 to 12                                                                                       | `12`              |
| `firstDay`     | First door                                                                                           | `1`               |
| `lastDay`      | Last door                                                                                            | `25`              |
| `timezone`     | IANA time zone the unlock time is read in                                                            | `"Europe/Paris"`  |
| `unlockTime`   | Local time at which door N opens on day N, `HH:MM`, 24 hours                                         | `"09:00"`         |
| `sizes`        | Door sizes chosen by hand, by door number (see below)                                                | `{ "5": "big" }`  |
| `animations`   | Opening animations chosen by hand, by door number (see below)                                        | `{ "7": "tear" }` |

The server reads `calendar.json` once at start: restart it after a change. Day folders are read on each request, so a day can be added or fixed while the server runs.

### `day.json`

```json
{
  "title": "Optional heading",
  "notification": "Optional, replaces the one of calendar.json for this day",
  "blocks": [
    { "type": "letter", "file": "letter.txt" },
    { "type": "text", "text": "A short paragraph." },
    { "type": "list", "title": "Optional", "items": ["One", "Two"] },
    { "type": "voucher", "title": "Un resto au choix", "details": "Optional" },
    {
      "type": "image",
      "file": "photo.jpg",
      "alt": "Optional",
      "caption": "Optional"
    },
    { "type": "audio", "file": "voice.m4a", "caption": "Optional" }
  ]
}
```

- `text` and `letter` take either `text` or `file` (a text file in the same folder). Blank lines separate paragraphs.
- File names are plain names in the day's folder, without any folder part.
- Images: `.jpg`, `.jpeg`, `.png`, `.webp`, `.gif`. Audio: `.mp3`, `.m4a`, `.aac`, `.ogg`, `.wav`.
- A door with no folder shows as empty once open.
- `notification` shows on the lock screen before the door is opened: it should tease, not reveal. `{day}` stands for the door number here too.

### Door sizes

Each door is a tile in a three-column grid: `small` (one column, one row), `tall` (two rows), `wide` (two columns) or `big` (two of each). A door keeps its size once opened, and shows a preview of its day; text longer than the tile fades out, and tapping the open door shows the whole day.

The size comes from the day's first block:

| First block                | Size    |
| -------------------------- | ------- |
| `letter`, `list`           | `tall`  |
| `text`, `voucher`, `audio` | `small` |
| `image`, landscape         | `wide`  |
| `image`, portrait          | `tall`  |
| `image`, roughly square    | `big`   |

A photo counts as landscape when its width is at least 1.25 times its height, and as portrait the other way round. A door with no folder, a broken `day.json` or an unreadable photo is `small`. `sizes` in `calendar.json` overrides any door. An opened door is remembered in the browser that opened it.

### Door animations

A door plays an animation the first time it opens in a browser:

| Name     | Motion                                     |
| -------- | ------------------------------------------ |
| `swing`  | Swings open on a hinge at its left         |
| `double` | Opens as two halves from the middle        |
| `tear`   | Rips along a zigzag; both pieces fall away |
| `lid`    | Lifts off like a box lid and fades         |
| `fade`   | Fades into its preview                     |
| `none`   | No animation: the preview shows at once    |

`animations` in `calendar.json` chooses one per door. Any other door takes one of the first five from its number, so two days in a row never share one, and author mode shows the same one the guest will see. A door opened on an earlier visit shows open at once, and so does every door when the device asks for reduced motion.

## Notifications

With a VAPID key set (see "Configuration"), the header shows a bell that asks the browser for permission to send notifications. Once allowed, the bell disappears, and each day at the unlock time every subscribed device receives the door's notification, even with the site closed. Tapping it opens the calendar.

- The server checks once a minute. A server that was down at the unlock time sends the notification when it comes back, the same day only; an earlier day is never sent late.
- A phone offline at the unlock time still receives the notification once back online, until midnight.
- In author mode, a paper-plane button takes the bell's place: it sends a test notification to the device that taps it, and to no other.
- To stop notifications, block them in the browser's site settings. The server forgets a device once its push service reports it gone.
- Without a VAPID key, there is no bell and nothing is sent.

Notifications need HTTPS, or `http://localhost`. To test on an Android phone against a local server, connect it over USB with debugging on, run `adb reverse tcp:3000 tcp:3000`, and open `http://localhost:3000` on the phone. On an iPhone, notifications only work for a site added to the Home Screen.

The server writes in one folder, `ADVENT_STATE_DIR`: `subscriptions.json` (the subscribed devices) and an empty `sent-YYYY-MM-DD` file per day sent. Two servers sharing the folder during a deploy send each day once. Losing the folder costs nothing lasting: each browser subscribes again at its next visit.

## Configuration

Environment variables:

| Variable                      | Required     | Meaning                                                                         |
| ----------------------------- | ------------ | ------------------------------------------------------------------------------- |
| `ADVENT_PASSWORD_HASH`        | yes          | Hash of the shared password, from `pnpm make-hash`                              |
| `ADVENT_AUTHOR_PASSWORD_HASH` | no           | Hash of the author password, which opens every door early                       |
| `ADVENT_SESSION_SECRET`       | yes          | At least 32 characters; signs the login cookie                                  |
| `ADVENT_CONTENT_DIR`          | no           | Content folder; `content` by default, `/content` in the image                   |
| `ADVENT_VAPID_PRIVATE_KEY`    | no           | Turns notifications on; from `pnpm make-vapid`                                  |
| `ADVENT_VAPID_SUBJECT`        | with the key | Contact for the push services: the site's `https://` URL or a `mailto:` address |
| `ADVENT_STATE_DIR`            | no           | Folder the server writes; `state` by default, `/state` in the image             |
| `ADVENT_HOST`                 | no           | Address to listen on; `127.0.0.1` by default, `0.0.0.0` in the image            |
| `ADVENT_PORT`                 | no           | Port; `3000` by default                                                         |

A login lasts 60 days. Changing `ADVENT_SESSION_SECRET` signs every device out. After five wrong passwords in a row, the login waits 1, then 5, then 15 minutes between tries.

To hash a password:

```bash
pnpm make-hash                      # asks for it
printf %s 'the password' | pnpm make-hash
```

With the image only: `printf %s 'the password' | docker run --rm -i ghcr.io/enoal-fauchille-bolle/advent-calendar node dist/cli/hash-password.js`.

To make a VAPID key: `pnpm make-vapid`, or with the image only `docker run --rm ghcr.io/enoal-fauchille-bolle/advent-calendar node dist/cli/make-vapid.js`. The server computes the public key from it. A new key makes every saved subscription useless until each browser visits again.

## Run locally

Requires Node 24 and pnpm.

```bash
pnpm install
export ADVENT_PASSWORD_HASH="$(printf %s 'test' | pnpm make-hash)"
export ADVENT_AUTHOR_PASSWORD_HASH="$(printf %s 'author' | pnpm make-hash)"
export ADVENT_SESSION_SECRET="$(openssl rand -base64 48)"
# Optional, for notifications
export ADVENT_VAPID_PRIVATE_KEY="$(pnpm make-vapid)"
export ADVENT_VAPID_SUBJECT=https://example.com
ADVENT_CONTENT_DIR=examples/content pnpm dev
```

Then open `http://127.0.0.1:3000`. `test` shows the doors as they will appear on the day; `author` opens every door.

## Run with Docker

`deploy/.env` holds the secrets (ignored by Git):

```bash
ADVENT_PASSWORD_HASH=scrypt:...
ADVENT_AUTHOR_PASSWORD_HASH=scrypt:...
ADVENT_SESSION_SECRET=...
# Optional, for notifications
ADVENT_VAPID_PRIVATE_KEY=...
ADVENT_VAPID_SUBJECT=https://avent.example.com
# Content folder on the host, relative to deploy/; the examples by default
ADVENT_CONTENT=../content
```

```bash
docker compose -f deploy/docker-compose.yml up -d --build
```

The `state` volume keeps the push subscriptions across restarts. The port is bound to `127.0.0.1:3000`, for a reverse proxy on the same host. Behind HTTPS, the proxy must send `X-Forwarded-Proto: https` so the login cookie is marked `Secure`. The proxy must not cache responses: media under `/media/` require the login cookie, and a cache keyed without it would serve them to anyone.

## Development

```bash
pnpm check    # types, lint, format, tests
pnpm build    # compiles to dist/
```

Commits follow Conventional Commits, checked by commitlint in a Git hook.

## License

MIT, see [LICENSE](LICENSE).

The fonts in `assets/fonts/`, Fraunces and Nunito, are under the SIL Open Font License 1.1: see [OFL-Fraunces.txt](assets/fonts/OFL-Fraunces.txt) and [OFL-Nunito.txt](assets/fonts/OFL-Nunito.txt).
