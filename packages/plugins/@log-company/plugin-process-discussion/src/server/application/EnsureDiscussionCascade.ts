import type { DiscussionCascadeGateway } from './ports/DiscussionCascadeGateway';

export class EnsureDiscussionCascade {
  constructor(private readonly cascadeGateway: DiscussionCascadeGateway) {}

  execute(): void {
    this.cascadeGateway.registerRuntimeCascade();
  }
}
