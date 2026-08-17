import { getUmiConfig } from '@nocobase/devtools/umiConfig';
import { defineConfig } from 'dumi';
import { defineThemeConfig } from 'dumi-theme-nocobase';

const umiConfig = getUmiConfig();
process.env.DOC_LANG = process.env.DOC_LANG === 'ru-RU' ? 'ru-RU' : 'en-US';
const lang = process.env.DOC_LANG;

console.log('process.env.DOC_LANG', lang);

export default defineConfig({
  hash: true,
  mfsu: false,
  alias: {
    ...umiConfig.alias,
  },
  fastRefresh: false, // Hot reload loses Context state, so keep it disabled.
  // ssr: {},
  // exportStatic: {
  //   ignorePreRenderError: true
  // },
  cacheDirectoryPath: `node_modules/.docs-client-${lang}-cache`,
  outputPath: `./dist/${lang}`,
  resolve: {
    docDirs: [`./docs/${lang}`],
    atomDirs: [
      { type: 'component', dir: 'src/schema-component/antd' },
    ],
  },
  jsMinifierOptions: {
    target: ['chrome80', 'es2020'],
  },
  locales: lang === 'ru-RU' ? [{ id: 'ru-RU', name: 'Русский' }] : [{ id: 'en-US', name: 'English' }],
  themeConfig: defineThemeConfig({
    title: 'NocoBase',
    logo: 'https://www.nocobase.com/images/logo.png',
    github: 'https://github.com/nocobase/nocobase',
    footer: 'nocobase | Copyright © 2022',
    // sidebarGroupModePath: ['/components'],
    nav: [
      {
        title: 'Learn',
        link: '/learn',
      },
      {
        title: 'Models',
        link: '/models',
      },
      {
        title: 'Components',
        link: '/components',
      },
      {
        title: 'Examples',
        link: '/examples/flow-models/hello-world',
      },
      {
        title: 'API',
        link: '/api/flow-engine',
      },
      {
        title: 'Home site',
        link: lang === 'ru-RU' ? 'https://docs-ru.nocobase.com' : 'https://docs.nocobase.com',
      }
      // {
      //   title: 'UI Schema',
      //   link: '/ui-schema',
      // },
    ],
    sidebarEnhance: {
      '/components': [
        {
          title: 'Filter',
          type: 'group',
          children: [
            { title: 'Overview', link: '/components/filter' },
            { title: 'FilterGroup', link: '/components/filter/filter-group' },
            { title: 'Custom FilterItem', link: '/components/filter/custom-filter-item' },
            { title: 'Variable filter item', link: '/components/filter/variable-filter-item' },
          ],
        },
        {
          title: 'Variables',
          type: 'group',
          children: [
            { title: 'Overview', link: '/components/variables' },
            {
              title: 'FlowContextSelector',
              link: '/components/variables/flow-context-selector',
            },
            {
              title: 'VariableInput',
              children: [
                { title: 'Basic usage', link: '/components/variables/variable-input' },
                { title: 'Filter conditions', link: '/components/variables/variable-input/scenarios/filter' },
                { title: 'Linkage rules', link: '/components/variables/variable-input/scenarios/linkage-rule' },
                { title: 'Field assignment', link: '/components/variables/variable-input/scenarios/assign-fields-value' },
                { title: 'Data scope', link: '/components/variables/variable-input/scenarios/data-scope' },
              ],
            },
            { title: 'SlateVariableEditor', link: '/components/variables/slate-variable-editor' },
            { title: 'TextArea with Context Selector', link: '/components/variables/text-area-with-context-selector' },
          ],
        },
      ],
      '/examples': [
        {
          title: 'FlowModel',
          type: 'group',
          children: [
            {
              title: 'Hello，NocoBase',
              link: '/examples/flow-models/hello-world',
            },
            {
              title: 'AddSubModelButton',
              link: '/examples/flow-models/sub-model',
            },
            {
              title: 'Load model',
              link: '/examples/flow-models/load-model',
            },
            {
              title: 'Fork model',
              link: '/examples/flow-models/fork-model',
            },
            {
              title: 'Drag and drop (DND)',
              link: '/examples/flow-models/dnd',
            },
            {
              title: 'Configurable card',
              link: '/examples/flow-models/my-card',
            },
            {
              title: 'Vditor integration',
              link: '/examples/flow-models/vditor',
            },
            {
              title: 'Markdown parsing',
              link: '/examples/flow-models/markdown',
            },
            {
              title: 'LiquidJS integration',
              link: '/examples/flow-models/liquidjs',
            },
            {
              title: 'CRUD',
              link: '/examples/flow-models/crud',
            },
            {
              title: 'Error boundary',
              link: '/examples/flow-models/error-boundary',
            },
            {
              title: 'Lifecycle',
              link: '/examples/flow-models/lifecycle',
            },
            {
              title: 'scheduleModelOperation',
              link: '/examples/flow-models/schedule-model-operation',
            },
            {
              title: 'hidden property demo',
              link: '/examples/flow-model-hidden',
            },
          ],
        },
        {
          title: 'FlowDefinition',
          type: 'group',
          children: [
            {
              title: 'Property flow',
              link: '/examples/flow-definition/props-flow',
            },
            {
              title: 'Event flow',
              link: '/examples/flow-definition/event-flow',
            },
            {
              title: 'Context (runtime)',
              link: '/examples/flow-definition/context-runtime',
            },
            {
              title: 'Context (settings)',
              link: '/examples/flow-definition/context-settings',
            },
            {
              title: 'uiSchema - step settings form',
              link: '/examples/flow-definition/ui-schema-basic',
            },
            {
              title: 'Custom component (settings form)',
              link: '/examples/flow-definition/ui-schema-custom-component',
            },
            {
              title: 'defaultParams - default step parameters',
              link: '/examples/flow-definition/default-params',
            },
            {
              title: 'beforeParamsSave - before saving step parameters',
              link: '/examples/flow-definition/before-params-save',
            },
            {
              title: 'afterParamsSave - after saving step parameters',
              link: '/examples/flow-definition/after-params-save',
            },
            {
              title: 'handler - step handler',
              link: '/examples/flow-definition/handler',
            },
            {
              title: 'preset - predefined settings step',
              link: '/examples/flow-definition/preset',
            },
            {
              title: 'hideInSettings - hide in settings',
              link: '/examples/flow-definition/hide-in-settings',
            },
            {
              title: 'Extend the settings menu (common actions)',
              link: '/examples/flow-definition/settings-menu-extra-items',
            },
            {
              title: 'uiMode - step settings UI mode',
              link: '/examples/flow-definition/ui-mode',
            },
            {
              title: 'Open a predefined settings form',
              link: '/examples/flow-definition/open-preset-step-settings-dialog',
            },
            {
              title: 'Open a flow settings form',
              link: '/examples/flow-definition/open-settings',
            },
            {
              title: 'Flow Registry',
              link: '/examples/flow-definition/flow-registry',
            },
            {
              title: 'Action Registry',
              link: '/examples/flow-definition/action-registry',
            },
            {
              title: 'Event Registry',
              link: '/examples/flow-definition/event-registry',
            },
          ]
        },
        {
          title: 'FlowAction',
          type: 'group',
          children: [
            {
              title: 'FlowAction example',
              link: '/examples/flow-actions/example',
            },
          ],
        },
        {
          title: 'FlowContext',
          type: 'group',
          children: [
            {
              title: 'ctx.defineProperty() - define a property',
              link: '/examples/flow-context/define-property',
            },
            {
              title: 'ctx.defineMethod() - define a method',
              link: '/examples/flow-context/define-method',
            },
            {
              title: 'ctx.addDelegate() - delegate chain',
              link: '/examples/flow-context/add-delegate',
            },
            {
              title: 'Loading state of an asynchronous ctx property',
              link: '/examples/flow-context/loading',
            },
            {
              title: 'ctx.model',
              link: '/examples/flow-context/model',
            },
            {
              title: 'ctx.ref + ctx.onRefReady',
              link: '/examples/flow-context/ref',
            },
            {
              title: 'ctx.renderJson',
              link: '/examples/flow-context/render-json',
            },
            {
              title: 'ctx.requirejs',
              link: '/examples/flow-context/requirejs',
            },
            {
              title: 'ctx.requireAsync',
              link: '/examples/flow-context/require-async',
            },
            {
              title: 'ctx.runjs',
              link: '/examples/flow-context/runjs',
            },
            {
              title: 'ctx.openView',
              link: '/examples/flow-context/open-view',
            },
            {
              title: 'ctx.sql',
              link: '/examples/flow-context/sql',
            },
            {
              title: 'ctx.t',
              link: '/examples/flow-context/t',
            },
            {
              title: 'ctx.i18n',
              link: '/examples/flow-context/i18n',
            },
            {
              title: 'ctx.api',
              link: '/examples/flow-context/api',
            },
            {
              title: 'ctx.useResource()',
              link: '/examples/flow-context/use-resource',
            },
            {
              title: 'ctx.viewer',
              link: '/examples/flow-context/viewer',
            },
            {
              title: 'ctx.view',
              link: '/examples/flow-context/view',
            },
            {
              title: 'ctx.filterManager',
              link: '/examples/flow-context/filter-manager',
            },
            {
              title: 'ctx.app',
              link: '/examples/flow-context/app',
            },
            {
              title: 'ctx.engine',
              link: '/examples/flow-context/engine',
            },
            {
              title: 'ctx.router',
              link: '/examples/flow-context/router',
            },
            {
              title: 'ctx.route',
              link: '/examples/flow-context/route',
            },
            {
              title: 'ctx.location',
              link: '/examples/flow-context/location',
            },
            {
              title: 'ctx.antd',
              link: '/examples/flow-context/antd',
            },
            {
              title: 'ctx.modal',
              link: '/examples/flow-context/modal',
            },
            {
              title: 'ctx.message',
              link: '/examples/flow-context/message',
            },
            {
              title: 'ctx.notification',
              link: '/examples/flow-context/notification',
            },
            {
              title: 'ctx.dataSourceManager',
              link: '/examples/flow-context/data-source-manager',
            },
            {
              title: 'ctx.dataSource',
              link: '/examples/flow-context/data-source',
            },
            {
              title: 'ctx.collection',
              link: '/examples/flow-context/collection',
            },
            {
              title: 'ctx.collectionField',
              link: '/examples/flow-context/collection-field',
            },
            {
              title: 'ctx.association',
              link: '/examples/flow-context/association',
            },
            {
              title: 'ctx.resource',
              link: '/examples/flow-context/resource',
            },
            {
              title: 'ctx.exit()',
              link: '/examples/flow-context/exit',
            },
            {
              title: 'ctx.customRepository',
              link: '/examples/flow-context/custom-repository',
            },
          ],
        },
        {
          title: 'FlowResource',
          type: 'group',
          children: [
            {
              title: 'Simple Resource',
              link: '/examples/flow-resources/simple-resource',
            },
            {
              title: 'APIResource',
              link: '/examples/flow-resources/api-resource',
            },
            {
              title: 'SingleRecordResource',
              link: '/examples/flow-resources/single-record-resource',
            },
            {
              title: 'MultiRecordResource',
              link: '/examples/flow-resources/multi-record-resource',
            },
            {
              title: 'SQLResource',
              link: '/examples/flow-resources/sql-resource',
            },
          ],
        },
        {
          title: 'React Hooks',
          type: 'group',
          children: [
            {
              title: 'useFlowEngine',
              link: '/examples/hooks/use-flow-engine',
            },
            {
              title: 'useFlowContext',
              link: '/examples/hooks/use-flow-context',
            },
            {
              title: 'useFlowEngineContext',
              link: '/examples/hooks/use-flow-engine-context',
            },
            {
              title: 'useFlowModelContext',
              link: '/examples/hooks/use-flow-model-context',
            },
            {
              title: 'useFlowSettingsContext',
              link: '/examples/hooks/use-flow-settings-context',
            },
            {
              title: 'useFlowViewContext',
              link: '/examples/hooks/use-flow-view-context',
            },
          ],
        },
        {
          title: 'Unit tests',
          type: 'group',
          children: [
            {
              title: 'FlowModel tests',
              link: '/examples/tests/flow-model-test',
            },
            {
              title: 'Flow tests',
              link: '/examples/tests/flow-test',
            },
          ],
        }
      ],
      '/learn': [
        {
          title: 'Extension guide',
          link: '/learn',
        },
        {
          title: 'Write and run JS online',
          link: '/learn/js-in-nocobase',
        },
        {
          title: 'Quick start',
          type: 'group',
          children: [
            {
              title: 'Write your first FlowModel plugin',
              link: '/learn/flow-model-plugin',
            },
            {
              title: 'Build a composable button component',
              link: '/learn/quickstart',
            },
          ],
        },
        {
          title: 'Block extensions',
          type: 'group',
          children: [
            {
              title: 'Block categories',
              link: '/learn/block-categories',
            },
            {
              title: 'Block use cases',
              link: '/learn/block-scenes',
            },
          ]
        },
        {
          title: 'Basic',
          type: 'group',
          children: [
            {
              title: 'Create a FlowModel',
              link: '/learn/create-flow-model',
            },
            {
              title: 'What is a FlowModel?',
              link: '/learn/what-is-flow-model',
            },
            {
              title: 'FlowModel lifecycle',
              link: '/learn/lifecycle',
            },
            {
              title: 'Observable',
              link: '/learn/observable',
            },

            // {
            //   title: 'Define Collection',
            //   link: '/learn/define-collection',
            // },
            // {
            //   title: 'Block extensions',
            //   link: '/learn/block',
            // },
            // {
            //   title: 'Action extensions',
            //   link: '/learn/action',
            // },
            // {
            //   title: 'Field extensions',
            //   link: '/learn/field',
            // },
          ],
        },
        {
          title: 'Upgrade guide',
          type: 'group',
          children: [
            {
              title: '1.0 vs 2.0',
              link: '/learn/1-0-vs-2-0',
            }
          ]
        }
      ],
      '/models': [
        {
          title: 'Overview',
          link: '/models',
        },
        {
          title: 'Blocks',
          type: 'group',
          children: [
            {
              title: 'BlockModel',
              link: '/models/blocks/block-model',
              extra: 'Base class',
            },
            {
              title: 'CollectionBlockModel',
              link: '/models/blocks/collection-block-model',
              extra: 'Base class',
            },
            {
              title: 'DataBlockModel',
              link: '/models/blocks/data-block-model',
              extra: 'Base class',
            },
            {
              title: 'FilterBlockModel',
              link: '/models/blocks/filter-block-model',
              extra: 'Base class',
            },
            {
              title: 'JSBlockModel',
              link: '/models/blocks/js-block-model',
            },
          ],
        },
        // {
        //   title: 'Filters',
        //   type: 'group',
        //   children: [
        //     {
        //       title: 'FormFilterModel',
        //       link: '/models/filters/form-filter-model',
        //     },
        //   ],
        // },
        {
          title: 'Fields',
          type: 'group',
          children: [
            {
              title: 'FieldModel',
              link: '/models/fields/field-model',
              extra: 'Base class',
            },
            {
              title: 'ClickableFieldModel',
              link: '/models/fields/clickable-field-model',
              extra: 'Base class',
            },
            {
              title: 'DisplayItemModel',
              link: '/models/fields/display-item-model',
            },
            {
              title: 'EditableItemModel',
              link: '/models/fields/editable-item-model',
            },
            {
              title: 'FilterableItemModel',
              link: '/models/fields/filterable-item-model',
            },
            {
              title: 'JSFieldModel',
              link: '/models/fields/js-field-model',
            },
            {
              title: 'JSItemModel',
              link: '/models/fields/js-item-model',
            },
            {
              title: 'JSColumnModel',
              link: '/models/fields/js-column-model',
            },
          ],
        },
        {
          title: 'Actions',
          type: 'group',
          children: [
            {
              title: 'ActionModel',
              link: '/models/actions/action-model',
              extra: 'Base class',
            },
            {
              title: 'PopupActionModel',
              link: '/models/actions/popup-action-model',
              extra: 'Base class',
            },
            {
              title: 'FormActionModel',
              link: '/models/actions/form-action-model',
              extra: 'Base class',
            },
            {
              title: 'FilterFormActionModel',
              link: '/models/actions/filter-form-action-model',
              extra: 'Base class',
            },
            {
              title: 'JSActionModel',
              link: '/models/actions/js-action-model',
            },
          ],
        },
      ],
      '/api': [
        {
          type: 'group',
          title: 'Flow Engine',
          children: [
            {
              title: 'Overview',
              link: '/api/flow-engine',
            },
            {
              title: 'FlowEngine',
              link: '/api/flow-engine/flow-engine',
            },
            {
              title: 'FlowContext',
              children: [
                {
                  title: 'Overview',
                  link: '/api/flow-engine/flow-context',
                },
                {
                  title: 'FlowContext',
                  link: '/api/flow-engine/flow-context/flow-context',
                },
                {
                  title: 'FlowEngineContext',
                  link: '/api/flow-engine/flow-context/flow-engine-context',
                },
                {
                  title: 'FlowModelContext',
                  link: '/api/flow-engine/flow-context/flow-model-context',
                },
                {
                  title: 'FlowRuntimeContext',
                  link: '/api/flow-engine/flow-context/flow-runtime-context',
                },
              ],
            },
            {
              title: 'FlowModel',
              children: [
                {
                  title: 'Overview',
                  link: '/api/flow-engine/flow-model',
                },
                {
                  title: 'FlowModel',
                  link: '/api/flow-engine/flow-model/flow-model',
                },
                {
                  title: 'SubModel',
                  link: '/api/flow-engine/flow-model/sub-model',
                },
                {
                  title: 'ForkModel',
                  link: '/api/flow-engine/flow-model/fork-model',
                },
              ]
            },
            {
              title: 'FlowModelRenderer',
              link: '/api/flow-engine/flow-model-renderer',
            },
            {
              title: 'FlowModelRepository',
              link: '/api/flow-engine/flow-model-repository',
            },
            {
              title: 'FlowDefinition',
              link: '/api/flow-engine/flow-definition',
            },
            {
              title: 'FlowRegistry',
              link: '/api/flow-engine/flow-registry',
            },
            {
              title: 'FlowAction',
              link: '/api/flow-engine/flow-action',
            },
            {
              title: 'FlowActionRegistry',
              link: '/api/flow-engine/flow-action-registry',
            },
            {
              title: 'FlowEventRegistry',
              link: '/api/flow-engine/flow-event-registry',
            },
            {
              title: 'FlowResource',
              children: [
                {
                  title: 'Overview',
                  link: '/api/flow-engine/flow-resource',
                },
                {
                  title: 'APIResource',
                  link: '/api/flow-engine/flow-resource/api-resource',
                },
                {
                  title: 'SingleRecordResource',
                  link: '/api/flow-engine/flow-resource/single-record-resource',
                },
                {
                  title: 'MultiRecordResource',
                  link: '/api/flow-engine/flow-resource/multi-record-resource',
                },
                {
                  title: 'SQLResource',
                  link: '/api/flow-engine/flow-resource/sql-resource',
                },
              ],
            },
            {
              title: 'FlowSettings',
              link: '/api/flow-engine/flow-settings',
            },
            {
              title: 'FlowSQLRepository',
              link: '/api/flow-engine/flow-sql-repository',
            },
          ]
        }
      ],
      // '/core': [
      //   // {
      //   //   title: 'Application',
      //   //   type: 'group',
      //   //   children: [
      //   //     {
      //   //       title: 'Application',
      //   //       link: '/core/application/application',
      //   //     },
      //   //     {
      //   //       title: 'PluginManager',
      //   //       link: '/core/application/plugin-manager',
      //   //     },
      //   //     {
      //   //       title: 'RouterManager',
      //   //       link: '/core/application/router-manager',
      //   //     },
      //   //     {
      //   //       title: 'PluginSettingsManager',
      //   //       link: '/core/application/plugin-settings-manager',
      //   //     },
      //   //     {
      //   //       title: 'Request',
      //   //       link: '/core/request',
      //   //     },
      //   //   ],
      //   // },
      //   {
      //     title: 'Quickstart',
      //     link: '/core/flow-models/quickstart',
      //   },
      //   {
      //     title: 'FlowEngine',
      //     type: 'group',
      //     children: [
      //       {
      //         title: 'Overview',
      //         link: '/core/flow-engine',
      //       },
      //       {
      //         title: 'FlowEngine',
      //         link: '/core/flow-engine/flow-engine',
      //       },
      //       {
      //         title: 'FlowModelRepository',
      //         link: '/core/flow-engine/flow-model-repository',
      //       },
      //       {
      //         title: 'FlowModel',
      //         link: '/core/flow-engine/flow-model',
      //       },
      //       {
      //         title: 'FlowSubModel',
      //         link: '/core/flow-engine/flow-sub-model',
      //       },
      //       {
      //         title: 'FlowModelRenderer',
      //         link: '/core/flow-engine/flow-model-renderer',
      //       },
      //       {
      //         title: 'FlowModelSettings',
      //         link: '/core/flow-engine/flow-model-settings',
      //       },
      //       {
      //         title: 'FlowDefinition',
      //         link: '/core/flow-engine/flow-definition',
      //       },
      //       {
      //         title: 'FlowResource',
      //         link: '/core/flow-engine/flow-resource',
      //       },
      //       {
      //         title: 'FlowContext',
      //         children: [
      //           {
      //             title: 'Overview',
      //             link: '/core/flow-engine/flow-context',
      //           },
      //           {
      //             title: 'FlowContext',
      //             link: '/core/flow-engine/flow-context/flow-context',
      //           },
      //           {
      //             title: 'FlowEngineContext',
      //             link: '/core/flow-engine/flow-context/flow-engine-context',
      //           },
      //           {
      //             title: 'FlowModelContext',
      //             link: '/core/flow-engine/flow-context/flow-model-context',
      //           },
      //           {
      //             title: 'FlowRuntimeContext',
      //             link: '/core/flow-engine/flow-context/flow-runtime-context',
      //           },
      //         ],
      //       },
      //       {
      //         title: 'FlowAction',
      //         link: '/core/flow-engine/flow-action',
      //       },
      //       {
      //         title: 'FlowHooks',
      //         link: '/core/flow-engine/flow-hooks',
      //       },
      //     ],
      //   },
      //   {
      //     title: 'Flow Models',
      //     type: 'group',
      //     children: [
      //       {
      //         title: 'Overview',
      //         link: '/core/flow-models',
      //       },
      //       {
      //         title: 'LayoutModel',
      //         link: '/core/flow-models/layout-flow-model',
      //       },
      //       {
      //         title: 'LayoutRouteModel',
      //         link: '/core/flow-models/layout-route-flow-model',
      //       },
      //       {
      //         title: 'PageModel',
      //         link: '/core/flow-models/page-flow-model',
      //       },
      //       {
      //         title: 'PageTabModel',
      //         link: '/core/flow-models/page-tab-flow-model',
      //       },
      //       {
      //         title: 'GridModel',
      //         link: '/core/flow-models/grid-flow-model',
      //       },
      //       {
      //         title: 'BlockGridModel',
      //         link: '/core/flow-models/block-grid-flow-model',
      //       },
      //       {
      //         title: 'BlockModel',
      //         link: '/core/flow-models/block-flow-model',
      //       },
      //       {
      //         title: 'FormModel',
      //         link: '/core/flow-models/form-flow-model',
      //       },
      //       {
      //         title: 'TableBlockModel',
      //         link: '/core/flow-models/table-flow-model',
      //       },
      //       {
      //         title: 'DetailsBlockModel',
      //         link: '/core/flow-models/details-flow-model',
      //       },
      //       {
      //         title: 'ListModel',
      //         link: '/core/flow-models/list-flow-model',
      //       },
      //       {
      //         title: 'CalendarModel',
      //         link: '/core/flow-models/calendar-flow-model',
      //       },

      //       {
      //         title: 'KanbanModel',
      //         link: '/core/flow-models/kanban-flow-model',
      //       },
      //       {
      //         title: 'MapModel',
      //         link: '/core/flow-models/map-flow-model',
      //       },
      //       {
      //         title: 'GanttModel',
      //         link: '/core/flow-models/gantt-flow-model',
      //       },
      //       {
      //         title: 'ChartModel',
      //         link: '/core/flow-models/chart-flow-model',
      //       },
      //       {
      //         title: 'MarkdownModel',
      //         link: '/core/flow-models/markdown-flow-model',
      //       },
      //       {
      //         title: 'HtmlModel',
      //         link: '/core/flow-models/html-flow-model',
      //       },
      //       {
      //         title: 'iframeModel',
      //         link: '/core/flow-models/iframe-flow-model',
      //       },
      //       {
      //         title: 'TimelineModel',
      //         link: '/core/flow-models/timeline-flow-model',
      //       },
      //       {
      //         title: 'CollapseModel',
      //         link: '/core/flow-models/collapse-flow-model',
      //       },
      //     ],
      //   },
      //   {
      //     title: 'Flow Actions',
      //     type: 'group',
      //     children: [
      //       {
      //         title: 'Overview',
      //         link: '/core/flow-actions',
      //       },
      //     ],
      //   },
      // ],
      // '/components': [
      //   {
      //     title: 'Action',
      //     type: 'group',
      //     children: [
      //       {
      //         "title": "Action",
      //         "link": "/components/action"
      //       },
      //       {
      //         "title": "Filter",
      //         "link": "/components/filter"
      //       },
      //       {
      //         "title": "LinkageFilter",
      //         "link": "/components/linkage-filter"
      //       },
      //     ]
      //   },
      //   {
      //     title: 'Field',
      //     type: 'group',
      //     children: [
      //       {
      //         "title": "Checkbox",
      //         "link": "/components/checkbox"
      //       },
      //       {
      //         "title": "Cascader",
      //         "link": "/components/cascader"
      //       },
      //       {
      //         "title": "ColorPicker",
      //         "link": "/components/color-picker"
      //       },
      //       {
      //         "title": "ColorSelect",
      //         "link": "/components/color-select"
      //       },
      //       {
      //         "title": "DatePicker",
      //         "link": "/components/date-picker"
      //       },
      //       {
      //         "title": "TimePicker",
      //         "link": "/components/time-picker"
      //       },
      //       {
      //         "title": "IconPicker",
      //         "link": "/components/icon-picker"
      //       },
      //       {
      //         "title": "InputNumber",
      //         "link": "/components/input-number"
      //       },
      //       {
      //         "title": "Input",
      //         "link": "/components/input"
      //       },
      //       {
      //         "title": "AutoComplete",
      //         "link": "/components/auto-complete"
      //       },
      //       {
      //         "title": "NanoIDInput",
      //         "link": "/components/nanoid-input"
      //       },
      //       {
      //         "title": "Password",
      //         "link": "/components/password"
      //       },
      //       {
      //         "title": "Percent",
      //         "link": "/components/percent"
      //       },
      //       {
      //         "title": "Radio",
      //         "link": "/components/radio"
      //       },
      //       {
      //         "title": "Select",
      //         "link": "/components/select"
      //       },
      //       {
      //         "title": "RemoteSelect",
      //         "link": "/components/remote-select"
      //       },
      //       {
      //         "title": "TreeSelect",
      //         "link": "/components/tree-select"
      //       },
      //       {
      //         "title": "Upload",
      //         "link": "/components/upload"
      //       },
      //       {
      //         "title": "CollectionSelect",
      //         "link": "/components/collection-select"
      //       },
      //       {
      //         "title": "Cron",
      //         "link": "/components/cron"
      //       },
      //       {
      //         "title": "Markdown",
      //         "link": "/components/markdown"
      //       },
      //       {
      //         "title": "Variable",
      //         "link": "/components/variable"
      //       },
      //       {
      //         "title": "QuickEdit",
      //         "link": "/components/quick-edit"
      //       },
      //       {
      //         "title": "RichText",
      //         "link": "/components/rich-text"
      //       }
      //     ]
      //   },
      //   {
      //     title: 'Block',
      //     type: 'group',
      //     children: [
      //       {
      //         "title": "BlockItem",
      //         "link": "/components/block-item"
      //       },
      //       {
      //         "title": "CardItem",
      //         "link": "/components/card-item"
      //       },
      //       {
      //         "title": "FormItem",
      //         "link": "/components/form-item"
      //       },
      //       {
      //         "title": "FormV2",
      //         "link": "/components/form-v2"
      //       },
      //       {
      //         "title": "TableV2",
      //         "link": "/components/table-v2"
      //       },
      //       {
      //         "title": "Details",
      //         "link": "/components/details"
      //       },
      //       {
      //         "title": "GridCard",
      //         "link": "/components/grid-card"
      //       },
      //       {
      //         "title": "Grid",
      //         "link": "/components/grid"
      //       },
      //       {
      //         "title": "List",
      //         "link": "/components/list"
      //       },
      //     ]
      //   },
      //   {
      //     title: 'Others',
      //     type: 'group',
      //     children: [
      //       {
      //         "title": "Tabs",
      //         "link": "/components/tabs"
      //       },
      //       {
      //         "title": "ErrorFallback",
      //         "link": "/components/error-fallback"
      //       },
      //       {
      //         "title": "G2Plot",
      //         "link": "/components/g2plot"
      //       },
      //       {
      //         "title": "Menu",
      //         "link": "/components/menu"
      //       },
      //       {
      //         "title": "Pagination",
      //         "link": "/components/pagination"
      //       },
      //     ]
      //   },
      // ]
      // '/ui-schema': [
      //   {
      //     title: 'Overview',
      //     link: '/ui-schema',
      //   },
      //   {
      //     title: 'Globals',
      //     type: 'group',
      //     children: [
      //       {
      //         title: 'Menu',
      //         link: '/ui-schema/globals/menu',
      //       },
      //       {
      //         title: 'Page',
      //         link: '/ui-schema/globals/page',
      //       },
      //       {
      //         title: 'Tabs',
      //         link: '/ui-schema/globals/tabs',
      //       },
      //     ],
      //   },
      //   {
      //     title: 'Blocks',
      //     type: 'group',
      //     children: [
      //       {
      //         title: 'Overview',
      //         link: '/ui-schema/blocks',
      //       },
      //       {
      //         title: 'Data blocks',
      //         children: [
      //           {
      //             title: 'Overview',
      //             link: '/ui-schema/blocks/data',
      //           },
      //           {
      //             title: 'Table',
      //             link: '/ui-schema/blocks/data/table',
      //           },
      //           {
      //             title: 'Form',
      //             link: '/ui-schema/blocks/data/form',
      //           },
      //           {
      //             title: 'Form(Read pretty)',
      //             link: '/ui-schema/blocks/data/form-read-pretty',
      //           },
      //           {
      //             title: 'Details',
      //             link: '/ui-schema/blocks/data/details',
      //           },
      //           {
      //             title: 'List',
      //             link: '/ui-schema/blocks/data/list',
      //           },
      //           {
      //             title: 'Grid Card',
      //             link: '/ui-schema/blocks/data/grid-card',
      //           },
      //           {
      //             title: 'Calendar',
      //             link: '/ui-schema/blocks/data/calendar',
      //           },
      //           {
      //             title: 'Kanban',
      //             link: '/ui-schema/blocks/data/kanban',
      //           },
      //           {
      //             title: 'Map',
      //             link: '/ui-schema/blocks/data/map',
      //           },
      //           {
      //             title: 'Gantt',
      //             link: '/ui-schema/blocks/data/gantt',
      //           },
      //           {
      //             title: 'Charts',
      //             link: '/ui-schema/blocks/data/charts',
      //           },
      //         ],
      //       },
      //       {
      //         title: 'Filter blocks',
      //         children: [
      //           {
      //             title: 'Collapse',
      //             link: '/ui-schema/blocks/filter/collapse',
      //           },
      //           {
      //             title: 'Form',
      //             link: '/ui-schema/blocks/filter/form',
      //           },
      //         ],
      //       },
      //       {
      //         title: 'Other blocks',
      //         children: [
      //           {
      //             title: 'iframe',
      //             link: '/ui-schema/blocks/others/iframe',
      //           },
      //           {
      //             title: 'Markdown',
      //             link: '/ui-schema/blocks/others/markdown',
      //           },
      //           {
      //             title: 'Workflow todos',
      //             link: '/ui-schema/blocks/others/workflow-todo',
      //           },
      //         ],
      //       },
      //     ],
      //   },
      //   {
      //     title: 'Fields',
      //     type: 'group',
      //     children: [
      //       {
      //         title: 'Overview',
      //         link: '/ui-schema/fields',
      //       },
      //       {
      //         title: 'FormItem',
      //         link: '/ui-schema/fields/form-item',
      //       },
      //       {
      //         title: 'TableColumn',
      //         link: '/ui-schema/fields/table-column',
      //       },
      //       {
      //         title: 'Association',
      //         children: [
      //           {
      //             title: 'Title',
      //             link: '/ui-schema/fields/association-components/title',
      //           },
      //           {
      //             title: 'Tag',
      //             link: '/ui-schema/fields/association-components/tag',
      //           },
      //           {
      //             title: 'Select',
      //             link: '/ui-schema/fields/association-components/select',
      //           },
      //           {
      //             title: 'RecordPicker',
      //             link: '/ui-schema/fields/association-components/record-picker',
      //           },
      //           {
      //             title: 'Cascader',
      //             link: '/ui-schema/fields/association-components/cascader-select',
      //           },
      //           {
      //             title: 'Sub-form',
      //             link: '/ui-schema/fields/association-components/sub-form',
      //           },
      //           {
      //             title: 'Sub-form(Popover)',
      //             link: '/ui-schema/fields/association-components/sub-form-popover',
      //           },
      //           {
      //             title: 'Sub-details',
      //             link: '/ui-schema/fields/association-components/sub-details',
      //           },
      //           {
      //             title: 'Sub-table',
      //             link: '/ui-schema/fields/association-components/cascader-select',
      //           },
      //           {
      //             title: 'File manager',
      //             link: '/ui-schema/fields/association-components/file-manager',
      //           },
      //         ],
      //       },
      //     ],
      //   },
      //   {
      //     title: 'Actions',
      //     type: 'group',
      //     children: [
      //       {
      //         title: 'Overview',
      //         link: '/ui-schema/actions',
      //       },
      //       {
      //         title: 'Add new',
      //         link: '/ui-schema/actions/add-new',
      //       },
      //       {
      //         title: 'View',
      //         link: '/ui-schema/actions/view',
      //       },
      //       {
      //         title: 'Edit',
      //         link: '/ui-schema/actions/edit',
      //       },
      //       {
      //         title: 'Delete',
      //         link: '/ui-schema/actions/delete',
      //       },
      //       {
      //         title: 'Submit',
      //         link: '/ui-schema/actions/submit',
      //       },
      //       {
      //         title: 'Filter',
      //         link: '/ui-schema/actions/filter',
      //       },
      //       {
      //         title: 'Refresh',
      //         link: '/ui-schema/actions/refresh',
      //       },
      //       {
      //         title: 'Print',
      //         link: '/ui-schema/actions/print',
      //       },
      //       {
      //         title: 'Duplicate',
      //         link: '/ui-schema/actions/duplicate',
      //       },
      //       {
      //         title: 'Export',
      //         link: '/ui-schema/actions/export',
      //       },
      //       {
      //         title: 'Import',
      //         link: '/ui-schema/actions/import',
      //       },
      //       {
      //         title: 'Bulk update',
      //         link: '/ui-schema/actions/bulk-update',
      //       },
      //       {
      //         title: 'Bulk edit',
      //         link: '/ui-schema/actions/bulk-edit',
      //       },
      //       {
      //         title: 'Add record (any collection)',
      //         link: '/ui-schema/actions/add-record',
      //       },
      //       {
      //         title: 'Update record',
      //         link: '/ui-schema/actions/update-record',
      //       },
      //       {
      //         title: 'Save record',
      //         link: '/ui-schema/actions/save-record',
      //       },
      //       {
      //         title: 'Custom request',
      //         link: '/ui-schema/actions/custom-request',
      //       },
      //       {
      //         title: 'Submit to workflow',
      //         link: '/ui-schema/actions/submit-to-workflow',
      //       },
      //     ],
      //   },
      // ],
    },
    localesEnhance: [
      { id: 'ru-RU', switchPrefix: 'ru', hostname: 'docs-ru.nocobase.com' },
      { id: 'en-US', switchPrefix: 'en', hostname: 'client.docs.nocobase.com' },
    ],
  }),
});
