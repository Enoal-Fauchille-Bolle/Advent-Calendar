# Credits

## Photos

From Wikimedia Commons, each under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) (public domain dedication). They were resized or cropped, and their metadata removed.

| File                              | Author                              | Source                                                                                                                   |
| --------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `content/days/03/snow-forest.jpg` | Romaine                             | [Bérismenil-Forest in snow (1)](<https://commons.wikimedia.org/wiki/File:B%C3%A9rismenil-Forest_in_snow_(1).jpg>)        |
| `content/days/07/candle.jpg`      | USER-62114                          | [Burning-candle](https://commons.wikimedia.org/wiki/File:Burning-candle.jpg)                                             |
| `content/days/10/gingerbread.jpg` | freestocks.org from Olsztyn, Poland | [Gingerbread cookies and milk](<https://commons.wikimedia.org/wiki/File:Gingerbread_cookies_and_milk_(31502263902).jpg>) |
| `content/days/14/gift.jpg`        | www.Pixel.la Free Stock Photos      | [Gift-present-christmas-xmas](<https://commons.wikimedia.org/wiki/File:Gift-present-christmas-xmas_(24217172092).jpg>)   |

## Drawings and melodies

The pictures of days 19, 20, 21 and 23 and every audio file are made by [`tools/make-media.ts`](tools/make-media.ts), under the repository's MIT license. The melodies are public-domain tunes: Jingle Bells (James Lord Pierpont, 1857), Deck the Halls (traditional Welsh) and We Wish You a Merry Christmas (traditional English).

To make them again, from the repository root, with ffmpeg built with librsvg, libmp3lame and libopus:

```bash
node examples/tools/make-media.ts
```
