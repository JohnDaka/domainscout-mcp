---
name: find-domains
description: Find a free domain name. Use when the user is naming a product, startup, project, brand or website, asks for name ideas with an available domain, or asks whether a domain is free, taken or what it costs to register.
---

# Find free domain names

DomainScout's `check_domains` tool checks whether domains are free to register: hundreds in one
call, from the user's own machine, with prices and links to buy. You bring the ideas; the tool
checks them.

## Workflow

1. **Understand the brief.** If the user hasn't said, find out what the name is for, the tone
   they want (playful, serious, technical), any words to include or avoid, and which TLDs matter
   (.com only, or also .ai, .io, .app and others). Don't hold up the search for details that
   don't change the ideas much: ask at most one short question, or start with sensible defaults.
2. **Brainstorm wide.** Write 100 to 300 candidates across several styles: real words, compounds,
   blends, short invented words, a verb plus a noun, and names with a light prefix or suffix
   (get-, try-, -hq, -app). Most good .com names are taken, so volume is what finds the free ones.
3. **Check them all in one call.** Pass every candidate to `check_domains` at once. Give bare
   names (`acme`) when the user hasn't chosen a TLD, so the tool tries the default TLDs; give full
   domains (`acme.io`) when they have. Set `tlds` when the user named the TLDs they want.
4. **Present the free ones.** Lead with the best free names for the brief, not just the cheapest.
   Show a table: domain, price per year, renewal price, and the buy link from the tool's answer.
   Keep the tool's links as they are, and mention premium names and multi-year minimums that the
   tool reports.
5. **Iterate.** If few good names are free, learn from what was taken: try other blends, other
   TLDs, or a short prefix, and check the next batch in one call again.

## Reading the results

- **Available** was confirmed by a registrar; **likely available** means the registry has no
  record of it. Either can be registered, but say which one it is.
- **Taken** names may show when they expire; a name "in deletion" may become free soon.
- **Reserved** names are held by the registry and can't be registered the usual way.
- **Unknown** means a registry didn't answer in time: offer to check those names again later.
- The prices are standard prices for the TLD. Premium names cost more, and only a registrar
  API key (set in the plugin's settings) reveals their exact price.
