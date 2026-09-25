import { z } from 'zod';
import { COMBAT_OBJECTIVES } from '../../combat/types';
import { TERRITORY_DEFINITIONS } from '../../game/data';
import { ADVENTURE_BEATS, adventureBeatPlan } from '../beats';
import { ADVENTURE_EXIT_CAUSES } from '../outcomes';
import { adventureKindSchema, adventureMemorySchema } from '../schema';

/**
 * CT00 frozen AdventureTemplate schema (section 19.1).
 *
 * Templates are scaffolding, not scripts: they hold structure and short
 * in-world intent lines; the model (or A06 fallback) supplies fresh details.
 * Version is a literal so any shape change is a deliberate schema bump.
 */

export const ADVENTURE_TEMPLATE_SCHEMA_VERSION = 1 as const;
export const TEMPLATE_TEXT_MAX_LENGTH = 160;

export const TERRITORY_IDS = TERRITORY_DEFINITIONS.map((territory) => territory.id) as [string, ...string[]];

/**
 * In-world text must never name psychological constructs or reveal the
 * learning layer (sections 11.3, 19.1). Checked case-insensitively on every
 * in-world string in a template.
 */
export const IN_WORLD_FORBIDDEN_PATTERNS: readonly RegExp[] = [
  /psycholog/i, /therap/i, /diagnos/i, /trauma/i, /anxiety/i, /anxious/i, /depress/i,
  /disorder/i, /attachment style/i, /self[- ]esteem/i, /insecur/i, /personality/i,
  /\btest(s|ing|ed)?\b/i, /assess/i, /evidence/i, /analy[sz]/i, /\bprofile\b/i,
  /knowledge gap/i, /dimension/i, /\bcoping\b/i, /\btrigger(ed|s)?\b/i, /mental health/i,
  /\bgreyson\b/i
];

export function findForbiddenInWorldTerms(text: string): string[] {
  return IN_WORLD_FORBIDDEN_PATTERNS.filter((pattern) => pattern.test(text)).map((pattern) => pattern.source);
}

const inWorldText = z.string().trim().min(1).max(TEMPLATE_TEXT_MAX_LENGTH);
const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

export const adventureTemplateBeatSchema = z.object({
  beat: z.enum(ADVENTURE_BEATS),
  intent: inWorldText
}).strict();

export const adventureTemplateSchema = z.object({
  schemaVersion: z.literal(ADVENTURE_TEMPLATE_SCHEMA_VERSION),
  id: slug,
  kind: adventureKindSchema,
  title: inWorldText,
  validTerritories: z.array(z.enum(TERRITORY_IDS)).min(1),
  requiredSetup: z.array(slug).min(1),
  /** Whether a seed built from this template MAY target a KnowledgeGap. Never required. */
  optionalKnowledgeGapTarget: z.boolean(),
  learningTarget: z.enum(['none', 'reflection-eligible']),
  beats: z.array(adventureTemplateBeatSchema).min(1),
  encounterObjectives: z.array(z.enum(COMBAT_OBJECTIVES)),
  gimmicks: z.array(slug),
  failForward: z.object(
    Object.fromEntries(ADVENTURE_EXIT_CAUSES.map((cause) => [cause, inWorldText])) as Record<
      (typeof ADVENTURE_EXIT_CAUSES)[number],
      typeof inWorldText
    >
  ).strict(),
  memoryOutputs: z.array(adventureMemorySchema.shape.type).min(1),
  /** Why this is fun even if nothing is learned (section 10.1). */
  funHook: inWorldText,
  safety: z.object({
    noPsychologicalLabelsInWorld: z.literal(true),
    syntheticOnly: z.literal(true),
    privacyChecks: z.array(z.enum(['provenance-visible', 'no-journal-text', 'no-private-source'])).min(1)
  }).strict()
}).strict().superRefine((template, ctx) => {
  const expected = adventureBeatPlan({ learningTarget: template.learningTarget });
  const actual = template.beats.map((beat) => beat.beat);
  if (actual.length !== expected.length || actual.some((beat, index) => beat !== expected[index])) {
    ctx.addIssue({ code: 'custom', path: ['beats'], message: `beats must be exactly ${expected.join(', ')}` });
  }
  if (template.kind === 'pure-fun' && template.learningTarget !== 'none') {
    ctx.addIssue({ code: 'custom', path: ['learningTarget'], message: 'pure-fun templates must use learningTarget none' });
  }
  if (template.learningTarget === 'none' && template.optionalKnowledgeGapTarget) {
    ctx.addIssue({ code: 'custom', path: ['optionalKnowledgeGapTarget'], message: 'learningTarget none cannot target a gap' });
  }
  if (new Set(template.validTerritories).size !== template.validTerritories.length) {
    ctx.addIssue({ code: 'custom', path: ['validTerritories'], message: 'duplicate territory' });
  }
  const inWorld: [string, string][] = [
    ['title', template.title],
    ['funHook', template.funHook],
    ...template.beats.map((beat, i): [string, string] => [`beats.${i}.intent`, beat.intent]),
    ...Object.entries(template.failForward).map(([cause, text]): [string, string] => [`failForward.${cause}`, text])
  ];
  for (const [path, text] of inWorld) {
    const hits = findForbiddenInWorldTerms(text);
    if (hits.length > 0) {
      ctx.addIssue({ code: 'custom', path: path.split('.'), message: `in-world text uses forbidden terms: ${hits.join(', ')}` });
    }
  }
});

export type AdventureTemplate = z.infer<typeof adventureTemplateSchema>;

export function parseAdventureTemplate(input: unknown): AdventureTemplate {
  return adventureTemplateSchema.parse(input);
}
