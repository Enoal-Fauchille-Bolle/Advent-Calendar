# Hosting

## Configuration

Environment variables:

| Variable                      | Required     | Meaning                                                                                            |
| ----------------------------- | ------------ | -------------------------------------------------------------------------------------------------- |
| `ADVENT_PASSWORD_HASH`        | yes          | Hash of the shared password, from `pnpm make-hash`                                                 |
| `ADVENT_AUTHOR_PASSWORD_HASH` | no           | Hash of the author password, which opens every door early                                          |
| `ADVENT_SESSION_SECRET`       | yes          | At least 32 characters; signs the login cookie                                                     |
| `ADVENT_CONTENT_DIR`          | no           | Content folder; `content` by default, `/content` in the image                                      |
| `ADVENT_VAPID_PRIVATE_KEY`    | no           | Turns notifications on; from `pnpm make-vapid`                                                     |
| `ADVENT_VAPID_SUBJECT`        | with the key | Contact for the push services: the site's `https://` URL or a `mailto:` address                    |
| `ADVENT_PUBLIC_URL`           | no           | The site's address, such as `https://advent.example.com`; adds the picture to a shared link's card |
| `ADVENT_STATE_DIR`            | no           | Folder the server writes; `state` by default, `/state` in the image                                |
| `ADVENT_HOST`                 | no           | Address to listen on; `127.0.0.1` by default, `0.0.0.0` in the image                               |
| `ADVENT_PORT`                 | no           | Port; `3000` by default                                                                            |

A login lasts 60 days. Changing `ADVENT_SESSION_SECRET` signs every device out. After five wrong passwords in a row, the login waits 1, then 5, then 15 minutes between tries.

A link to the site shared in a messaging app shows a card with a generic title and description, in the calendar's language, read from the login page. With `ADVENT_PUBLIC_URL` set, the card also shows a picture of the example calendar (`assets/og.png`, made by `node examples/tools/make-screenshot.ts share`): messaging apps need its full address.

Read by the compose file from `.env`, not by the server:

| Variable                | Default     | Meaning                                                                  |
| ----------------------- | ----------- | ------------------------------------------------------------------------ |
| `ADVENT_CONTENT`        | `./content` | Content folder on the host, relative to the compose file                 |
| `ADVENT_BIND`           | `127.0.0.1` | Host address the port is published on; `0.0.0.0` opens it to the network |
| `ADVENT_PUBLISHED_PORT` | `3000`      | Port on the host                                                         |

To hash a password:

```bash
pnpm make-hash                      # asks for it
printf %s 'the password' | pnpm make-hash
```

With the image only: `printf %s 'the password' | docker run --rm -i ghcr.io/enoal-fauchille-bolle/advent-calendar node dist/cli/hash-password.js`.

To make a VAPID key: `pnpm make-vapid`, or with the image only `docker run --rm ghcr.io/enoal-fauchille-bolle/advent-calendar node dist/cli/make-vapid.js`. The server computes the public key from it. A new key makes every saved subscription useless until each browser visits again.

## Notifications

With a VAPID key set (see "Configuration"), the header shows a bell that asks the browser for permission to send notifications. Once allowed, the bell disappears, and each day at the unlock time every subscribed device receives the door's notification, even with the site closed. Tapping it opens the calendar.

- The server checks once a minute. A server that was down at the unlock time sends the notification when it comes back, the same day only; an earlier day is never sent late.
- A phone offline at the unlock time still receives the notification once back online, until midnight.
- In author mode, a paper-plane button takes the bell's place: it sends a test notification to the device that taps it, and to no other.
- To stop notifications, block them in the browser's site settings. The server forgets a device once its push service reports it gone.
- Without a VAPID key, there is no bell and nothing is sent.

Notifications need HTTPS, or `http://localhost`. To test on an Android phone against a local server, connect it over USB with debugging on, run `adb reverse tcp:3000 tcp:3000`, and open `http://localhost:3000` on the phone. On an iPhone, notifications only work for a site added to the Home Screen.

The server writes in one folder, `ADVENT_STATE_DIR`: `subscriptions.json` (the subscribed devices) and an empty `sent-YYYY-MM-DD` file per day sent. Two servers sharing the folder during a deploy send each day once. Losing the folder costs nothing lasting: each browser subscribes again at its next visit.

## Docker

[`deploy/docker-compose.yml`](https://github.com/Enoal-Fauchille-Bolle/Advent-Calendar/blob/main/deploy/docker-compose.yml) runs the image `ghcr.io/enoal-fauchille-bolle/advent-calendar`, pinned to a release. `.env`, next to it, holds the secrets (ignored by Git):

```bash
ADVENT_PASSWORD_HASH=scrypt:...
ADVENT_AUTHOR_PASSWORD_HASH=scrypt:...
ADVENT_SESSION_SECRET=...
# Optional, for notifications
ADVENT_VAPID_PRIVATE_KEY=...
ADVENT_VAPID_SUBJECT=https://advent.example.com
```

The content folder is `content/` next to the compose file, or the folder `ADVENT_CONTENT` names. The image also holds the example calendar in `/app/examples/content`: uncomment the `environment` lines of the compose file to try it.

```bash
docker compose up -d
```

To update, change the version in the `image` line, read the release notes, and run `docker compose up -d` again.

The `state` volume keeps the push subscriptions across restarts. By default the port is bound to `127.0.0.1:3000`, for a reverse proxy on the same host; `ADVENT_BIND` and `ADVENT_PUBLISHED_PORT` change it. Behind HTTPS, the proxy must send `X-Forwarded-Proto: https` so the login cookie is marked `Secure`. The proxy must not cache responses: media under `/media/` require the login cookie, and a cache keyed without it would serve them to anyone.
