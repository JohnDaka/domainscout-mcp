import type { CloudflareKeys } from '../../config/config.js';
import { Header, HttpMethod, SECOND_MS } from '../../constants.js';
import { CredentialsRejectedError } from '../../core/errors.js';
import type { HostQueueOptions } from '../../core/host-queues.js';
import type { Network } from '../../core/network.js';
import {
  type Confirmation,
  ConfirmState,
  type Price,
  type RegistrarAnswer,
  RegistrarId,
} from '../../core/types.js';
import { apiPriceSource, atHost, ErrorText, httpStatusText } from '../../messages/index.js';
import { exactPrice, minYearsForDomain } from '../../pricing/price.js';
import { RegistrarName } from '../../registrars/registrars.js';
import { sendJson } from '../json-client.js';
import type { RegistrarApi } from '../registrar-api.js';

/**
 * Live availability check, Cloudflare Registrar API (beta since 2026-04,
 * https://developers.cloudflare.com/registrar/registrar-api/): accounts/{id}/registrar/domain-check.
 */
const ACCOUNTS_URL = 'https://api.cloudflare.com/client/v4/accounts/';
/** The check, below the account. */
const CHECK_PATH = '/registrar/domain-check';
/** Most names in one request. */
const BATCH_SIZE = 20;
/** The account-wide limit is 1,200 requests per 5 minutes; a few per second is plenty. */
const REQUESTS_PER_SECOND = 4;
/** Requests in flight at once. */
const CONCURRENCY = 2;
/** The API token goes in a Bearer Authorization header. */
const BEARER_SCHEME = 'Bearer';
/** `tier` of a premium name. */
const PREMIUM_TIER = 'premium';

/** Why a name cannot be registered through the API. */
const Reason = {
  Unavailable: 'domain_unavailable',
  Premium: 'domain_premium',
  DisallowsRegistration: 'extension_disallows_registration',
  NotSupported: 'extension_not_supported',
  NotSupportedViaApi: 'extension_not_supported_via_api',
} as const;

/** Cloudflare API error codes this adapter reacts to. */
const CloudflareError = {
  /** No valid or supported domain in the request. */
  NoSupportedDomains: 1008,
  /** Missing or malformed credentials; answered with HTTP 400, not 401. */
  MissingCredentials: 9106,
  /** Invalid API token. */
  AuthenticationError: 10000,
} as const;

/** Error codes that mean the credentials were rejected. */
const AUTH_ERROR_CODES: ReadonlySet<number> = new Set([
  CloudflareError.MissingCredentials,
  CloudflareError.AuthenticationError,
]);

/** What a name that cannot be registered means, by reason. */
const UNREGISTRABLE: ReadonlyMap<string, RegistrarAnswer> = new Map<string, RegistrarAnswer>()
  // Free at the registry but sold at a premium price, which the API does not sell.
  .set(Reason.Premium, { state: ConfirmState.Available, premium: true })
  .set(Reason.Unavailable, { state: ConfirmState.Unavailable })
  .set(Reason.DisallowsRegistration, { state: ConfirmState.Unavailable })
  .set(Reason.NotSupported, { state: ConfirmState.Unsupported })
  .set(Reason.NotSupportedViaApi, { state: ConfirmState.Unsupported });

/** Only for registrable names. Decimal strings; registration is the first year, renewal per year. */
interface CloudflarePricing {
  currency?: string;
  registration_cost?: string;
  renewal_cost?: string;
}

/** One name in the reply. */
interface CloudflareDomain {
  name?: string;
  registrable?: boolean;
  tier?: string;
  reason?: string;
  pricing?: CloudflarePricing;
}

/** One error in the reply. */
interface CloudflareApiError {
  code?: number;
  message?: string;
}

/** The domain-check reply. */
interface CloudflareReply {
  success?: boolean;
  errors?: CloudflareApiError[];
  result?: { domains?: CloudflareDomain[] } | null;
}

/** Cloudflare Registrar's live availability check, with the user's account id and API token. */
export class CloudflareApi implements RegistrarApi {
  readonly registrar = RegistrarId.Cloudflare;
  readonly batchSize = BATCH_SIZE;
  readonly limits: HostQueueOptions = {
    concurrency: CONCURRENCY,
    intervalCap: REQUESTS_PER_SECOND,
    intervalMs: SECOND_MS,
  };

  constructor(private readonly keys: CloudflareKeys) {}

  async check(
    domains: readonly string[],
    network: Network,
    signal?: AbortSignal,
  ): Promise<Confirmation[]> {
    const accountId = encodeURIComponent(this.keys.accountId);
    const url = new URL(`${ACCOUNTS_URL}${accountId}${CHECK_PATH}`);
    const { data, status } = await sendJson<CloudflareReply>(
      network,
      url,
      {
        method: HttpMethod.Post,
        headers: { [Header.Authorization]: `${BEARER_SCHEME} ${this.keys.apiToken}` },
        body: { domains },
      },
      signal,
    );
    if (data.success) return this.toConfirmations(data);
    return this.failedRequest(data, domains, url, status);
  }

  /** A rejected key or another error throws; "no supported domain" means the API cannot answer for any. */
  private failedRequest(
    data: CloudflareReply,
    domains: readonly string[],
    url: URL,
    status: number,
  ): Confirmation[] {
    const codes = (data.errors ?? []).map((error) => error.code);
    if (codes.some((code) => code !== undefined && AUTH_ERROR_CODES.has(code))) {
      throw new CredentialsRejectedError(atHost(url.host, httpStatusText(status)));
    }
    if (codes.includes(CloudflareError.NoSupportedDomains)) {
      return domains.map((domain) => ({ domain, state: ConfirmState.Unsupported }));
    }
    throw new Error(atHost(url.host, data.errors?.[0]?.message ?? httpStatusText(status)));
  }

  private toConfirmations(data: CloudflareReply): Confirmation[] {
    return (data.result?.domains ?? []).flatMap((item) =>
      item.name ? [this.toConfirmation(item.name.toLowerCase(), item)] : [],
    );
  }

  private toConfirmation(domain: string, item: CloudflareDomain): Confirmation {
    if (item.registrable) return this.available(domain, item);
    const meaning = UNREGISTRABLE.get(item.reason ?? '');
    if (meaning) return { domain, ...meaning };
    return { domain, state: ConfirmState.Error, detail: item.reason ?? ErrorText.UnexpectedReply };
  }

  private available(domain: string, item: CloudflareDomain): Confirmation {
    const price = this.price(domain, item.pricing);
    return {
      domain,
      state: ConfirmState.Available,
      premium: item.tier === PREMIUM_TIER,
      ...(price && { price }),
    };
  }

  private price(domain: string, pricing?: CloudflarePricing): Price | undefined {
    return exactPrice({
      registration: Number(pricing?.registration_cost),
      renewal: Number(pricing?.renewal_cost),
      currency: pricing?.currency,
      minYears: minYearsForDomain(domain),
      source: apiPriceSource(RegistrarName.Cloudflare),
    });
  }
}
