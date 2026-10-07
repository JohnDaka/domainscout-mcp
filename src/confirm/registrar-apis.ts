import type { ApiKeys } from '../config/config.js';
import { CloudflareApi } from './apis/cloudflare-api.js';
import { NameComApi } from './apis/namecom-api.js';
import { PorkbunApi } from './apis/porkbun-api.js';
import { SpaceshipApi } from './apis/spaceship-api.js';
import type { RegistrarApi } from './registrar-api.js';

/**
 * The registrar APIs the user has keys for, the most generous rate limits first:
 * Name.com (50 names per request, 20 requests/s), Cloudflare (20 names, live registry check),
 * Spaceship (20 names), Porkbun last (200 names per minute, and it slows down accounts that
 * check many names without registering any).
 */
export function createRegistrarApis(keys: ApiKeys): RegistrarApi[] {
  const apis = [
    keys.nameCom && new NameComApi(keys.nameCom),
    keys.cloudflare && new CloudflareApi(keys.cloudflare),
    keys.spaceship && new SpaceshipApi(keys.spaceship),
    keys.porkbun && new PorkbunApi(keys.porkbun),
  ];
  return apis.filter((api) => api !== undefined);
}
