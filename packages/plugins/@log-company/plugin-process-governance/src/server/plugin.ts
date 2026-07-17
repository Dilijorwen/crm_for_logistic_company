import path from 'path';
import { Plugin } from '@nocobase/server';
import { ProcessGovernanceModule } from './composition/ProcessGovernanceModule';

export class PluginProcessGovernanceServer extends Plugin {
  async load(): Promise<void> {
    await this.importCollections(path.resolve(__dirname, 'collections'));
    this.db.addMigrations({
      namespace: 'process-governance',
      directory: path.resolve(__dirname, 'migrations'),
      context: { plugin: this },
    });
    new ProcessGovernanceModule(this).initialize();
  }
}

export default PluginProcessGovernanceServer;
