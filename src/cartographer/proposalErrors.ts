/**
 * Thrown by `parse*ForContext` boundaries when a proposal references an ID the
 * caller did not supply in bounded context. P07 maps this to
 * `provenance-violation`.
 */
export class ProposalProvenanceError extends Error {
  readonly unknownIds: readonly string[];

  constructor(message: string, unknownIds: readonly string[]) {
    super(message);
    this.name = 'ProposalProvenanceError';
    this.unknownIds = unknownIds;
  }
}
