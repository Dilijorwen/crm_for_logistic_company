import path from 'path';
import { Plugin } from '@nocobase/server';
import { EnsureDiscussionCascade } from './application/EnsureDiscussionCascade';
import { NocoBaseDiscussionCascadeGateway } from './infrastructure/nocobase/NocoBaseDiscussionCascadeGateway';

export class PluginProcessDiscussionServer extends Plugin {
  async load(): Promise<void> {
    this.db.addMigrations({
      namespace: 'process-discussion',
      directory: path.resolve(__dirname, 'migrations'),
      context: { plugin: this },
    });
    const cascadeGateway = new NocoBaseDiscussionCascadeGateway(this);
    new EnsureDiscussionCascade(cascadeGateway).execute();
  }
}

export default PluginProcessDiscussionServer;
