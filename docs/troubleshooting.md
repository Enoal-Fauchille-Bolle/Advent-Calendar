# Troubleshooting

Most problems leave a line in the server log. With Docker, read it from the folder of the compose file:

```bash
docker compose logs advent-calendar
```

Without Docker, the log is the terminal that runs the server.

## The site does not answer

### "Connection refused", or the container keeps restarting

The server checks its settings and `calendar.json` when it starts, and stops at the first problem. Nothing listens on the port any more, so the browser or the proxy reports a refused connection, and Docker restarts the container again and again. The last lines of the log name the problem:

| Message in the log                                                         | Cause and fix                                                                                                                                                                                                  |
| -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Invalid configuration:` followed by a list                                | An environment variable is missing or wrong. Each line names it; see [Configuration](hosting.md#configuration).                                                                                                |
| `Cannot read /content/calendar.json: ENOENT: no such file or directory`    | The content folder has no `calendar.json` at its root. Check the folder `ADVENT_CONTENT` names (`./content` next to the compose file by default) and its [layout](content.md).                                 |
| `Cannot read /content/calendar.json: EACCES: permission denied`            | The image runs as the user `node` (uid 1000), which cannot read the file. Make the content readable by everyone: `chmod -R a+rX content`.                                                                      |
| `Cannot read /content/calendar.json: Expected double-quoted property name` | The file is not valid JSON, often because of a comma after the last item. The end of the message gives the line and column.                                                                                    |
| `Invalid calendar.json:` then `✖ Unrecognized key: "colour"`               | A key this version does not know: a spelling mistake, or a key from a newer release on an older image (`language` needs `0.3.0` or later). The [settings table](content.md#calendarjson) lists the known keys. |
| `Invalid calendar.json:` with another line                                 | A value is out of range or of the wrong kind, such as `unlockTime` without its leading zero (`9:00` instead of `09:00`) or a `lastDay` past the end of the month.                                              |
| `Cannot write in ADVENT_STATE_DIR (/state): EACCES: permission denied`     | Notifications are on, and the state folder is not writable by uid 1000. The `state` volume of the compose file is; a folder of the host mounted in its place needs `chown 1000:1000` on that folder.           |
| `Cannot listen on 127.0.0.1:3000: listen EADDRINUSE`                       | Another program uses the port. Pick another with `ADVENT_PORT`, or with Docker `ADVENT_PUBLISHED_PORT` (Docker reports that conflict itself, when the container starts).                                       |

After a fix, start the server again: `docker compose up -d`.

### "502 Bad Gateway" from the reverse proxy

The server runs (the log ends with `listening on`), but the proxy cannot reach it. By default the compose file publishes the port on the host's `127.0.0.1` only, and a proxy that runs in a container of its own cannot reach that address: inside a container, `127.0.0.1` is the container itself. Two ways out:

- **Same Docker network**: attach the proxy and `advent-calendar` to one Docker network, and point the proxy at `http://advent-calendar:3000`. The port then needs no publishing at all.
- **Publish on every interface**: `ADVENT_BIND=0.0.0.0` in `.env`, and point the proxy at the host's address. The port is then open to the network too, unless a firewall closes it.

A proxy installed on the host itself, outside Docker, reaches `127.0.0.1:3000` with the default settings.

## Logging in

### Back on the login page after the right password

The login cookie did not stick. The server marks it `Secure` when the proxy sends `X-Forwarded-Proto: https`, and a browser refuses a `Secure` cookie on a page served over plain HTTP. Serve the site over HTTPS, or make the proxy send the protocol the visitor really uses. A browser set to block the site's cookies gives the same result.

### "Too many tries. Try again in … min."

After five wrong passwords in a row, the login waits 1, then 5, then 15 minutes between tries. The count is shared by the whole site, not kept per person, so someone guessing also delays the right password. Restarting the server resets it.

### Every device is signed out

`ADVENT_SESSION_SECRET` changed: it signs the login cookie, so every cookie made with the old one stops working. A login also ends on its own after 60 days.

## Doors

### A door stays closed on its day

A door opens when the clock of the `timezone` in `calendar.json` reaches `unlockTime`, on its day of `month` and `year`. Check those four settings and the server's clock (`date` on the host: the container uses the host's clock). In author mode, the toolbar's "Opening dates" shows when each door opens.

### A change to `calendar.json` does not show

The server reads `calendar.json` once, when it starts. Restart it: `docker compose restart`. Changes to a day's folder (`day.json`, text files, photos) show at the next opening of the door, with no restart.

### "The door is stuck. Try again in a moment."

The day's `day.json` is broken: invalid JSON, an unknown key, a file it names that is missing, or a media format the calendar does not play. The log names the day and the problem, for example `Invalid /content/days/05/day.json: block 2: voice.opus is not a supported audio file`. In author mode, "Check content" in the toolbar reads every day at once and lists each broken or empty door.

### "This door is still empty."

The door's folder has no `day.json`. Folders are named with two digits: `days/05/`, not `days/5/`.

### A door opened on one device is closed on another

Which doors are open is remembered by each browser, on its device. Another phone, another browser, or cleared browser data shows the doors closed again; they open again with a tap, as long as their day has come.

## Photos and voice messages

### A photo or a voice message does not play

The calendar takes photos in `.jpg`, `.jpeg`, `.png`, `.webp` and `.gif`, and sound in `.mp3`, `.m4a`, `.aac`, `.ogg` and `.wav`. Other formats, such as `.heic` photos or `.opus` voice messages, make the door "stuck" (see above). Convert the file first, for example `ffmpeg -i voice.opus voice.m4a`, and change its name in `day.json`.

### Media shows without logging in, or an old version shows after a change

A cache between the visitor and the server keeps copies of the media. The server marks media as private (`Cache-Control: private`), but some proxies cache by file extension anyway, such as "Cache Assets" in Nginx Proxy Manager. Turn that cache off for the site, then purge the copies already kept (in the CDN as well, if the site goes through one). Without the login cookie, a media URL must answer `401`:

```bash
curl -I https://advent.example.com/media/1/photo.jpg
```

## Notifications

### No bell in the header

The bell shows only when all of these hold:

- **A VAPID key is set**: the log line `listening on …` ends with `push=on`. See [Notifications](hosting.md#notifications).
- **HTTPS**: browsers offer notifications only to a site served over HTTPS, or on `http://localhost`.
- **A browser with web push**: on an iPhone or iPad, only for a site added to the Home Screen, on iOS 16.4 or later.

Once notifications are allowed, the bell goes away on purpose. In author mode, a paper-plane button takes its place.

### Notifications do not arrive

- **Test**: in author mode, the paper-plane button sends a test notification to the device that taps it.
- **The log at the unlock time**: a line `push door=5 sent=1 gone=0 failed=0` follows each door. `sent=0` with `failed=0` means no device is subscribed; each failure adds a `push failed: …` line.
- **A new VAPID key**: subscriptions made with the old key stop working until each browser visits the site again.
- **The server was down at the unlock time**: the notification goes out when it comes back, the same day only.
