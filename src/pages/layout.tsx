import { raw } from "hono/html";
import type { PropsWithChildren } from "hono/jsx";

/** Width and height in pixels of `assets/og.png`. */
export const SHARE_IMAGE_SIZE = { width: 1200, height: 630 } as const;

/**
 * The card a messaging app shows for a shared link (Open Graph tags). `image` is the
 * picture's full address; without it the card has text only.
 */
export interface ShareCard {
  title: string;
  description: string;
  image?: string | undefined;
}

export function Layout({
  title,
  lang,
  share,
  children,
}: PropsWithChildren<{
  title: string;
  lang: string;
  share?: ShareCard | undefined;
}>) {
  return (
    <>
      {raw("<!DOCTYPE html>")}
      <html lang={lang}>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <meta name="robots" content="noindex, nofollow" />
          <title>{title}</title>
          {share === undefined ? null : (
            <>
              <meta property="og:type" content="website" />
              <meta property="og:title" content={share.title} />
              <meta property="og:description" content={share.description} />
              {share.image === undefined ? null : (
                <>
                  <meta property="og:image" content={share.image} />
                  <meta
                    property="og:image:width"
                    content={String(SHARE_IMAGE_SIZE.width)}
                  />
                  <meta
                    property="og:image:height"
                    content={String(SHARE_IMAGE_SIZE.height)}
                  />
                  {/* Asks for the large picture rather than a thumbnail. */}
                  <meta name="twitter:card" content="summary_large_image" />
                </>
              )}
            </>
          )}
          <link rel="stylesheet" href="/static/style.css" />
          {/* The SVG stays sharp in the tab; a browser that cannot show it takes the PNG. */}
          <link rel="icon" href="/static/icons/icon-192.png" type="image/png" />
          <link rel="icon" href="/static/icons/icon.svg" type="image/svg+xml" />
          <link rel="manifest" href="/manifest.webmanifest" />
        </head>
        <body>{children}</body>
      </html>
    </>
  );
}
