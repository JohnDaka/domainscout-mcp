/** Where list prices come from, shown next to them. */
export const PriceSourceName = {
  Porkbun: 'Porkbun price API',
  Cloudflare: "cfdomainpricing.com (community mirror of Cloudflare's prices)",
} as const;

/** The source of an exact price: "Porkbun API, exact price for this name". */
export const apiPriceSource = (registrar: string): string =>
  `${registrar} API, exact price for this name`;
