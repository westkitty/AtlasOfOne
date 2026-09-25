import { adventureBeatPlan, type AdventureBeat } from '../beats';
import {
  ADVENTURE_TEMPLATE_SCHEMA_VERSION,
  adventureTemplateSchema,
  type AdventureTemplate
} from './templateSchema';

/**
 * CT01: 12 core adventure template skeletons (section 19.1). Synthetic,
 * in-world only, and each one is worth playing even if nothing is learned.
 * Every entry is parsed through the CT00 schema at module load, so an invalid
 * template fails fast rather than reaching runtime.
 */

type Draft = Omit<AdventureTemplate, 'schemaVersion' | 'beats' | 'safety' | 'failForward'> & {
  beatIntents: Partial<Record<AdventureBeat, string>> & Record<Exclude<AdventureBeat, 'optional-reflection'>, string>;
  failForward?: Partial<AdventureTemplate['failForward']>;
};

const DEFAULT_FAIL_FORWARD: AdventureTemplate['failForward'] = {
  'chose-to-leave': 'The road carries on, and the moment may return in a new shape.',
  escaped: 'You catch your breath at a nearby waypoint.',
  overpowered: 'A friendly hand helps you up; the tale continues.',
  'paused-for-later': 'The thread waits, right where you left it.'
};

const REFLECTION_INTENT = 'If you like, look back on the choice you made. Skipping is fine.';

function template(draft: Draft): AdventureTemplate {
  const { beatIntents, failForward, ...rest } = draft;
  const beats = adventureBeatPlan({ learningTarget: rest.learningTarget }).map((beat) => ({
    beat,
    intent: beat === 'optional-reflection' ? (beatIntents[beat] ?? REFLECTION_INTENT) : beatIntents[beat]!
  }));
  return adventureTemplateSchema.parse({
    schemaVersion: ADVENTURE_TEMPLATE_SCHEMA_VERSION,
    ...rest,
    beats,
    failForward: { ...DEFAULT_FAIL_FORWARD, ...failForward },
    safety: {
      noPsychologicalLabelsInWorld: true,
      syntheticOnly: true,
      privacyChecks: ['provenance-visible', 'no-journal-text', 'no-private-source']
    }
  });
}

export const CORE_ADVENTURE_TEMPLATES: readonly AdventureTemplate[] = Object.freeze([
  template({
    id: 'neighbours-quarrel', kind: 'social-dilemma', title: 'The Fence Between Neighbours',
    validTerritories: ['relationships', 'values'], requiredSetup: ['two-npcs', 'shared-object'],
    optionalKnowledgeGapTarget: true, learningTarget: 'reflection-eligible',
    beatIntents: {
      hook: 'Two neighbours argue loudly over a fence that keeps moving at night.',
      approach: 'Listen to each side, inspect the fence, or ask the village elder.',
      complication: 'The fence posts are being moved by someone neither neighbour suspects.',
      encounter: 'Bring the neighbours together, or catch the culprit in the act.',
      'choice-consequence': 'Where the fence finally stands changes how both neighbours greet you.'
    },
    encounterObjectives: ['pacify', 'discover-act'], gimmicks: ['moving-object', 'night-watch'],
    memoryOutputs: ['character', 'relationship', 'place'],
    funHook: 'A small mystery with two stubborn characters and a sneaky twist.'
  }),
  template({
    id: 'missing-bell', kind: 'investigation', title: 'The Missing Bell',
    validTerritories: ['cognition', 'identity', 'interests'], requiredSetup: ['landmark', 'suspect-list'],
    optionalKnowledgeGapTarget: true, learningTarget: 'reflection-eligible',
    beatIntents: {
      hook: 'The town bell vanished overnight, and the clock tower is silent.',
      approach: 'Follow the drag marks, question the bell-ringer, or search the rooftops.',
      complication: 'A second clue points somewhere completely different.',
      encounter: 'Confront the likely culprit, or lay a clever trap.',
      'choice-consequence': 'The bell rings again, or someone new keeps it safe.'
    },
    encounterObjectives: ['discover-act', 'reach-object'], gimmicks: ['false-trail', 'rooftop-chase'],
    memoryOutputs: ['event', 'object', 'character'],
    funHook: 'Clues, suspects and a heavy bell in an unlikely hiding place.'
  }),
  template({
    id: 'stuck-kite-rescue', kind: 'rescue-support', title: 'Up the Windy Tree',
    validTerritories: ['relationships', 'fears'], requiredSetup: ['npc-in-need', 'hazard'],
    optionalKnowledgeGapTarget: true, learningTarget: 'reflection-eligible',
    beatIntents: {
      hook: 'A young courier is stuck high in a swaying tree after chasing a kite.',
      approach: 'Climb, fetch a ladder, or talk them down step by step.',
      complication: 'The wind picks up and a branch starts to creak.',
      encounter: 'Keep them steady while the safest route opens.',
      'choice-consequence': 'The courier remembers who came when they called.'
    },
    encounterObjectives: ['protect', 'survive'], gimmicks: ['rising-wind', 'timed-hazard'],
    memoryOutputs: ['character', 'promise'],
    funHook: 'A tense, physical rescue with a grateful friend at the end.'
  }),
  template({
    id: 'unmapped-ridge', kind: 'exploration-expedition', title: 'Past the Unmapped Ridge',
    validTerritories: ['interests', 'future', 'identity'], requiredSetup: ['route', 'landmark'],
    optionalKnowledgeGapTarget: false, learningTarget: 'none',
    beatIntents: {
      hook: 'A path nobody has charted winds up past the ridge.',
      approach: 'Pack supplies, scout ahead, or follow the strange cairns.',
      complication: 'The path splits at a waterfall that was not there yesterday.',
      encounter: 'Cross the falls, climb around, or wait for the water to drop.',
      'choice-consequence': 'A new landmark appears on your map, named by you.'
    },
    encounterObjectives: ['reach-object', 'escape'], gimmicks: ['shifting-terrain', 'hidden-cave'],
    memoryOutputs: ['place', 'object'],
    funHook: 'Pure discovery: a brand-new place that is yours to name.'
  }),
  template({
    id: 'bridge-toll', kind: 'negotiation', title: 'The Stubborn Toll-Keeper',
    validTerritories: ['values', 'politics', 'cognition'], requiredSetup: ['npc-trader', 'crossing'],
    optionalKnowledgeGapTarget: true, learningTarget: 'reflection-eligible',
    beatIntents: {
      hook: 'A toll-keeper demands an outrageous fee to cross the only bridge.',
      approach: 'Haggle, offer a trade, or look for another way across.',
      complication: 'The toll-keeper admits the bridge is falling apart.',
      encounter: 'Strike a deal, repair the bridge, or call the toll-keeper\'s bluff.',
      'choice-consequence': 'The bridge, and the toll, change for every traveller after you.'
    },
    encounterObjectives: ['pacify'], gimmicks: ['bargaining', 'hidden-motive'],
    memoryOutputs: ['character', 'place', 'promise'],
    funHook: 'A battle of wits with a colourful character and a creaky bridge.'
  }),
  template({
    id: 'duck-mayor', kind: 'absurd-comedy', title: 'His Honour the Duck',
    validTerritories: ['politics', 'interests', 'identity'], requiredSetup: ['silly-npc', 'town-square'],
    optionalKnowledgeGapTarget: false, learningTarget: 'none',
    beatIntents: {
      hook: 'A very serious duck has declared itself mayor of the market square.',
      approach: 'Campaign against it, join its cabinet, or bribe it with bread.',
      complication: 'The townsfolk seem to prefer the duck.',
      encounter: 'Win the great debate, or out-quack the mayor.',
      'choice-consequence': 'The square gets a new statue, possibly of a duck.'
    },
    encounterObjectives: ['pacify', 'defeat'], gimmicks: ['silly-rules', 'crowd-vote'],
    memoryOutputs: ['character', 'event'],
    funHook: 'Ridiculous, harmless chaos with a pompous duck.'
  }),
  template({
    id: 'windmill-rebuild', kind: 'creative-building', title: 'The Broken Windmill',
    validTerritories: ['interests', 'future'], requiredSetup: ['broken-structure', 'materials'],
    optionalKnowledgeGapTarget: false, learningTarget: 'none',
    beatIntents: {
      hook: 'The old windmill stopped turning, and the bakery has no flour.',
      approach: 'Gather timber, recruit helpers, or sketch a bold new design.',
      complication: 'A key gear is missing and the storm season is close.',
      encounter: 'Raise the new sails before the first gusts arrive.',
      'choice-consequence': 'The windmill turns again in a style all your own.'
    },
    encounterObjectives: ['hold-position', 'reach-object'], gimmicks: ['build-under-pressure', 'weather-clock'],
    memoryOutputs: ['place', 'object'],
    funHook: 'Build something that stays in the world for good.'
  }),
  template({
    id: 'humming-box', kind: 'mystery-puzzle', title: 'The Humming Box',
    validTerritories: ['cognition', 'fears', 'interests'], requiredSetup: ['puzzle-object', 'landmark'],
    optionalKnowledgeGapTarget: true, learningTarget: 'reflection-eligible',
    beatIntents: {
      hook: 'A locked box hums a different tune whenever you come near.',
      approach: 'Hum back, study the carvings, or find who made it.',
      complication: 'The tune changes each time someone else touches it.',
      encounter: 'Solve the melody puzzle before the humming fades.',
      'choice-consequence': 'What is inside changes who wants to talk to you.'
    },
    encounterObjectives: ['discover-act', 'interrupt'], gimmicks: ['sound-puzzle', 'changing-rules'],
    memoryOutputs: ['object', 'event'],
    funHook: 'A musical riddle with a surprise inside.'
  }),
  template({
    id: 'rising-tide', kind: 'survival-escape', title: 'Before the Tide Comes In',
    validTerritories: ['fears', 'future'], requiredSetup: ['hazard', 'exit-route'],
    optionalKnowledgeGapTarget: true, learningTarget: 'reflection-eligible',
    beatIntents: {
      hook: 'The tide is rising around the sea caves much faster than expected.',
      approach: 'Climb high, find the old tunnel, or signal the lighthouse.',
      complication: 'The tunnel is half-flooded and something glints inside.',
      encounter: 'Reach dry ground while the water keeps rising.',
      'choice-consequence': 'The caves remember who made it out, and how.'
    },
    encounterObjectives: ['escape', 'survive'], gimmicks: ['rising-water', 'timed-hazard'],
    memoryOutputs: ['place', 'event'],
    funHook: 'A race against the sea with a treasure temptation.'
  }),
  template({
    id: 'bristle-road', kind: 'combat-forward', title: 'The Bristleback on the Road',
    validTerritories: ['fears', 'identity', 'values'], requiredSetup: ['creature', 'route'],
    optionalKnowledgeGapTarget: false, learningTarget: 'none',
    beatIntents: {
      hook: 'A bristly beast has planted itself in the middle of the trade road.',
      approach: 'Study its pattern, clear the carts, or charge right in.',
      complication: 'It is guarding something small behind it.',
      encounter: 'Fight, guard, or find the move that calms it.',
      'choice-consequence': 'The road reopens, and the beast may return as a friend.'
    },
    encounterObjectives: ['defeat', 'pacify', 'protect'], gimmicks: ['telegraphed-charge', 'hidden-ward'],
    memoryOutputs: ['character', 'place'],
    funHook: 'A satisfying fight with a surprise soft side.'
  }),
  template({
    id: 'companion-lookout', kind: 'relationship-companion', title: 'The Lookout Your Companion Found',
    validTerritories: ['relationships', 'future'], requiredSetup: ['companion', 'landmark'],
    optionalKnowledgeGapTarget: true, learningTarget: 'reflection-eligible',
    beatIntents: {
      hook: 'Your companion insists on showing you a secret lookout.',
      approach: 'Follow their lead, race them there, or ask where it is.',
      complication: 'The lookout path has crumbled since they last visited.',
      encounter: 'Work together to reach the top.',
      'choice-consequence': 'The lookout becomes a place the two of you return to.'
    },
    encounterObjectives: ['escort', 'reach-object'], gimmicks: ['teamwork-climb'],
    memoryOutputs: ['relationship', 'place', 'promise'],
    funHook: 'A shared climb and a view worth the effort.'
  }),
  template({
    id: 'goose-hat-heist', kind: 'pure-fun', title: 'The Great Hat Heist',
    validTerritories: ['interests', 'identity', 'relationships', 'values', 'politics', 'cognition', 'fears', 'future'],
    requiredSetup: ['silly-npc', 'object'],
    optionalKnowledgeGapTarget: false, learningTarget: 'none',
    beatIntents: {
      hook: 'A goose has stolen the mayor\'s hat and is very proud of it.',
      approach: 'Chase it, tempt it with snacks, or recruit the local children.',
      complication: 'The goose has friends. Many friends.',
      encounter: 'Outwit the flock and recover the hat.',
      'choice-consequence': 'The hat returns, or the goose keeps it and becomes famous.'
    },
    encounterObjectives: ['reach-object', 'escape'], gimmicks: ['chase', 'silly-rules'],
    memoryOutputs: ['character', 'object', 'event'],
    funHook: 'A goofy chase with no deeper meaning at all.'
  })
]);

export function findAdventureTemplate(id: string): AdventureTemplate | undefined {
  return CORE_ADVENTURE_TEMPLATES.find((entry) => entry.id === id);
}
