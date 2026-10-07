# DomainScout (@dakaio/domainscout-mcp)

Every good .com is taken. Find the ones that aren't.

DomainScout is an MCP server for bulk domain search. Your AI assistant brainstorms hundreds of
names, and DomainScout checks all of them in one call: which are free, what they cost and where
to buy them. It runs on your own machine. You need no account and no server of ours, and API keys
are optional.

Website: [domainscout.dakaio.com](https://domainscout.dakaio.com)

You ask your assistant *"I'm naming a note-taking app. Brainstorm 500 names and tell me which .com
domains are free."* The assistant calls `check_domains` once with all 500 names and gets back:

```text
Checked 500 domain(s) in 21.8s: 27 available, 473 taken.

AVAILABLE (cheapest known offer for each):
- quillloom.com: $10.46/yr at Cloudflare https://www.cloudflare.com/domains/search/?q=quillloom.com
- scribeloom.com: $10.46/yr at Cloudflare https://www.cloudflare.com/domains/search/?q=scribeloom.com
- scribebloom.com: $10.46/yr at Cloudflare https://www.cloudflare.com/domains/search/?q=scribebloom.com
...
TAKEN: quillwise.com, quillnest.com, quillflow.com, ...
```

Ask about a few favourites afterwards and each one gets every registrar's link and price. More
real output, including the command line and JSON: [examples](examples/README.md).

## Built for long lists

- **One call for the whole brainstorm.** Up to 500 domains per call by default
  (`DOMAINSCOUT_MAX_DOMAINS`); 500 .com names take about 20 seconds.
- **Readable answers.** With more than five free domains, each one gets a single line with its
  cheapest offer, so the answer stays short; every registrar's link is still in the structured
  result.
- **Polite to the registries.** Taken names usually stop at DNS, so the registries only see the
  names that might be free. Every server gets its own rate limit.

## How it checks

For each domain, in parallel and within polite rate limits:

1. **DNS.** If the TLD zone delegates the name, it is taken. This step is free and saves the
   registries' rate limits.
2. **The registry over RDAP**, the authoritative source. If the domain is found, it is taken;
   the result includes expiry, and a note when the domain is being deleted and may become
   available soon. A 404 means it is likely available.
3. **WHOIS**, only for TLDs without RDAP (for example `.io`, `.ru`, `.de`) or when RDAP fails.
4. **Your registrar API, optional.** If you set an API key, the registrar confirms that each
   free-looking name can really be bought, flags premium names and gives the exact price.

Having no DNS never proves a domain is free: a bought but unused domain has no DNS either.
Without a registrar API key, "not in the registry" is reported as `likely_available`. Premium
and registry-reserved names look the same there, so the registrar's page has the final price.

| Status | Meaning |
|---|---|
| `available` | A registrar API confirmed it can be registered; `premium` says whether it costs extra |
| `likely_available` | Not in the registry or DNS, not confirmed by a registrar |
| `taken` | Registered |
| `reserved` | Blocked by the registry, or the registrar cannot sell it |
| `unknown` | Could not verify right now (timeout, rate limit); try again |

Free domains come with buy links for Cloudflare, Porkbun, Namecheap, Spaceship, GoDaddy,
Name.com, Dynadot, NameSilo and Hover. Links are sorted by the cost of the first term plus one
renewal year, using public price lists (Cloudflare, Porkbun) or the exact price from your
registrar API.

## Install

Node 20 or newer.

**Claude Code**

```bash
claude mcp add domainscout -- npx -y @dakaio/domainscout-mcp
```

**Claude Desktop / Cursor**: add to the MCP config:

```json
{
  "mcpServers": {
    "domainscout": {
      "command": "npx",
      "args": ["-y", "@dakaio/domainscout-mcp"],
      "env": { "DOMAINSCOUT_TLDS": "com,net,ai,io" }
    }
  }
}
```

On Windows, if `npx` is not found, use `"command": "cmd"` with
`"args": ["/c", "npx", "-y", "@dakaio/domainscout-mcp"]`.

Then just ask: *"Brainstorm 200 names for my coffee subscription app and tell me which .com
domains are free."*

**From source:** `npm install && npm run build`, then run `node /path/to/domainscout-mcp/dist/index.js`
in place of `npx -y @dakaio/domainscout-mcp`.

## Settings

Set these as environment variables in the MCP config. All are optional.

| Variable | Default | What it does |
|---|---|---|
| `DOMAINSCOUT_TLDS` | `com,net,ai` | TLDs tried for names given without one |
| `DOMAINSCOUT_REGISTRARS` | all | Registrars to show buy links for, e.g. `cloudflare,porkbun,namecheap` |
| `DOMAINSCOUT_MAX_CONCURRENCY` | `10` | Network requests in flight at once |
| `DOMAINSCOUT_PER_HOST_CONCURRENCY` | `2` | Requests in flight to one RDAP server |
| `DOMAINSCOUT_TIMEOUT_MS` | `10000` | Timeout of one request |
| `DOMAINSCOUT_MAX_DOMAINS` | `500` | Domains per call, after adding TLDs |
| `DOMAINSCOUT_CONFIRM_MAX` | `50` | Free domains per call confirmed through your registrar API |
| `DOMAINSCOUT_DNS` | `on` | DNS pre-check |
| `DOMAINSCOUT_DNS_SERVERS` | system | DNS servers to use, comma-separated |
| `DOMAINSCOUT_PRICES` | `on` | Public price lists |
| `DOMAINSCOUT_AFFILIATE` | `on` | Affiliate buy links (`off` gives plain links) |

Each RDAP server gets at most 5 requests per second. Each WHOIS server gets one query at a
time, at most one per second. A server that answers "too many requests" is left alone for a while.

## Registrar API keys (optional)

With a key, free-looking names are confirmed: you get `available` or `reserved` instead of
`likely_available`, premium names are flagged, and the registrar's exact price is shown. One
key is enough. With several, the APIs are asked in this order, each name only until one answers.

| Registrar | Variables | Where to get it |
|---|---|---|
| Name.com | `DOMAINSCOUT_NAMECOM_USERNAME`, `DOMAINSCOUT_NAMECOM_TOKEN` | Account Settings → Security → API Tokens |
| Cloudflare | `DOMAINSCOUT_CLOUDFLARE_ACCOUNT_ID`, `DOMAINSCOUT_CLOUDFLARE_API_TOKEN` | API token with Registrar permission. The Registrar API is in beta |
| Spaceship | `DOMAINSCOUT_SPACESHIP_API_KEY`, `DOMAINSCOUT_SPACESHIP_API_SECRET` | API Manager; the key needs the `domains:read` scope |
| Porkbun | `DOMAINSCOUT_PORKBUN_API_KEY`, `DOMAINSCOUT_PORKBUN_SECRET_KEY` | porkbun.com/account/api |

Porkbun throttles an account to 50 names per 5 minutes for a day once it has checked about
1,800 names in 3 hours while registering few of them. `DOMAINSCOUT_CONFIRM_MAX` keeps every
call well below that. A tool call can also pass `confirm: false` to skip confirmation for a
large list.

Each key is sent only to its own registrar's API, and it never appears in output, logs or error
messages. If a registrar rejects a key, the result says so in its notes, and the check still
works without that registrar.

## Privacy

Your queries go straight from your machine to:

- your DNS resolver,
- the registries (RDAP/WHOIS),
- two public price lists: the Porkbun price API, and cfdomainpricing.com, a community mirror
  of Cloudflare's prices,
- the APIs of registrars whose keys you set.

`DOMAINSCOUT_PRICES=off` turns the price lists off. Nothing goes to a server of this project,
because there is none.

## Affiliate links

Some buy links may be affiliate links. When they are, the result says so, and buying through
them earns the project a commission at no extra cost to you. Links are always ordered by price
and never by commission. `DOMAINSCOUT_AFFILIATE=off` turns them off.

## Command line

```bash
npx @dakaio/domainscout-mcp check acme getacme.io --tlds com,dev
npx @dakaio/domainscout-mcp check acme --json --no-confirm
npx @dakaio/domainscout-mcp check $(cat names.txt) --tlds com
```

## Development

```bash
npm run verify     # typecheck + lint (Biome) + tests with coverage thresholds
npm run build
```

| Path | What it is |
|---|---|
| `src/core/` | The checking funnel, input parsing, shared types, network limits and retries |
| `src/checkers/` | DNS, RDAP and WHOIS lookups |
| `src/confirm/` | Confirmation through registrar APIs, one class per registrar |
| `src/pricing/`, `src/registrars/` | Public price lists, buy links and affiliate templates |
| `src/report/`, `src/messages/` | The text report and every text shown to people or to the model |
| `src/scout/`, `src/server/`, `src/cli/` | The check as a whole, the MCP server and the command line |
| `test/` | Vitest tests; the network is faked, except for a local WHOIS server |
| `examples/` | Real output of the tool |
| `site/` | The landing page at domainscout.dakaio.com: static HTML, released by a `landing-v<version>` tag (`npm --prefix site run release`) |

## License

MIT
