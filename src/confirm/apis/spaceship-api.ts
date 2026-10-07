import type { SpaceshipKeys } from '../../config/config.js';
import { HttpMethod } from '../../constants.js';
import type { HostQueueOptions } from '../../core/host-queues.js';
import type { Network } from '../../core/network.js';
import { type Confirmation, ConfirmState, type Price, RegistrarId } from '../../core/types.js';
import { apiPriceSource, atHost, ErrorText, httpStatusText } from '../../messages/index.js';
import { exactPrice, minYearsForDomain } from '../../pricing/price.js';
import { RegistrarName } from '../../registrars/registrars.js';
import { sendJson } from '../json-client.js';
import type { RegistrarApi } from '../registrar-api.js';

/** Bulk availability check, Spaceship API (https://docs.spaceship.dev). The key needs the domains:read scope. */
const CHECK_URL = 'https://spaceship.dev/api/v1/domains/available';
/** Most names in one request. */
const BATCH_SIZE = 20;
/** Spaceship allows 30 bulk requests… */
const REQUESTS_PER_WINDOW = 30;
/** …per 30 seconds per user. */
const WINDOW_MS = 30_000;
/** Requests in flight at once. */
const CONCURRENCY = 2;
/** Credential headers. */
const KeyHeader = { Key: 'x-api-key', Secret: 'x-api-secret' } as const;

/** Spaceship's answer about one name. */
const SpaceshipResult = {
  Available: 'available',
  Taken: 'taken',
  InvalidName: 'invalidDomainName',
  TldNotSupported: 'tldNotSupported',
} as const;

/** Operations in a premium price list. */
const PremiumOperation = { Register: 'register', Renew: 'renew' } as const;

/** What each answer means; the rest are errors. */
const STATES: ReadonlyMap<string, ConfirmState> = new Map<string, ConfirmState>()
  .set(SpaceshipResult.Available, ConfirmState.Available)
  .set(SpaceshipResult.Taken, ConfirmState.Unavailable)
  .set(SpaceshipResult.InvalidName, ConfirmState.Unsupported)
  .set(SpaceshipResult.TldNotSupported, ConfirmState.Unsupported);

/** One price of a premium name. */
interface PremiumPrice {
  operation?: string;
  price?: number;
  currency?: string;
}

/** One name in the reply. */
interface SpaceshipItem {
  domain?: string;
  result?: string;
  /** Present only for premium names; Spaceship gives no standard price here. */
  premiumPricing?: PremiumPrice[];
}

/** The bulk reply. */
interface SpaceshipReply {
  domains?: SpaceshipItem[];
  detail?: string;
}

/** Spaceship's bulk availability check, with the user's API key and secret. */
export class SpaceshipApi implements RegistrarApi {
  readonly registrar = RegistrarId.Spaceship;
  readonly batchSize = BATCH_SIZE;
  readonly limits: HostQueueOptions = {
    concurrency: CONCURRENCY,
    intervalCap: REQUESTS_PER_WINDOW,
    intervalMs: WINDOW_MS,
  };

  constructor(private readonly keys: SpaceshipKeys) {}

  async check(
    domains: readonly string[],
    network: Network,
    signal?: AbortSignal,
  ): Promise<Confirmation[]> {
    const url = new URL(CHECK_URL);
    const reply = await sendJson<SpaceshipReply>(
      network,
      url,
      {
        method: HttpMethod.Post,
        headers: { [KeyHeader.Key]: this.keys.apiKey, [KeyHeader.Secret]: this.keys.apiSecret },
        body: { domains },
      },
      signal,
    );
    if (!reply.ok) {
      throw new Error(atHost(url.host, reply.data.detail ?? httpStatusText(reply.status)));
    }
    return (reply.data.domains ?? []).flatMap((item) =>
      item.domain ? [this.toConfirmation(item.domain, item)] : [],
    );
  }

  private toConfirmation(name: string, item: SpaceshipItem): Confirmation {
    const domain = name.toLowerCase();
    const state = STATES.get(item.result ?? '');
    if (!state) {
      return {
        domain,
        state: ConfirmState.Error,
        detail: item.result ?? ErrorText.UnexpectedReply,
      };
    }
    if (state !== ConfirmState.Available) return { domain, state };
    return this.available(domain, item.premiumPricing ?? []);
  }

  /** Free; a premium price list marks a premium name and gives its exact price. */
  private available(domain: string, premiumPricing: readonly PremiumPrice[]): Confirmation {
    const price = this.premiumPrice(domain, premiumPricing);
    return {
      domain,
      state: ConfirmState.Available,
      premium: premiumPricing.length > 0,
      ...(price && { price }),
    };
  }

  private premiumPrice(domain: string, pricing: readonly PremiumPrice[]): Price | undefined {
    const register = pricing.find((entry) => entry.operation === PremiumOperation.Register);
    const renew = pricing.find((entry) => entry.operation === PremiumOperation.Renew);
    if (!register) return undefined;
    return exactPrice({
      registration: register.price,
      renewal: renew?.price,
      currency: register.currency,
      minYears: minYearsForDomain(domain),
      source: apiPriceSource(RegistrarName.Spaceship),
    });
  }
}
