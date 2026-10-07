/** Short notes attached to a domain result, shown to the user next to its status. */
export const Note = {
  /** DNS delegates the name, so it is registered. */
  HasNameservers: 'Has nameservers in DNS.',
  /** Not found anywhere, but premium and reserved names look exactly like this. */
  NotInRegistry:
    'Not in the registry. Premium or reserved names can look the same; the registrar shows the final price.',
  /** The "bought but never set up" case. */
  NotInUse: 'Registered, but not set up (no DNS).',
  /** The registry is deleting the name. */
  Dropping: 'In the deletion cycle: may become available soon.',
  /** WHOIS says the registry holds the name back. */
  Reserved: 'Reserved or blocked by the registry.',
  /** The caller cancelled the request. */
  Cancelled: 'Cancelled.',
  /** Every source failed this time. */
  Failed: 'Could not verify right now, try again later.',
  /** A registrar API confirmed the name can be bought. */
  Confirmed: 'The registrar confirmed it can be registered.',
  /** A registrar API confirmed it, at a premium price. */
  Premium: 'Premium name: sold above the standard price.',
  /** Not registered, yet the registrar will not sell it. */
  NotSellable: 'Not in the registry, but the registrar cannot sell it: reserved or restricted.',
  /** The registrar says no for a name the registry could not be asked about. */
  RegistrarSaysTaken: 'The registrar reports it is not available.',
} as const;

/** A TLD that neither RDAP nor WHOIS covers. */
export const noLookupServiceNote = (tld: string): string =>
  `No RDAP or WHOIS service is known for .${tld}.`;
