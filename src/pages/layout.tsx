import { raw } from "hono/html";
import type { PropsWithChildren } from "hono/jsx";

export function Layout({
  title,
  lang,
  children,
}: PropsWithChildren<{ title: string; lang: string }>) {
  return (
    <>
      {raw("<!DOCTYPE html>")}
      <html lang={lang}>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <meta name="robots" content="noindex, nofollow" />
          <title>{title}</title>
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
