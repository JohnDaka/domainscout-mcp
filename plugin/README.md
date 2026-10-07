# DomainScout plugin

Domain research for AI agents. Ask Claude to name your product, and it brainstorms hundreds of
names, checks every one of them in a single call and shows the free domains with their prices and
links to buy them at nine registrars, cheapest to own first.

The plugin has two parts:

- **The DomainScout MCP server** (`.mcp.json`), which provides the `check_domains` tool. Claude
  Code starts it on your computer with `npx -y @dakaio/domainscout-mcp@<version>`, the package
  published from [this repository](https://github.com/JohnDaka/domainscout-mcp) to npm.
- **The `find-domains` skill**, which tells Claude how to run a name search: understand the brief,
  brainstorm widely, check everything in one call, present the free names with prices and buy
  links, and iterate on what was taken.

It works in Claude Code and in Cowork sessions on your computer. It needs Node.js 20 or newer.

## Install

In Claude Code:

```
/plugin marketplace add JohnDaka/domainscout-mcp
/plugin install domainscout@domainscout
```

Then ask: *"Brainstorm 200 names for my coffee subscription app and tell me which .com domains
are free."*

## Settings

Claude Code asks for these when you enable the plugin; all of them are optional.

- **Default TLDs**: TLDs tried for names given without one, `com,net,ai` by default.
- **Registrar API keys** (Name.com, Cloudflare, Spaceship, Porkbun): with a key, free names are
  confirmed by that registrar, which also reveals premium names and exact prices. Keys are stored
  in Claude Code's secure storage and are sent only to that registrar's own API.

## What it runs and where your data goes

The server runs on your computer and has no account, no telemetry and no server of its own. To
check a name it sends the name, and nothing else, to:

- your DNS resolver;
- the domain's registry, over RDAP, or WHOIS where the registry has no RDAP;
- the APIs of the registrars whose keys you set.

It also downloads IANA's list of registries and two public price lists, the Porkbun price API and
cfdomainpricing.com; these downloads carry no domain names.

## Privacy Policy

The full policy is at [domainscout.dakaio.com/privacy.html](https://domainscout.dakaio.com/privacy.html).
In short: DomainScout collects no personal data, stores nothing beyond a short-lived cache in
memory while it runs, and shares the domain names you check only with the services listed above,
so they can answer. Questions: [GitHub issues](https://github.com/JohnDaka/domainscout-mcp/issues).

## License

MIT © dakaio.com
