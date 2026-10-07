# Security

## Reporting a vulnerability

Please report security problems privately, through GitHub: open the repository's **Security** tab
and choose **Report a vulnerability**. Do not open a public issue for them. You will get an answer
within a few days, and a fix is released as a new version on npm.

Only the latest version is supported.

## How DomainScout handles your data

- **Read-only.** The tool only looks domains up. It never registers, buys or changes anything.
- **No server in the middle.** It runs on your machine. Queries go straight to your DNS resolver,
  to the registries (RDAP and WHOIS), to two public price lists, and to the registrar APIs whose
  keys you set. Nothing is sent to a server of this project, because there is none.
- **API keys stay yours.** Registrar API keys are optional. Each one is read from an environment
  variable and sent only to its own registrar's API over HTTPS. Keys never appear in the output,
  in logs or in error messages.
- **Polite by design.** Every server gets its own rate limit, and a server that answers "too many
  requests" is left alone for a while.

`DOMAINSCOUT_PRICES=off` turns the price lists off, so that only DNS and the registries are asked.
