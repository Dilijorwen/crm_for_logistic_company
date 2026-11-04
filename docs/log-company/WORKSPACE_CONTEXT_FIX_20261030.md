# Исправление контекстов рабочего списка — 2.0.106, 30.10.2026

## Выполнено

- Устранена рекурсия `Maximum call stack size exceeded` при открытии вкладки «Поставки».
- Редактор поставки использует отдельный `FlowContext`. Контекст родительского движка и его `view` не изменяются.
- Общий popup сохраняет своего родителя. Открытие из вложенной таблицы не создаёт цикл между popup и его потомком.
- Повторное открытие общего popup выполняется без debounce и кеша события целевого popup. Обычные пользовательские события поля и штатное содержимое popup сохранены.
- Исправлено размещение обязательного выбора типа перевозки в сохранённых формах создания и редактирования рейса, включая раскладки Grid v2 и старый формат `rows`.
- С главной панели удаляется кнопка «Обновить». Автоматическое обновление после сохранения сохранено.

## Причины

В NocoBase 2.0.60 доступ через прокси `createBlockScopedEngine(...).context` может возвращать родительский контекст. Добавление туда контекста блока создаёт цепочку `engine.context → host.context → engine.context`. Поиск отсутствующего свойства бесконечно обходит делегатов. Замена `view` через тот же объект также изменяла контекст рабочего списка.

Отдельный сценарий: штатный `ctx.openView` назначает открываемому popup родителем поле, из которого его открыли. Общая карточка содержит свою таблицу поставок, поэтому при открытии из её поля popup становился собственным предком. Для нашего общего UID открытие направлено в штатный popup без изменения родителя; остальные popup используют обычный метод NocoBase.

Поле `transport_type` и права на него присутствовали в базе. Однако добавленного элемента формы недостаточно для существующей явно заданной раскладки: необходимо также включить его UID в `layout.rows[].cells[].items` либо в старый `rows`. Исправление использует настоящее дерево `flowModelTreePath`, поскольку вложенные узлы не всегда содержат `options.parentId`.

## Изменённые файлы

Пути относительно корня проекта:

| Файл | Изменение |
| --- | --- |
| `packages/plugins/@log-company/plugin-process-governance/package.json` | Версия 2.0.106. |
| `packages/plugins/@log-company/plugin-process-governance/src/client/widgets/workspace-shipments/ui/ScopedShipmentEditor.tsx` | Отдельный контекст, отсутствие изменений общего engine.context, корректный React provider. |
| `packages/plugins/@log-company/plugin-process-governance/src/client/widgets/workspace-shipments/ui/__tests__/ScopedShipmentEditor.test.tsx` | Рендер редактора, переключение номеров, закрытие, возврат к рабочему списку и повторное открытие. |
| `packages/plugins/@log-company/plugin-process-governance/src/client/widgets/workspace-context/ui/__tests__/WorkspaceContextModels.test.ts` | Исправлена изоляция контекстов в прежнем тесте. |
| `packages/plugins/@log-company/plugin-process-governance/src/client/features/workspace-actions/model/WorkspaceActionModels.tsx` | Безопасное открытие общей карточки без перепривязки родителя и задержки целевого события. |
| `packages/plugins/@log-company/plugin-process-governance/src/client/features/workspace-actions/model/__tests__/WorkspacePopupLifecycle.test.ts` | Реальные клики и исполнение popup, повторное открытие, открытие из собственного потомка. |
| `packages/plugins/@log-company/plugin-process-governance/src/server/infrastructure/metadata/EnsureTransportTypeForms.ts` | Обязательный Select и его размещение в сохранённых формах без потери существующих строк. |
| `packages/plugins/@log-company/plugin-process-governance/src/server/infrastructure/metadata/UpgradeLogisticsWorkspace.ts` | Инициализация форм без кнопки обновления и с корректным размещением типа. |
| `packages/plugins/@log-company/plugin-process-governance/src/server/infrastructure/metadata/__tests__/LogisticsWorkspacePage.test.ts` | Настоящий FlowModelRepository: обе раскладки, повторная миграция, удаление только нужного действия. |
| `packages/plugins/@log-company/plugin-process-governance/src/server/migrations/20261030003000-repair-workspace-popup-and-forms.ts` | Транзакционное исправление сохранённой конфигурации и удаление lcwsrefresh. |
| `docs/log-company/WORKSPACE_CONTEXT_FIX_20261030.md` | Причины, изменения и результаты проверки. |

## Архитектурные решения

Изоляция экземпляров моделей через штатный scoped engine сохранена. Контекст выбранной записи передаётся отдельным делегатом и через `FlowViewContextProvider`; родительский engine.context остаётся общим неизменяемым источником служб.

Исключение из штатного переподчинения popup ограничено UID общей карточки `lcwsrecordpopup`. Штатная настройка действий и содержимого карточки остаётся доступной.

## База данных

Новых таблиц, колонок, индексов и связей нет. Миграция изменяет только конфигурацию FlowModels: выбор типа перевозки в формах и кнопку обновления. Рейсы, поставки, документы, обсуждения, история и их связи не изменяются. Миграция выполняется транзакционно и повторно без дублирования полей или строк.

## Проверки

До исправления компонентный тест воспроизвёл ту же ошибку рекурсии, что в приложенном пользователем стеке. Отдельный тест воспроизвёл цикл при открытии общей карточки из собственного потомка.

Команды итоговой проверки:

```sh
corepack yarn eslint --fix <затронутые TS/TSX файлы>
corepack yarn test:server packages/plugins/@log-company/plugin-process-governance --run --maxWorkers=1 --minWorkers=1
corepack yarn test:client packages/plugins/@log-company/plugin-process-governance --run --maxWorkers=1 --minWorkers=1
corepack yarn typecheck:log-company:server
corepack yarn typecheck:log-company:client
corepack yarn test:architecture
corepack yarn build @log-company/plugin-process-governance
```

Результаты: ESLint без ошибок и предупреждений, типы клиента и сервера без ошибок, 148 серверных тестов, 80 клиентских тестов, 24 архитектурных теста. Сборка выполнена успешно. `corepack yarn tar @log-company/plugin-process-governance` создала архив 2.0.106.

До установки новая функция выполнена на PostgreSQL с настоящим FlowModelRepository в откатываемой транзакции. Во всех трёх сохранённых формах рейса подтверждены наличие поля, обязательность, SelectFieldModel и участие поля в реальной раскладке. Повторный запуск не создаёт дубликатов; изменения проверки откатились.

## Установка

Выполнены штатные команды:

```sh
docker compose exec -T app yarn pm update /app/nocobase/storage/tar/@log-company/plugin-process-governance-2.0.106.tgz
docker compose exec -T app yarn nocobase upgrade
docker compose restart app
```

Версия 2.0.106 установлена, миграция `20261030003000-repair-workspace-popup-and-forms` применена успешно. Приложение отвечает HTTP 200.

Независимая проверка чтения опубликованной конфигурации подтвердила: три формы содержат обязательный Select типа, он включён в их раскладки; `lcwsrefresh` отсутствует. После обновления сохранены 5 рейсов, 10 поставок и 8 связей.

Для загрузки нового JavaScript и сброса уже повреждённого контекста требуется один раз перезагрузить открытую вкладку браузера обычной кнопкой перезагрузки.

## Ограничения

Визуальная проверка не выполняется по указанию пользователя. Проверки интерфейса выполняются автоматическими компонентными тестами в jsdom без управления браузером.
