import { Plugin } from '@nocobase/client';
import models from './features/process-discussion/model';

export class PluginProcessDiscussionClient extends Plugin {
  async load() {
    this.flowEngine.registerModels(models);
  }
}

export default PluginProcessDiscussionClient;
