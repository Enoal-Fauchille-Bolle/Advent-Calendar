# Writing the content

Everything personal lives in a content folder outside the repository (`content/` is ignored by Git). `examples/content/` is a full calendar: days 1 to 14 show what it can hold, days 15 to 25 explain each feature. Its layout:

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

## `calendar.json`

| Key            | Meaning                                                                                                              | Example               |
| -------------- | -------------------------------------------------------------------------------------------------------------------- | --------------------- |
| `title`        | Page title                                                                                                           | `"Advent Calendar"`   |
| `language`     | Language of the interface: `en` or `fr`; absent: `en`                                                                | `"fr"`                |
| `banner`       | Scrolling text at the top; `""` or absent hides it                                                                   | `"Merry Christmas ★"` |
| `bannerSpeed`  | Speed of the banner text, in pixels per second, above 0; absent: 10                                                  | `40`                  |
| `notification` | Notification sent when a door opens, `{day}` for its number; absent: "Door {day} is open 🎁", in the chosen language | `"Door {day}!"`       |
| `year`         | Year of the calendar                                                                                                 | `2026`                |
| `month`        | Month, 1 to 12                                                                                                       | `12`                  |
| `firstDay`     | First door                                                                                                           | `1`                   |
| `lastDay`      | Last door                                                                                                            | `25`                  |
| `timezone`     | IANA time zone the unlock time is read in                                                                            | `"Europe/Paris"`      |
| `unlockTime`   | Local time at which door N opens on day N, `HH:MM`, 24 hours                                                         | `"09:00"`             |
| `sizes`        | Door sizes chosen by hand, by door number (see below)                                                                | `{ "5": "big" }`      |
| `animations`   | Opening animations chosen by hand, by door number (see below)                                                        | `{ "7": "tear" }`     |

The server reads `calendar.json` once at start: restart it after a change. Day folders are read on each request, so a day can be added or fixed while the server runs.

## `day.json`

```json
{
  "title": "Optional heading",
  "notification": "Optional, replaces the one of calendar.json for this day",
  "blocks": [
    { "type": "letter", "file": "letter.txt" },
    { "type": "text", "text": "A short paragraph." },
    { "type": "list", "title": "Optional", "items": ["One", "Two"] },
    {
      "type": "voucher",
      "title": "A restaurant of your choice",
      "details": "Optional"
    },
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

## Door sizes

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

## Door animations

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
