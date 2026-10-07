import { z } from 'zod';
import { MAX_INPUT_ENTRIES } from '../constants.js';
import {
  ConfirmState,
  DnsState,
  DomainStatus,
  EvidenceSource,
  LookupState,
} from '../core/types.js';
import { ToolText, tldsParamText, toolDescription } from '../messages/index.js';

/** A price, as in the Price type. */
const priceSchema = z
  .object({
    registration: z.number(),
    renewal: z.number(),
    currency: z.string(),
    minYears: z.number(),
    source: z.string(),
    updated: z.string().optional(),
    confirmed: z.boolean().optional(),
  })
  .describe(ToolText.PriceInfo);

/** A buy link, as in the BuyLink type. */
const buyLinkSchema = z.object({
  registrar: z.string(),
  url: z.string(),
  affiliate: z.boolean(),
  price: priceSchema.optional(),
});

/** What the registry says about a registered domain. */
const registrationSchema = z.object({
  created: z.string().optional(),
  expires: z.string().optional(),
  statuses: z.array(z.string()).optional(),
  dropping: z.boolean().optional(),
});

/** One piece of evidence, as in the Evidence type. */
const evidenceSchema = z.object({
  source: z.enum(EvidenceSource),
  result: z.union([z.enum(DnsState), z.enum(LookupState), z.enum(ConfirmState)]),
  server: z.string().optional(),
  detail: z.string().optional(),
  ms: z.number().optional(),
});

/** One domain, as in the DomainResult type; evidence only when asked for. */
const resultSchema = z.object({
  domain: z.string().describe(ToolText.AsciiForm),
  display: z.string().describe(ToolText.UnicodeForm),
  input: z.string(),
  tld: z.string(),
  status: z.enum(DomainStatus),
  note: z.string().optional(),
  confirmedBy: z.string().optional(),
  premium: z.boolean().optional(),
  registration: registrationSchema.optional(),
  buy: z.array(buyLinkSchema).optional(),
  evidence: z.array(evidenceSchema).optional(),
});

/** Counts per status, the total and the elapsed time, as in the Summary type. */
const summarySchema = z.object({
  ...Object.fromEntries(Object.values(DomainStatus).map((status) => [status, z.number()])),
  total: z.number(),
  elapsed_ms: z.number(),
});

/** A skipped entry, as in the InvalidEntry type. */
const invalidEntrySchema = z.object({ input: z.string(), reason: z.string() });

/** The check_domains tool: its texts, input and output schemas, and hints for clients. */
export function checkDomainsTool(defaultTlds: string) {
  return {
    title: ToolText.Title,
    description: toolDescription(defaultTlds),
    inputSchema: {
      domains: z.array(z.string()).min(1).max(MAX_INPUT_ENTRIES).describe(ToolText.DomainsParam),
      tlds: z.array(z.string()).optional().describe(tldsParamText(defaultTlds)),
      confirm: z.boolean().optional().describe(ToolText.ConfirmParam),
      details: z.boolean().optional().describe(ToolText.DetailsParam),
    },
    outputSchema: {
      summary: summarySchema,
      tlds: z.array(z.string()).describe(ToolText.TldsUsed),
      results: z.array(resultSchema),
      invalid: z.array(invalidEntrySchema),
      warnings: z.array(z.string()).describe(ToolText.WarningsInfo),
      disclosure: z.string().optional(),
    },
    // Looks things up and changes nothing, asks the same question again on a repeat call, and
    // talks to DNS, the registries and registrars on the internet.
    annotations: {
      title: ToolText.Title,
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  };
}
