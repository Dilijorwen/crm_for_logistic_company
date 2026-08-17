/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { FlowRunJSContext } from '../../flowContext';

export function defineBaseContextMeta() {
  FlowRunJSContext.define({
    label: 'RunJS base',
    properties: {
      logger: 'Pino logger instance for structured logging. Example: `ctx.logger.info({ foo: 1 }, "message")`',
      message: {
        description: 'Ant Design global message API for displaying temporary messages.',
        detail: 'MessageInstance',
        hidden: (ctx: any) => !(ctx as any)?.message,
        examples: ['ctx.message.success("Operation completed")'],
        properties: {
          info: {
            type: 'function',
            description: 'Show an info message.',
            detail: '(content: any, duration?: number) => void',
            completion: { insertText: `ctx.message.info('Info')` },
          },
          success: {
            type: 'function',
            description: 'Show a success message.',
            detail: '(content: any, duration?: number) => void',
            completion: { insertText: `ctx.message.success('Success')` },
          },
          error: {
            type: 'function',
            description: 'Show an error message.',
            detail: '(content: any, duration?: number) => void',
            completion: { insertText: `ctx.message.error('Error')` },
          },
          warning: {
            type: 'function',
            description: 'Show a warning message.',
            detail: '(content: any, duration?: number) => void',
            completion: { insertText: `ctx.message.warning('Warning')` },
          },
          loading: {
            type: 'function',
            description: 'Show a loading message.',
            detail: '(content: any, duration?: number) => void',
            completion: { insertText: `ctx.message.loading('Loading...')` },
          },
          open: {
            type: 'function',
            description: 'Open a message with custom config.',
            detail: '(config: any) => void',
            completion: { insertText: `ctx.message.open({ type: 'info', content: 'Hello' })` },
          },
          destroy: {
            type: 'function',
            description: 'Destroy all messages.',
            detail: '() => void',
            completion: { insertText: `ctx.message.destroy()` },
          },
        },
      },
      notification: {
        description: 'Ant Design notification API for displaying notification boxes.',
        detail: 'NotificationInstance',
        hidden: (ctx: any) => !(ctx as any)?.notification,
        examples: ['ctx.notification.open({ message: "Title", description: "Content" })'],
        properties: {
          open: {
            type: 'function',
            description: 'Open a notification with config.',
            detail: '(config: any) => void',
            completion: { insertText: `ctx.notification.open({ message: 'Title', description: 'Content' })` },
          },
          success: {
            type: 'function',
            description: 'Open a success notification.',
            detail: '(config: any) => void',
            completion: { insertText: `ctx.notification.success({ message: 'Success' })` },
          },
          info: {
            type: 'function',
            description: 'Open an info notification.',
            detail: '(config: any) => void',
            completion: { insertText: `ctx.notification.info({ message: 'Info' })` },
          },
          warning: {
            type: 'function',
            description: 'Open a warning notification.',
            detail: '(config: any) => void',
            completion: { insertText: `ctx.notification.warning({ message: 'Warning' })` },
          },
          error: {
            type: 'function',
            description: 'Open an error notification.',
            detail: '(config: any) => void',
            completion: { insertText: `ctx.notification.error({ message: 'Error' })` },
          },
          destroy: {
            type: 'function',
            description: 'Destroy all notifications.',
            detail: '(key?: string) => void',
            completion: { insertText: `ctx.notification.destroy()` },
          },
        },
      },
      modal: {
        description: 'Ant Design modal API (HookAPI) for opening modal dialogs.',
        detail: 'HookAPI',
        hidden: (ctx: any) => !(ctx as any)?.modal,
        examples: [`ctx.modal.confirm({ title: 'Confirm', content: 'Are you sure?' })`],
        properties: {
          info: {
            type: 'function',
            description: 'Open an info modal.',
            detail: '(config: any) => void',
            completion: { insertText: `ctx.modal.info({ title: 'Info', content: '...' })` },
          },
          success: {
            type: 'function',
            description: 'Open a success modal.',
            detail: '(config: any) => void',
            completion: { insertText: `ctx.modal.success({ title: 'Success', content: '...' })` },
          },
          error: {
            type: 'function',
            description: 'Open an error modal.',
            detail: '(config: any) => void',
            completion: { insertText: `ctx.modal.error({ title: 'Error', content: '...' })` },
          },
          warning: {
            type: 'function',
            description: 'Open a warning modal.',
            detail: '(config: any) => void',
            completion: { insertText: `ctx.modal.warning({ title: 'Warning', content: '...' })` },
          },
          confirm: {
            type: 'function',
            description: 'Open a confirm modal.',
            detail: '(config: any) => void',
            completion: { insertText: `ctx.modal.confirm({ title: 'Confirm', content: '...' })` },
          },
        },
      },
      // TODO: context meta
      resource: {
        description:
          'The current FlowResource instance in this context, used to access and manipulate data. In most block/popup scenarios it is pre-bound by the runtime (no need to call ctx.initResource). In contexts like plain JS blocks where no resource is bound, you can call ctx.initResource(type) first and then use ctx.resource.',
        detail: 'FlowResource',
        examples: ['await ctx.resource.refresh();'],
        properties: {
          // FlowResource
          getData: {
            description: 'Get current resource data.',
            detail: '() => any',
            completion: { insertText: 'ctx.resource.getData()' },
          },
          setData: {
            description: 'Set current resource data (client-side only).',
            detail: '(value: any) => this',
            completion: { insertText: 'ctx.resource.setData(value)' },
          },
          refresh: {
            description: 'Refresh data from server (available on API-backed resources).',
            detail: '() => Promise<any>',
            completion: { insertText: 'await ctx.resource.refresh()' },
          },
          on: {
            description: 'Subscribe resource events (e.g., refresh).',
            detail: '(event: string, callback: (...args) => void) => void',
            completion: { insertText: "ctx.resource.on('refresh', () => {})" },
          },
          off: {
            description: 'Unsubscribe resource events.',
            detail: '(event: string, callback: (...args) => void) => void',
            completion: { insertText: "ctx.resource.off('refresh', handler)" },
          },
          // BaseRecordResource / SingleRecordResource / MultiRecordResource helpers (common)
          setResourceName: {
            description: 'Set resource name (e.g., "users" or "users.profile").',
            detail: '(resourceName: string) => this',
            completion: { insertText: "ctx.resource.setResourceName('users')" },
          },
          setFilterByTk: {
            description: 'Set primary key or filterByTk for record resources.',
            detail: '(filterByTk: any) => this',
            completion: { insertText: 'ctx.resource.setFilterByTk(filterByTk)' },
          },
          runAction: {
            description: 'Run a resource action (create/update/destroy/custom actions).',
            detail: '(action: string, options: any) => Promise<any>',
            completion: { insertText: "await ctx.resource.runAction('create', { data: {} })" },
          },
          selectedRows: {
            description:
              'Selected rows in table resources (typically for collection/table actions). Availability depends on resource type.',
            detail: 'any[]',
          },
          pagination: {
            description:
              'Pagination info in list resources. Availability depends on resource type (e.g., MultiRecordResource).',
            detail: 'Record<string, any>',
          },
        },
      },
      urlSearchParams: 'URLSearchParams object containing query parameters from the current URL',
      token: 'API authentication token for the current session',
      role: 'Current user role information',
      auth: {
        description: 'Authentication context containing locale, role, user, and token information.',
        detail: 'AuthContext',
        properties: {
          locale: 'Current locale code (e.g., "en-US", "ru-RU").',
          roleName: 'Current role name.',
          token: 'Current API token.',
          user: 'Current user info object (if available).',
        },
      },
      viewer: {
        description: 'FlowViewer instance providing view helpers (drawer/dialog/popover/embed). ',
        detail: 'FlowViewer',
        examples: [
          "await ctx.viewer.drawer({ width: '56%', content: <div>Hello</div> });",
          'await ctx.viewer.dialog({ content: <div>Confirm</div> });',
        ],
        properties: {
          drawer: {
            description: 'Open a drawer view. Parameters: (props: ViewProps) => any',
            detail: '(props) => any',
            completion: { insertText: "await ctx.viewer.drawer({ width: '56%', content: <div /> })" },
          },
          dialog: {
            description: 'Open a dialog/modal view. Parameters: (props: ViewProps) => any',
            detail: '(props) => any',
            completion: { insertText: 'await ctx.viewer.dialog({ content: <div /> })' },
          },
          popover: {
            description: 'Open a popover view. Parameters: (props: PopoverProps) => any',
            detail: '(props) => any',
            completion: { insertText: 'await ctx.viewer.popover({ target: ctx.element?.__el, content: <div /> })' },
          },
          embed: {
            description: 'Open an embed view. Parameters: (props: ViewProps & TargetProps) => any',
            detail: '(props) => any',
            completion: { insertText: 'await ctx.viewer.embed({ target: document.body, content: <div /> })' },
          },
        },
      },
      popup: {
        description:
          'Popup context when current view is opened as a popup/drawer. Recommended: `const popup = await ctx.getVar("ctx.popup")`.',
        detail: 'Promise<PopupContext | undefined>',
        hidden: async (ctx: any) => {
          try {
            const popup = await (ctx as any)?.popup;
            return !popup?.uid;
          } catch (_) {
            // Fail-open: if we cannot determine, do not hide.
            return false;
          }
        },
        examples: [
          'const popup = await ctx.getVar("ctx.popup");',
          'const id = popup?.record?.id;',
          'const parentId = popup?.parent?.record?.id;',
        ],
        properties: {
          uid: 'Popup view uid (string).',
          record: 'Current popup record (object).',
          sourceRecord: 'Parent/source record inferred from sourceId/associationName (object).',
          resource: {
            description: 'Data source info of the popup record.',
            detail: 'PopupResourceInfo',
            properties: {
              dataSourceKey: 'Data source key (e.g., "main").',
              collectionName: 'Collection name.',
              associationName: 'Association resource name (optional).',
              filterByTk: 'Record primary key / filterByTk.',
              sourceId: 'Source id (optional).',
            },
          },
          parent: 'Parent popup info (object). You can access parent.parent... at runtime if available.',
        },
      },
      i18n: {
        description: 'An instance of i18next for managing internationalization.',
        detail: 'i18next',
        properties: {
          language: 'Current active language code.',
        },
      },
      libs: {
        properties: {
          React: 'React namespace (same as ctx.React).',
          ReactDOM: 'ReactDOM client API (same as ctx.ReactDOM).',
          antd: 'Ant Design component library (same as ctx.antd).',
          dayjs: 'dayjs date-time utility library.',
          antdIcons: 'Ant Design icons library. Example: `ctx.libs.antdIcons.PlusOutlined`.',
          lodash: 'Lodash utility library. Example: `ctx.libs.lodash.get(obj, "a.b")`.',
          formula: 'Formula.js library (spreadsheet-like functions). Example: `ctx.libs.formula.SUM(1, 2, 3)`.',
          math: 'mathjs library. Example: `ctx.libs.math.evaluate("2 + 3")`.',
        },
      },
    },
    methods: {
      request: {
        description:
          'Make an HTTP request using the APIClient instance. Parameters: (options: RequestOptions) => Promise<any>.',
        detail: '(options: RequestOptions) => Promise<any>',
        completion: { insertText: `await ctx.request({ url: '', method: 'get', params: {} })` },
      },
      getModel: {
        description:
          'Get a model instance by uid. By default, it searches across the current view stack and returns the first matched model.',
        detail: '(uid: string, searchInPreviousEngines?: boolean) => FlowModel | undefined',
        completion: { insertText: `ctx.getModel('block-uid-xxx')` },
        params: [
          {
            name: 'uid',
            type: 'string',
            description: 'Target model uid.',
          },
          {
            name: 'searchInPreviousEngines',
            type: 'boolean',
            description: 'Whether to search in parent engines (default: false).',
          },
        ],
        returns: { type: 'FlowModel | undefined' },
        examples: ["const model = ctx.getModel('block-uid-xxx');"],
      },
      t: 'Internationalization function for translating text. Parameters: (key: string, variables?: object) => string. Example: `ctx.t("Hello {{name}}", { name: "World" })`',
      initResource: {
        description:
          'Initialize ctx.resource as a FlowResource instance by class name. Common values: "MultiRecordResource", "SingleRecordResource", "SQLResource".',
        detail: '(resourceType: ResourceType) => void',
        completion: { insertText: "ctx.initResource('MultiRecordResource')" },
        examples: ["ctx.initResource('MultiRecordResource'); ctx.resource.setResourceName('users');"],
      },
      makeResource: {
        description:
          'Create a new resource instance without binding it to ctx.resource. Useful when you need multiple independent or temporary resources. Common values: "MultiRecordResource", "SingleRecordResource", "SQLResource".',
        detail: '(resourceType) => FlowResource',
        completion: { insertText: "const resource = ctx.makeResource('SingleRecordResource')" },
        examples: ["const resource = ctx.makeResource('SingleRecordResource'); resource.setResourceName('users');"],
      },
      render: {
        description:
          'Render into container. Accepts ReactElement, DOM Node/Fragment, or HTML string. Parameters: (vnode: ReactElement | Node | DocumentFragment | string, container?: HTMLElement|ElementProxy) => Root|null. Example: `ctx.render(<div>Hello</div>)` or `ctx.render("<b>hi</b>")`',
        detail: 'ReactDOM Root',
        completion: {
          insertText: `ctx.render(<div />)`,
        },
      },
      requireAsync:
        'Load UMD/AMD/global scripts or CSS asynchronously from URL. Accepts shorthand like "echarts@5/dist/echarts.min.js" (resolved via ESM CDN with ?raw) or full URLs, and returns a Promise of the loaded library.',
      importAsync:
        'Dynamically import ESM modules or CSS by URL. Accepts shorthand like "vue@3.4.0" or "dayjs@1/plugin/relativeTime.js" (resolved via configured ESM CDN) or full URLs, and returns a Promise of the module namespace.',
      getVar: {
        description: 'Resolve a ctx expression value by path string (expression starts with "ctx.").',
        detail: '(path: string) => Promise<any>',
        completion: { insertText: "await ctx.getVar('ctx.record.id')" },
        params: [
          {
            name: 'path',
            type: 'string',
            description: 'Expression path starts with "ctx." (e.g. "ctx.record.id", "ctx.record.roles[0].id").',
          },
        ],
        returns: { type: 'Promise<any>' },
        examples: ["const id = await ctx.getVar('ctx.record.id');"],
      },
      getApiInfos: {
        description: 'All available APIs under context namespace',
        detail: '(options?: { version?: string }) => Promise<Record<string, any>>',
        completion: { insertText: 'await ctx.getApiInfos()' },
        params: [
          {
            name: 'options',
            type: '{ version?: string }',
            optional: true,
            description: 'Options (e.g. version).',
          },
        ],
        returns: { type: 'Promise<Record<string, any>>' },
        examples: ['const apis = await ctx.getApiInfos();'],
      },
      getVarInfos: {
        description: 'All available variables could be used to get deeper data.',
        detail: '(options?: { path?: string|string[]; maxDepth?: number }) => Promise<Record<string, any>>',
        completion: { insertText: "await ctx.getVarInfos({ path: 'record', maxDepth: 3 })" },
        params: [
          {
            name: 'options',
            type: '{ path?: string|string[]; maxDepth?: number }',
            optional: true,
            description: 'Options for path trimming and maxDepth expansion.',
          },
        ],
        returns: { type: 'Promise<Record<string, any>>' },
        examples: ["const vars = await ctx.getVarInfos({ path: 'record', maxDepth: 3 });"],
      },
      getEnvInfos: {
        description: 'current runtime environment',
        detail: '() => Promise<Record<string, any>>',
        completion: { insertText: 'await ctx.getEnvInfos()' },
        returns: { type: 'Promise<Record<string, any>>' },
        examples: ['const envs = await ctx.getEnvInfos();'],
      },
      runAction: {
        description:
          'Execute a data action on the current resource. Parameters: (actionName: string, params: object) => Promise<any>. Example: `await ctx.runAction("create", { values: { name: "test" } })`',
        detail: 'Promise<any>',
        completion: {
          insertText: `await ctx.runAction('create', { values: {} })`,
        },
      },
      openView: {
        description: `Open a view component (page, modal, or drawer) by its unique identifier.
      Parameters: (viewId: string, options?: OpenViewOptions) => Promise<void>
      Options:
        - params: Record<string, any> - Parameters passed to the view component
        - mode: "page" | "modal" | "drawer" - Display mode (default: "drawer")
        - title: string - Modal/drawer title
        - width: number | string - Modal/drawer width
        - navigation: boolean - Whether to use route navigation
        - preventClose: boolean - Prevent closing the view
        - viewUid: string - Custom view UID for routing
        - isMobileLayout: boolean - Use mobile layout (displays as embed)
      Examples:
       - Modal with params: await ctx.openView("user-detail", { params: { id: 123 }, mode: "modal", title: "User Details", width: 800 })
       - Drawer (default): await ctx.openView("settings-page")
        - Page navigation: await ctx.openView("dashboard", { mode: "page" })`,
        detail: 'Promise<void>',
        completion: {
          insertText: `await ctx.openView('view-id', { mode: 'drawer', params: {} })`,
        },
      },
    },
  });
}
