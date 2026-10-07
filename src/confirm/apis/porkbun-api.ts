import type { PorkbunKeys } from '../../config/config.js';
import { HttpMethod, MINUTE_MS } from '../../constants.js';
import { CredentialsRejectedError } from '../../core/errors.js';
import type { HostQueueOptions } from '../../core/host-queues.js';
import type { Network } from '../../core/network.js';
import { type Confirmation, ConfirmState, RegistrarId } from '../../core/types.js';
import { apiPriceSource, atHost, ErrorText } from '../../messages/index.js';
import { exactPrice, minYearsForDomain } from '../../pricing/price.js';
import { RegistrarName } from '../../registrars/registrars.js';
import { sendJson } from '../json-client.js';
import type { RegistrarApi } from '../registrar-api.js';

/** Bulk availability check, Porkbun API v3 (https://porkbun.com/api/json/v3/spec). */
const CHECK_URL = 'https://api.porkbun.com/api/json/v3/domain/checkDomain';
/** Most names in one bulk request. */
const BATCH_SIZE = 25;
/** Bulk checks may cover 200 names per minute: 8 full batches. */
const BATCHES_PER_MINUTE = 8;
/** One request at a time: Porkbun slows down accounts that check many names without registering any. */
const CONCURRENCY = 1;
/** `status` of a successful reply. */
const STATUS_SUCCESS = 'SUCCESS';
/** How Porkbun writes yes and no. */
const Answer = { Yes: 'yes', No: 'no' } as const;
/** Error codes of a missing or rejected key (INVALID_API_KEYS_001 and similar). */
const KEY_ERROR_CODE = /^(INVALID_API_KEYS|API_KEY_REQUIRED)/;
/** This mix of TLDs needs too many registry commands for one request: check it in smaller parts. */
const TOO_SLOW_CODE = 'BULK_CHECK_TOO_SLOW';
/** A batch that is too slow is checked in this many parts. */
const SPLIT_PARTS = 2;

/** One name in a bulk reply. */
interface PorkbunDomain {
  avail?: string;
  premium?: string;
  /** Per-year registration price in USD (promotional when firstYearPromo is "yes"). */
  price?: string;
  minDuration?: number;
  additional?: { renewal?: { price?: string } };
}

/** A bulk check reply. */
interface PorkbunReply {
  status?: string;
  code?: string;
  message?: string;
  domains?: Record<string, PorkbunDomain>;
  /** The registry timed out for these names: neither available nor taken. */
  unresolved?: string[];
}

/** Porkbun's bulk availability check, with the user's API key. */
export class PorkbunApi implements RegistrarApi {
  readonly registrar = RegistrarId.Porkbun;
  readonly batchSize = BATCH_SIZE;
  readonly limits: HostQueueOptions = {
    concurrency: CONCURRENCY,
    intervalCap: BATCHES_PER_MINUTE,
    intervalMs: MINUTE_MS,
  };

  constructor(private readonly keys: PorkbunKeys) {}

  async check(
    domains: readonly string[],
    network: Network,
    signal?: AbortSignal,
  ): Promise<Confirmation[]> {
    const url = new URL(CHECK_URL);
    const body = { apikey: this.keys.apiKey, secretapikey: this.keys.secretKey, domains };
    const { data } = await sendJson<PorkbunReply>(
      network,
      url,
      { method: HttpMethod.Post, body },
      signal,
    );
    if (data.status === STATUS_SUCCESS) return this.toConfirmations(data);
    if (data.code === TOO_SLOW_CODE && domains.length > 1) {
      return this.checkInParts(domains, network, signal);
    }
    throw this.failure(data, url);
  }

  /** Splits the batch and checks the parts one after the other. */
  private async checkInParts(
    domains: readonly string[],
    network: Network,
    signal?: AbortSignal,
  ): Promise<Confirmation[]> {
    const middle = Math.ceil(domains.length / SPLIT_PARTS);
    const first = await this.check(domains.slice(0, middle), network, signal);
    const second = await this.check(domains.slice(middle), network, signal);
    return [...first, ...second];
  }

  /** A rejected key, or any other error the API reports. The key itself is never repeated. */
  private failure(data: PorkbunReply, url: URL): Error {
    if (data.code && KEY_ERROR_CODE.test(data.code)) {
      return new CredentialsRejectedError(atHost(url.host, data.code));
    }
    return new Error(atHost(url.host, data.message ?? ErrorText.UnexpectedReply));
  }

  private toConfirmations(data: PorkbunReply): Confirmation[] {
    const answers = Object.entries(data.domains ?? {}).map(([name, info]) =>
      this.toConfirmation(name.toLowerCase(), info),
    );
    const unresolved = (data.unresolved ?? []).map((name) => this.registryTimeout(name));
    return [...answers, ...unresolved];
  }

  private toConfirmation(domain: string, info: PorkbunDomain): Confirmation {
    if (info.avail === Answer.No) return { domain, state: ConfirmState.Unavailable };
    if (info.avail !== Answer.Yes) {
      return { domain, state: ConfirmState.Error, detail: ErrorText.UnexpectedReply };
    }
    const price = exactPrice({
      registration: Number(info.price),
      renewal: Number(info.additional?.renewal?.price),
      minYears: info.minDuration ?? minYearsForDomain(domain),
      source: apiPriceSource(RegistrarName.Porkbun),
    });
    return {
      domain,
      state: ConfirmState.Available,
      premium: info.premium === Answer.Yes,
      ...(price && { price }),
    };
  }

  private registryTimeout(name: string): Confirmation {
    return {
      domain: name.toLowerCase(),
      state: ConfirmState.Error,
      detail: ErrorText.RegistryTimeout,
    };
  }
}
