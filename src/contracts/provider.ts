import type { AdventureKind } from './adventure';

/**
 * Provider output is presentation/proposal data only. It deliberately has no
 * XP, progression, combat-state, reward, or snapshot-eligibility fields.
 */
export type ProviderMode = 'ordinary-conversation' | 'journal-response' | 'adventure-scene' | 'reflection' | 'combat-narration' | 'snapshot-synthesis';

export interface ProviderProposalBase { mode: ProviderMode; narration: string; }
export interface OrdinaryConversationProposal extends ProviderProposalBase { mode: 'ordinary-conversation'; suggestedQuestion?: string; }
export interface JournalResponseProposal extends ProviderProposalBase { mode: 'journal-response'; optionalFollowUp?: string; }
export interface AdventureSceneProposal extends ProviderProposalBase { mode: 'adventure-scene'; adventureKind: AdventureKind; sceneOptions?: string[]; }
export interface ReflectionProposal extends ProviderProposalBase { mode: 'reflection'; question: string; interpretation?: string; }
export interface CombatNarrationProposal extends ProviderProposalBase { mode: 'combat-narration'; actWording?: string; }
export interface SnapshotSynthesisProposal extends ProviderProposalBase { mode: 'snapshot-synthesis'; synthesis: string; }

export type ProviderProposal = OrdinaryConversationProposal | JournalResponseProposal | AdventureSceneProposal | ReflectionProposal | CombatNarrationProposal | SnapshotSynthesisProposal;

export const FORBIDDEN_PROVIDER_PROPOSAL_FIELDS = [
  'xp', 'level', 'achievement', 'quest', 'territory', 'unlock', 'combatState',
  'hp', 'reward', 'outcome', 'snapshotEligible'
] as const;
