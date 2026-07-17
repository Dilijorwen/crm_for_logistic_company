export type ProcessGovernanceErrorCode = 'PROCESS_PARENT_SELF' | 'PROCESS_PARENT_CYCLE';

export class ProcessGovernanceError extends Error {
  constructor(
    readonly code: ProcessGovernanceErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'ProcessGovernanceError';
  }
}
