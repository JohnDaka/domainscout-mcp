import { RegistrarId } from '../core/types.js';

/** Where the domain goes in a search URL. */
const DOMAIN_PLACEHOLDER = '{domain}';

/** Registrar names as the registrars write them. */
export const RegistrarName = {
  Cloudflare: 'Cloudflare',
  Porkbun: 'Porkbun',
  Namecheap: 'Namecheap',
  Spaceship: 'Spaceship',
  GoDaddy: 'GoDaddy',
  NameCom: 'Name.com',
  Dynadot: 'Dynadot',
  NameSilo: 'NameSilo',
  Hover: 'Hover',
} as const;
export type RegistrarName = (typeof RegistrarName)[keyof typeof RegistrarName];

/** One registrar the scout links to. */
export interface Registrar {
  name: RegistrarName;
  /** Public search page for one domain, no login needed; `{domain}` is replaced by the domain. */
  searchUrl: string;
}

/**
 * Every registrar, in the order shown when no prices are known. Each search URL was checked
 * by hand on 2026-10-07.
 */
export const REGISTRARS: ReadonlyMap<RegistrarId, Registrar> = new Map<RegistrarId, Registrar>()
  .set(RegistrarId.Cloudflare, {
    name: RegistrarName.Cloudflare,
    searchUrl: `https://www.cloudflare.com/domains/search/?q=${DOMAIN_PLACEHOLDER}`,
  })
  .set(RegistrarId.Porkbun, {
    name: RegistrarName.Porkbun,
    searchUrl: `https://porkbun.com/checkout/search?q=${DOMAIN_PLACEHOLDER}`,
  })
  .set(RegistrarId.Namecheap, {
    name: RegistrarName.Namecheap,
    searchUrl: `https://www.namecheap.com/domains/registration/results/?domain=${DOMAIN_PLACEHOLDER}`,
  })
  .set(RegistrarId.Spaceship, {
    name: RegistrarName.Spaceship,
    searchUrl: `https://www.spaceship.com/domain-search/?query=${DOMAIN_PLACEHOLDER}`,
  })
  .set(RegistrarId.GoDaddy, {
    name: RegistrarName.GoDaddy,
    searchUrl: `https://www.godaddy.com/domainsearch/find?domainToCheck=${DOMAIN_PLACEHOLDER}`,
  })
  .set(RegistrarId.NameCom, {
    name: RegistrarName.NameCom,
    searchUrl: `https://www.name.com/domain/search/${DOMAIN_PLACEHOLDER}`,
  })
  .set(RegistrarId.Dynadot, {
    name: RegistrarName.Dynadot,
    searchUrl: `https://www.dynadot.com/domain/search?domain=${DOMAIN_PLACEHOLDER}`,
  })
  .set(RegistrarId.NameSilo, {
    name: RegistrarName.NameSilo,
    searchUrl: `https://www.namesilo.com/domain/search-domains?query=${DOMAIN_PLACEHOLDER}`,
  })
  .set(RegistrarId.Hover, {
    name: RegistrarName.Hover,
    searchUrl: `https://www.hover.com/domains/results?q=${DOMAIN_PLACEHOLDER}`,
  });

/** Every registrar id, in default order. */
export const ALL_REGISTRARS: readonly RegistrarId[] = [...REGISTRARS.keys()];

/** The registrar's name, for people. */
export function registrarName(id: RegistrarId): string {
  return REGISTRARS.get(id)?.name ?? id;
}

/** The registrar's search page for one domain. */
export function searchUrl(id: RegistrarId, domain: string): string {
  const template = REGISTRARS.get(id)?.searchUrl ?? '';
  return template.replace(DOMAIN_PLACEHOLDER, () => encodeURIComponent(domain));
}
