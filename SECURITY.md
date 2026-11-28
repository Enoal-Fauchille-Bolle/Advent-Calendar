# Security policy

## Supported versions

Only the latest release receives security fixes. Check that a flaw is still present in it before reporting.

## Reporting a vulnerability

Report it privately through GitHub: open the repository's [Security tab](https://github.com/Enoal-Fauchille-Bolle/Advent-Calendar/security), then **Report a vulnerability**. A public issue or pull request would show the flaw to everyone before a fix exists.

A useful report gives the version, the steps to reproduce, and what an attacker gains.

## Scope

The calendar makes three promises. A way around any of them is a vulnerability:

- **Behind a password**: no page, photo or audio file is served without the calendar password.
- **Nothing shows early**: a door stays shut before its date and time, even for a logged-in visitor. Only the author password opens it.
- **Secrets stay on the server**: the password hashes, the session secret and the push key never reach a browser.

Out of scope: a reverse proxy or CDN set up against the [hosting guide](docs/hosting.md#docker), for example one that caches responses without the login cookie, and attacks that already need access to the server or to the content folder.

## Response

The project is maintained in spare time, so a report gets an answer as soon as possible, with no fixed delay. A fix ships in a new release, followed by a GitHub security advisory that credits the reporter, unless they prefer otherwise.
