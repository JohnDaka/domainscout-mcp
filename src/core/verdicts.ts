import { RDAP_DROPPING_STATUSES } from '../constants.js';
import { Note, noLookupServiceNote } from '../messages/index.js';
import { DomainStatus, type RegisteredRdapLookup, type Verdict } from './types.js';

/** Delegated in DNS: registered, and the cheapest proof there is. */
export const HAS_NAMESERVERS: Verdict = { status: DomainStatus.Taken, note: Note.HasNameservers };

/** Neither the registry nor DNS knows the name. */
export const NOT_IN_REGISTRY: Verdict = {
  status: DomainStatus.LikelyAvailable,
  note: Note.NotInRegistry,
};

/** WHOIS says the registry holds the name back. */
export const RESERVED_BY_REGISTRY: Verdict = { status: DomainStatus.Reserved, note: Note.Reserved };

/** Registered; `note` explains more when there is more to say. */
export function taken(note?: string): Verdict {
  return { status: DomainStatus.Taken, note };
}

/** Registered according to RDAP, with the registration's dates and statuses. */
export function registeredInRdap(lookup: RegisteredRdapLookup, notInUse?: string): Verdict {
  const dropping = lookup.statuses.some((status) =>
    RDAP_DROPPING_STATUSES.has(status.toLowerCase()),
  );
  return {
    status: DomainStatus.Taken,
    note: dropping ? Note.Dropping : notInUse,
    registration: {
      created: lookup.created,
      expires: lookup.expires,
      statuses: lookup.statuses,
      dropping,
    },
  };
}

/** Could not verify: cancelled by the caller, or every source failed. */
export function unverified(signal?: AbortSignal): Verdict {
  return { status: DomainStatus.Unknown, note: signal?.aborted ? Note.Cancelled : Note.Failed };
}

/** Neither RDAP nor WHOIS serves the TLD. */
export function noLookupService(tld: string): Verdict {
  return { status: DomainStatus.Unknown, note: noLookupServiceNote(tld) };
}
