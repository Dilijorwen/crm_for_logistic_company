import { Plugin } from '@nocobase/client';
import models from './features/process-tree/model';

export class PluginProcessTreeClient extends Plugin {
  async load() {
    this.flowEngine.registerModels(models);
  }
}

export default PluginProcessTreeClient;
