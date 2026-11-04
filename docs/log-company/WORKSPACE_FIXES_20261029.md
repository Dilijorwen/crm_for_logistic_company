# Исправления общего рабочего списка — 29.10.2026

## Выполнено

- Установлен плагин `@log-company/plugin-process-governance` версии `2.0.103`.
- Создание и редактирование рейсов и поставок переведены на штатные формы NocoBase, работающие с исходными коллекциями и их ACL.
- Номер машины и название поставки открывают общее настраиваемое окно с вкладками «Рейс» и «Поставка».
- В рейсе доступны привязка и отвязка поставок, создание поставки и дерево рейсов.
- В поставке добавлены вкладки общих сведений, таможенного оформления и НТМ; ниже расположены документы и обсуждение.
- Убраны прежние служебные действия из строк, включена компактная плотность таблицы. Общая кнопка «Удалить» удаляет поставки.
- Если удаление поставки опустошает связанный рейс, этот рейс также удаляется. Проверяются все связанные рейсы, в том числе при перевозке одной поставки несколькими машинами.
- Права проверяются до изменений. Удаление, отвязка и удаление опустевших рейсов выполняются одной транзакцией; при ошибке операция откатывается.
- Исправлен поиск по русским названиям статусов; поля НТМ получили префикс «НТМ:».

## Изменённые файлы

Пути ниже указаны относительно корня репозитория. В таблице кода корень — `packages/plugins/@log-company/plugin-process-governance/`.

| Файл | Изменение |
| --- | --- |
| `package.json` | Версия 2.0.103. |
| `src/client/app/plugin.ts` | Регистрация новых моделей и действий, замена стандартного удаления только для рабочего списка. |
| `src/client/features/workspace-actions/index.ts` | Публичный API действий рабочего списка. |
| `src/client/features/workspace-actions/model/WorkspaceActionModels.tsx` | Создание исходных записей, общий popup и массовое удаление поставок. |
| `src/client/features/workspace-actions/model/__tests__/WorkspaceActionModels.test.ts` | Проверки исходных коллекций, выбранных рейсов и ключей popup. |
| `src/client/shared/lib/index.ts` | Экспорт общих функций через публичный API. |
| `src/client/shared/lib/workspace-record/index.ts` | Проверка и разбор составного ключа строки. |
| `src/client/widgets/workspace-context/index.ts` | Публичный API блоков контекста. |
| `src/client/widgets/workspace-context/ui/WorkspaceContextModels.tsx` | Контекст исходного рейса/поставки, вложенные вкладки и обновление списка после изменений. |
| `src/client/widgets/workspace-context/ui/__tests__/WorkspaceContextModels.test.ts` | Проверка передачи исходных ключей, сохранения методов popup и начальных значений формы. |
| `src/client/features/synchronize-shipment-form/model/ShipmentSynchronizedEditFormModel.ts` | Обновление рабочего списка после сохранения поставки или рейса. |
| `src/client/features/synchronize-shipment-form/model/__tests__/ShipmentSynchronizedEditFormModel.creation.test.ts` | Проверка синхронизации сохранений обеих исходных коллекций. |
| `src/server/application/logistics/DeleteWorkspaceShipments.ts` | Сценарий удаления с проверкой прав и поиском опустевших рейсов. |
| `src/server/application/logistics/__tests__/DeleteWorkspaceShipments.test.ts` | Проверки выбора, повторов, прав и ошибок сценария. |
| `src/server/collections/shipments.ts` | Единые названия полей НТМ. |
| `src/server/collections/logisticsWorkItems.ts` | Такие же названия полей в рабочем списке. |
| `src/server/composition/LogisticsModule.ts` | Подключение контроллера удаления. |
| `src/server/infrastructure/metadata/LogisticsWorkspaceNativeModels.ts` | Дерево штатных форм, вкладок, привязки, документов, обсуждения и дерева рейсов. |
| `src/server/infrastructure/metadata/UpgradeLogisticsWorkspace.ts` | Обновление существующего окна, удаление прежних действий строки и настройка popup. |
| `src/server/infrastructure/metadata/__tests__/LogisticsWorkspacePage.test.ts` | Проверка дерева моделей настоящим FlowModelRepository и повторного обновления. |
| `src/server/infrastructure/persistence/nocobase/NocoBaseWorkspaceDeletion.ts` | Транзакция, блокировки, ACL, отвязка и удаление обычными репозиториями. |
| `src/server/infrastructure/persistence/nocobase/__tests__/NocoBaseWorkspaceDeletion.integration.test.ts` | Проверки удаления общей поставки, сохранения непустого рейса и полного отката. |
| `src/server/interfaces/http/LogisticsWorkspaceActions.ts` | Сопоставление русских подписей статусов с кодами при поиске. |
| `src/server/interfaces/http/WorkspaceDeletionController.ts` | Защищённое действие `logisticsWorkspace:destroyShipments` и понятные ошибки. |
| `src/server/interfaces/http/__tests__/LogisticsWorkspaceActions.test.ts` | Поиск по статусам с учётом выбранных полей и прав. |
| `src/server/migrations/20261029120000-complete-logistics-workspace-actions.ts` | Миграция метаданных окна и названий полей НТМ. |

Документация репозитория:

- `docs/log-company/PROCESS_GOVERNANCE_PLUGIN.md` — актуальная схема форм, popup, поиска и удаления.
- `docs/log-company/WORKSPACE_FIXES_20261029.md` — этот отчёт.

## Архитектурные решения

`logistics_work_items` остаётся представлением для чтения. Создание и изменение выполняются в `transport_runs` и `shipments` штатными моделями форм NocoBase. Составной ключ строки переводится в ключ исходной записи отдельным переиспользуемым блоком контекста. Формы, вкладки и действия остаются доступны дизайнеру.

Правило удаления выделено в прикладной сценарий с независимым интерфейсом транзакции. Адаптер NocoBase проверяет права каждой исходной записи, блокирует затрагиваемые записи и использует обычные репозитории, сохраняя существующие обработчики истории и документов. Прямое изменение представления по-прежнему запрещено.

Выбранные строки одной поставки учитываются один раз. Удаление поставки действует на все её связи с рейсами. Если нет права удалить опустевший рейс, вся операция отклоняется. Строка без поставки не является целью этой кнопки.

## База данных

Новые бизнес-таблицы, колонки, индексы и связи не создавались. Миграция `20261029120000-complete-logistics-workspace-actions` обновляет только метаданные интерфейса и подписи полей. Миграция применена успешно. Рабочие рейсы и поставки при проверках не удалялись.

Для проверки PostgreSQL создана отдельная пустая база `lc_ws_validation_20261029_103`, после проверки она удалена.

## Проверки

Команды запускались из корня репозитория:

```bash
corepack yarn eslint --fix <изменённые файлы TypeScript>
corepack yarn typecheck:log-company:server
corepack yarn typecheck:log-company:client
corepack yarn test:architecture
corepack yarn test:server packages/plugins/@log-company/plugin-process-governance --run --maxWorkers=1 --minWorkers=1
corepack yarn test:client packages/plugins/@log-company/plugin-process-governance --run --maxWorkers=1 --minWorkers=1
corepack yarn build @log-company/plugin-process-governance
corepack yarn tar @log-company/plugin-process-governance
docker compose exec -T app yarn pm update /app/nocobase/storage/tar/@log-company/plugin-process-governance-2.0.103.tgz
docker compose exec -T app yarn nocobase upgrade
docker compose restart app
git diff --check -- packages/plugins/@log-company/plugin-process-governance docs/log-company/PROCESS_GOVERNANCE_PLUGIN.md
```

Результаты окончательных запусков:

- ESLint с исправлением форматирования — успешно.
- Проверка типов клиента и сервера — по 0 ошибок.
- Архитектурные проверки — 24 теста успешно.
- Сервер — 137 тестов в 42 файлах успешно.
- Клиент — 60 тестов в 14 файлах успешно.
- Сборка и упаковка — успешно.
- Установка 2.0.103, миграция и запуск — успешно, в логе есть `app has been started`.
- `git diff --check` — успешно.

Дополнительные проверки через Node.js внутри контейнера:

- Изолированный PostgreSQL: отказ прав, откат после ошибки обработчика, поставка в нескольких рейсах, удаление только опустевших рейсов, повторные строки и повторное удаление — успешно.
- Чтение рабочей базы: 9 колонок без прежних действий строки, 2 формы создания исходных коллекций, 2 вкладки общего popup, блоки документов и обсуждения — успешно.
- Чтение и поиск с разрешениями `root`, `manager`, `declarant`, `financier` — успешно, для каждой роли доступны 6 существующих строк с соответствующим набором полей.
- Поиск по русской подписи статуса на текущих данных — успешно.
- HTTP `app:getInfo` — 200; удаление без авторизации — 401.

## Неустранённые ограничения

Визуальная проверка и ручное нажатие кнопок в браузере не выполнялись по указанию пользователя. Проверены код, исполняемые модели, транзакции, сохранённые метаданные, поиск, доступность HTTP и запуск приложения.
