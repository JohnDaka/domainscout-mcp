import { EVIDENCE_MAX_NAMESERVERS, TextSeparator } from '../constants.js';
import {
  type AnsweredRdapLookup,
  type AnsweredWhoisLookup,
  type Attempt,
  type DnsLookup,
  type Evidence,
  EvidenceSource,
  LookupState,
} from './types.js';

/** What DNS said: the first few nameservers, or the error. */
export function dnsEvidence(lookup: DnsLookup): Evidence {
  const nameservers = lookup.nameservers?.slice(0, EVIDENCE_MAX_NAMESERVERS);
  return {
    source: EvidenceSource.Dns,
    result: lookup.state,
    detail: nameservers?.join(TextSeparator.List) || lookup.error,
    ms: lookup.ms,
  };
}

/** What the RDAP server said: the registration's statuses, or the error. */
export function rdapEvidence(lookup: AnsweredRdapLookup): Evidence {
  return {
    source: EvidenceSource.Rdap,
    result: lookup.state,
    server: lookup.server,
    detail: rdapDetail(lookup),
    ms: lookup.ms,
  };
}

/** What the WHOIS server said; only a failure has details. */
export function whoisEvidence(lookup: AnsweredWhoisLookup): Evidence {
  return {
    source: EvidenceSource.Whois,
    result: lookup.state,
    server: lookup.server,
    detail: lookup.state === LookupState.Error ? lookup.error : undefined,
    ms: lookup.ms,
  };
}

/** What a registrar API said; `registrar` is its name. */
export function registrarEvidence(attempt: Attempt, registrar: string): Evidence {
  return {
    source: EvidenceSource.Registrar,
    result: attempt.state,
    server: registrar,
    detail: attempt.detail,
    ms: attempt.ms,
  };
}

function rdapDetail(lookup: AnsweredRdapLookup): string | undefined {
  if (lookup.state === LookupState.Error) return lookup.error;
  if (lookup.state !== LookupState.Registered) return undefined;
  return lookup.statuses.join(TextSeparator.List) || undefined;
}
