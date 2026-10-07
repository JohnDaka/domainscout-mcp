import { registrarEvidence } from '../core/evidence.js';
import { isDefinite } from '../core/status.js';
import {
  type Attempt,
  ConfirmState,
  type DomainResult,
  DomainStatus,
  type RegistrarId,
  type Verdict,
} from '../core/types.js';
import { Note, ReportLine } from '../messages/index.js';
import { registrarName } from '../registrars/registrars.js';

/** A registrar's "no" for a name the registry could not be asked about: taken. */
const REGISTRAR_SAYS_TAKEN: Verdict = { status: DomainStatus.Taken, note: Note.RegistrarSaysTaken };

/** A registrar's "no" for a name the registry does not know: reserved or restricted. */
const NOT_SELLABLE: Verdict = { status: DomainStatus.Reserved, note: Note.NotSellable };

/** What a registrar's "not available" means, by what the registry said before. */
const UNAVAILABLE_VERDICTS: ReadonlyMap<DomainStatus, Verdict> = new Map<DomainStatus, Verdict>()
  .set(DomainStatus.Unknown, REGISTRAR_SAYS_TAKEN)
  .set(DomainStatus.LikelyAvailable, NOT_SELLABLE);

/** The note of a confirmed free name, by whether it is premium. */
const AVAILABLE_NOTES: ReadonlyMap<boolean, string> = new Map<boolean, string>()
  .set(true, Note.Premium)
  .set(false, Note.Confirmed);

/**
 * Records every attempt as evidence and lets the first definite answer decide the status.
 * Returns the deciding attempt.
 */
export function applyConfirmation(
  result: DomainResult,
  attempts: readonly Attempt[],
): Attempt | undefined {
  for (const attempt of attempts) {
    result.evidence.push(registrarEvidence(attempt, registrarName(attempt.registrar)));
  }
  const answer = attempts.find(isDefinite);
  if (!answer) return undefined;
  Object.assign(result, confirmedVerdict(result.status, answer), {
    confirmedBy: registrarName(answer.registrar),
  });
  return answer;
}

/** One line per registrar API whose requests failed, e.g. because of a rejected key. */
export function apiFailures(attempts: ReadonlyMap<string, readonly Attempt[]>): string[] {
  const failures = new Map<RegistrarId, string>();
  for (const attempt of [...attempts.values()].flat()) {
    if (attempt.state !== ConfirmState.Error || !attempt.detail) continue;
    if (!failures.has(attempt.registrar)) failures.set(attempt.registrar, attempt.detail);
  }
  return [...failures].map(([registrar, detail]) =>
    ReportLine.apiFailed(registrarName(registrar), detail),
  );
}

/** The new verdict after a definite answer. */
function confirmedVerdict(previous: DomainStatus, answer: Attempt): Verdict {
  if (answer.state === ConfirmState.Available) return availableVerdict(answer);
  return UNAVAILABLE_VERDICTS.get(previous) ?? NOT_SELLABLE;
}

/** Confirmed free; premium when the registrar says so. */
function availableVerdict(answer: Attempt): Verdict {
  const premium = answer.premium === true;
  return {
    status: DomainStatus.Available,
    note: AVAILABLE_NOTES.get(premium),
    ...(answer.premium !== undefined && { premium: answer.premium }),
  };
}
