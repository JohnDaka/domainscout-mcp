import {
  HTTPS_PROTOCOL,
  LABEL_SEPARATOR,
  RDAP_BOOTSTRAP_TTL_MS,
  RDAP_BOOTSTRAP_URL,
  Retry,
} from '../constants.js';
import { ensureOk } from '../core/http.js';
import type { Network } from '../core/network.js';
import { PromiseCache } from '../core/promise-cache.js';
import { withRetry } from '../core/retry.js';

/** IANA bootstrap file: `services` is a list of [TLDs, base URLs] pairs (RFC 9224). */
interface BootstrapFile {
  services?: Array<[string[], string[]]>;
}

/** RDAP base URL per TLD. */
type ServerList = ReadonlyMap<string, string>;

/** Base URLs must end with a slash, so relative paths resolve below them. */
const PATH_SEPARATOR = '/';

/** IANA's list of RDAP servers (RFC 9224), loaded on first use and reused for a day. */
export class RdapBootstrap {
  /** The loaded list. Shared by all lookups, so it never uses a caller's cancel signal. */
  private readonly list = new PromiseCache<string, ServerList>(RDAP_BOOTSTRAP_TTL_MS);

  constructor(private readonly network: Network) {}

  /** The RDAP base URL for a TLD, longest match first: "co.uk" tries "co.uk", then "uk". Undefined: no RDAP. */
  async serverFor(tld: string): Promise<string | undefined> {
    const servers = await this.list.get(RDAP_BOOTSTRAP_URL, () => this.load());
    const match = this.suffixes(tld).find((suffix) => servers.has(suffix));
    return match === undefined ? undefined : servers.get(match);
  }

  /** "co.uk" -> ["co.uk", "uk"] */
  private suffixes(tld: string): string[] {
    const labels = tld.split(LABEL_SEPARATOR);
    return labels.map((_label, start) => labels.slice(start).join(LABEL_SEPARATOR));
  }

  private load(): Promise<ServerList> {
    return withRetry(() => this.network.run(() => this.fetchList()), Retry.bootstrap);
  }

  private async fetchList(): Promise<ServerList> {
    const url = new URL(RDAP_BOOTSTRAP_URL);
    const response = await this.network.request(url);
    await ensureOk(response, url);
    const file = (await response.json()) as BootstrapFile;
    return this.toServerList(file);
  }

  private toServerList(file: BootstrapFile): ServerList {
    const servers = new Map<string, string>();
    for (const [tlds, urls] of file.services ?? []) {
      const base = this.preferredUrl(urls);
      if (!base) continue;
      for (const tld of tlds) servers.set(tld.toLowerCase(), base);
    }
    return servers;
  }

  /** The first https URL (or the first URL), ending with a slash. */
  private preferredUrl(urls: readonly string[]): string | undefined {
    const url = urls.find((candidate) => new URL(candidate).protocol === HTTPS_PROTOCOL) ?? urls[0];
    if (!url) return undefined;
    return url.endsWith(PATH_SEPARATOR) ? url : `${url}${PATH_SEPARATOR}`;
  }
}
