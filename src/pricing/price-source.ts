import type { PriceList, RegistrarId } from '../core/types.js';

/** A public, key-free price list of one registrar. */
export interface PriceSource {
  readonly registrar: RegistrarId;
  /** Prices for at least these TLDs; a source may return more. Throws when the list is unavailable. */
  fetch(tlds: readonly string[]): Promise<PriceList>;
}
