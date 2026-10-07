import type { RegistrarId } from '../core/types.js';

/** Placeholders an affiliate template may use. */
export const AffiliatePlaceholder = {
  /** The registrar's search URL, URL-encoded: Impact deep links put it in `?u=`. */
  Url: '{url}',
  /** The search URL as is: CJ deep links append it after `/type/dlg/`. */
  RawUrl: '{rawUrl}',
  /** The domain, URL-encoded: for programs that take a referral parameter on their own search page. */
  Domain: '{domain}',
} as const;

/** One affiliate link template per registrar. */
export type AffiliateTemplates = ReadonlyMap<RegistrarId, string>;

/**
 * The project's affiliate links, filled in once a program approves the project. Examples with
 * made-up IDs:
 *
 *   .set(RegistrarId.Namecheap, 'https://namecheap.pxf.io/c/1234567/386170/5618?u={url}') // Impact
 *   .set(RegistrarId.GoDaddy, 'https://www.anrdoezrs.net/links/1234567/type/dlg/{rawUrl}') // CJ
 *
 * A registrar without a template gets a plain link. Templates never change which registrars are
 * shown or their order: links are always sorted by price.
 */
export const AFFILIATE_TEMPLATES: AffiliateTemplates = new Map<RegistrarId, string>();

/** Fills a template. Replacer functions keep "$" sequences in URLs from being read as patterns. */
export function affiliateUrl(template: string, searchUrl: string, domain: string): string {
  return template
    .replaceAll(AffiliatePlaceholder.Url, () => encodeURIComponent(searchUrl))
    .replaceAll(AffiliatePlaceholder.RawUrl, () => searchUrl)
    .replaceAll(AffiliatePlaceholder.Domain, () => encodeURIComponent(domain));
}
