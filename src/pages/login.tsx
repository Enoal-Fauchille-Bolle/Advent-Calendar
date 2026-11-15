import { strings } from "../strings.ts";
import { Layout } from "./layout.tsx";

export function LoginPage({
  title,
  error,
}: {
  title: string;
  error?: string | undefined;
}) {
  return (
    <Layout title={title}>
      <main class="login">
        <h1>{title}</h1>
        <form method="post" action="/login" class="login-form">
          <label for="password">{strings.login.password}</label>
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
          <button type="submit">{strings.login.submit}</button>
        </form>
      </main>
    </Layout>
  );
}
