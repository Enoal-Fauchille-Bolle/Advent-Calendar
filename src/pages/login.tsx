import type { Strings } from "../i18n/index.ts";
import { Layout, type ShareCard } from "./layout.tsx";

export function LoginPage({
  title,
  t,
  error,
  share,
}: {
  title: string;
  /** The interface texts. */
  t: Strings;
  error?: string | undefined;
  /** The card for a shared link: the login page is all a messaging app can read. */
  share?: ShareCard | undefined;
}) {
  return (
    <Layout title={title} lang={t.lang} share={share}>
      <main class="login">
        {/* Wrapping paper, ribbons and bow: drawn by the stylesheet, decoration only. */}
        <div class="gift" aria-hidden="true">
          <div class="ribbon ribbon--down"></div>
          <div class="ribbon ribbon--across"></div>
          <div class="gift-string"></div>
          <div class="bow">
            <i></i>
            <i></i>
            <b></b>
          </div>
        </div>
        <div class="login-tag">
          <h1>{title}</h1>
          <form method="post" action="/login" class="login-form">
            <label for="password">{t.login.password}</label>
            <input
              id="password"
              name="password"
              type="password"
              autocomplete="current-password"
              required
              autofocus
            />
            {error === undefined ? null : (
              <p class="login-error" role="alert">
                {error}
              </p>
            )}
            <button type="submit">{t.login.submit}</button>
          </form>
        </div>
      </main>
    </Layout>
  );
}
