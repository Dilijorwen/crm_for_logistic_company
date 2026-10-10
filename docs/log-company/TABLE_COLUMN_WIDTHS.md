# Персональная ширина колонок — 2.0.67

## Исследование

Проверяемая CRM работает на NocoBase 2.0.60 с FlowEngine. Штатная ширина задаётся через меню
`tableColumnSettings.width` (`TableColumnModel`, `TableCustomColumnModel`) или
`subTableColumnSettings.width` (`SubTableColumnModel`): select 50–500 px и `CustomWidth` с InputNumber.
Обработчик устанавливает `model.props.width`, а `DefaultSettingsIcon` сохраняет `stepParams` через
`saveStepParams()`. Это общая конфигурация `flowModels`, поэтому она действует для всех пользователей.

Конкретные исходники:

- `packages/core/client/src/flow/models/blocks/table/TableColumnModel.tsx`: `CustomWidth`,
  `getColumnProps`, flow `tableColumnSettings`, step `width`; штатный заголовок и ячейка учитывают width − 16 px.
- `packages/core/client/src/flow/models/blocks/table/TableCustomColumnModel.tsx`: общий flow ширины для действий и JS.
- `packages/core/client/src/flow/models/fields/AssociationFieldModel/SubTableFieldModel/SubTableColumnModel.tsx`:
  `getColumnProps`, flow `subTableColumnSettings`; editable-ячейка использует полную ширину.
- `packages/core/flow-engine/src/components/DefaultSettingsIcon.tsx`: сохранение выбранного значения меню.
- `packages/core/flow-engine/src/models/flowModel.tsx`: `saveStepParams`, `createFork`.
- `packages/core/flow-engine/src/models/forkFlowModel.ts`: локальные props поверх master-модели.

Штатного перетаскивания границы таблицы в этой версии не обнаружено. `ResizeHandles` в
`FlowsFloatContextMenu` используется сеткой `GridModel`; таблицы не обрабатывают эти события.
Пользователь отдельно подтвердил добавление перетаскивания. Оно использует штатные модели,
их расчёт ширины заголовков/ячеек и исходные render/onCell. Меню конструктора сохраняет общие значения по умолчанию.

## Охват

Read-only инвентаризация действующей БД перед обновлением: 10 `TableBlockModel`, 38 `TableColumnModel`;
legacy `TableV2` / `Table.*` в `uiSchemas` не обнаружены. Таблицы коллекций в страницах,
карточках, popup и связанные таблицы представлены `TableBlockModel`; resource/sourceId остаются штатными.

| Модель таблицы            | Модель колонки                                           | Привязка / проверка                                                   |
| ------------------------- | -------------------------------------------------------- | --------------------------------------------------------------------- |
| TableBlockModel           | TableColumnModel, TableActionsColumnModel, JSColumnModel | resourceSettings.init; весь текущий CRM                               |
| TableSelectModel          | Те же                                                    | Штатная таблица выбора; настройки выбора строк не меняются            |
| SubTableFieldModel        | SubTableColumnModel                                      | fieldSettings.init таблицы или родительского поля; цепочка ассоциаций |
| DisplaySubTableFieldModel | TableColumnModel                                         | Штатная таблица отображения связи                                     |
| PopupSubTableFieldModel   | TableColumnModel, PopupSubTableActionsColumnModel        | subTableColumns и цепочка ассоциаций                                  |

Все пять моделей используют один декоратор колонки. Статические Ant Design Table в собственных плагинах
не имеют штатной настройки ширины и не расширялись отдельным поведением. Legacy runtime не используется
в действующей CRM; персональная ширина реализована для перечисленных моделей FlowEngine.

## Реализация

Существующая `lc_table_personalizations` расширена необязательным JSON-параметром:

```json
{
  "version": 1,
  "columnOrder": ["column-one", "column-two"],
  "hiddenColumnUids": ["column-two"],
  "columnWidths": { "column-one": 250 }
}
```

Ключ владельца — currentUser + проверенный instanceKey (UID таблицы и путь ссылок на шаблоны).
Привязка не зависит от сессии или строки данных, поэтому новый вход получает те же настройки.
Старые записи без `columnWidths` используют актуальную общую ширину. Персональное значение имеет приоритет,
новые поля используют общую ширину, удалённые UID отфильтровываются; временно закрытые ACL значения остаются
непрозрачными в хранении. Все прежние индексы и каскадные связи сохранены; новой DDL-миграции нет.

`tablePersonalizations:width` принимает только identity, columnUid, width, schemaSignature. Width — целое
число 50–3000 либо null для возврата общей ширины. Владелец определяется сервером, UID проверяется по
сохранённому дереву/полям и текущим правам чтения маршрута и коллекции; разрешение UI-конструктора не требуется.
API не читает бизнес-записи и не меняет Data Scope. Общие настройки FlowEngine не сохраняются.

`NocoBasePersonalizationRepository.update` создаёт запись с учётом уникального ключа, затем блокирует её
`SELECT FOR UPDATE` и применяет функцию изменения к актуальному JSON в одной транзакции. Изменение одной
колонки сохраняет остальные ширины и порядок/видимость. Сохранение layout не отправляет старую карту ширин
из открытого диалога. На клиенте очередь ширины и версия preview защищают быстрые последовательные изменения.

`columnWidthBinding.tsx` регистрирует наследников штатных классов, сохраняя имя, metadata, flows, UID,
подмодели, действия и исходные методы. Штатный `getColumnProps` исполняется на локальном незарегистрированном
FlowEngine fork с персональным props.width; master props/stepParams не изменяются и сериализация остаётся прежней.
Runtime-поля коллекции используют тот же стабильный логический UID, что и существующий каталог персонализации.

`ColumnWidthHeader.tsx` добавляет доступный separator у правой границы. Mousemove меняет только локальный preview;
mouseup делает один запрос. Escape отменяет, unmount/смена владельца удаляют обработчики и возвращают body cursor.
Стрелки, Shift, Home/End и двойной клик доступны с клавиатуры. Ошибка API откатывает preview и показывает штатное
уведомление; повторное изменение доступно. При обычном сохранении ширины ресурс не обновляется и колонки не пересоздаются.

Портал границы в штатную `th` размещает область захвата у фактического края ячейки, включая свободное место,
распределённое Ant Design Table. Используется уже установленный ReactDOM; добавлен только peer-контракт
`react-dom: 18.2.0`, проверенный в workspace. Новая библиотека не устанавливалась, lockfile не менялся.

## Изменённые файлы

Все перечисленные исходники расположены в существующем плагине; установленная копия обновлена менеджером пакетов.

| Файл                                                                                                                                                                                                                  | Назначение                                                                  |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| [package.json](/Users/daniil/log_company/packages/plugins/@log-company/plugin-table-personalization/package.json)                                                                                                     | Версия 2.0.67, описание ширины и peer-контракт существующего ReactDOM       |
| [shared/contracts.ts](/Users/daniil/log_company/packages/plugins/@log-company/plugin-table-personalization/src/shared/contracts.ts)                                                                                   | Необязательная карта ширин, границы и поддерживаемые модели                 |
| [ColumnPreferences.ts](/Users/daniil/log_company/packages/plugins/@log-company/plugin-table-personalization/src/server/domain/ColumnPreferences.ts)                                                                   | Проверка ширины, UID, совместимость JSON и сохранение непрозрачных настроек |
| [ports.ts](/Users/daniil/log_company/packages/plugins/@log-company/plugin-table-personalization/src/server/application/ports.ts)                                                                                      | Порт атомарного изменения и разрешённые UID ширины                          |
| [TablePersonalizations.ts](/Users/daniil/log_company/packages/plugins/@log-company/plugin-table-personalization/src/server/application/TablePersonalizations.ts)                                                      | Use case изменения одной колонки и сохранение остальных параметров          |
| [NocoBasePersonalizationRepository.ts](/Users/daniil/log_company/packages/plugins/@log-company/plugin-table-personalization/src/server/infrastructure/NocoBasePersonalizationRepository.ts)                           | Транзакция и блокировка строки владельца                                    |
| [NocoBaseTableConfiguration.ts](/Users/daniil/log_company/packages/plugins/@log-company/plugin-table-personalization/src/server/infrastructure/NocoBaseTableConfiguration.ts)                                         | Поддержка пяти таблиц, цепочки ассоциаций, права и служебные колонки        |
| [TablePersonalizationController.ts](/Users/daniil/log_company/packages/plugins/@log-company/plugin-table-personalization/src/server/interfaces/TablePersonalizationController.ts)                                     | Отдельное POST-действие width с закрытым контрактом                         |
| [client/plugin.ts](/Users/daniil/log_company/packages/plugins/@log-company/plugin-table-personalization/src/client/plugin.ts)                                                                                         | Регистрация и восстановление штатных классов колонок                        |
| [TablePersonalizationApi.ts](/Users/daniil/log_company/packages/plugins/@log-company/plugin-table-personalization/src/client/features/table-personalization/api/TablePersonalizationApi.ts)                           | Width-запрос, исключение устаревших ширин из layout save                    |
| [columnLayout.ts](/Users/daniil/log_company/packages/plugins/@log-company/plugin-table-personalization/src/client/features/table-personalization/lib/columnLayout.ts)                                                 | Сохранение карты ширин в черновике существующего окна                       |
| [PersonalizationController.ts](/Users/daniil/log_company/packages/plugins/@log-company/plugin-table-personalization/src/client/features/table-personalization/model/PersonalizationController.ts)                     | Реактивный preview, очередь, откат, конфликт и смена владельца              |
| [PersonalCollectionColumns.ts](/Users/daniil/log_company/packages/plugins/@log-company/plugin-table-personalization/src/client/features/table-personalization/model/PersonalCollectionColumns.ts)                     | Привязка runtime-полей к стабильному UID ширины                             |
| [columnWidthBinding.tsx](/Users/daniil/log_company/packages/plugins/@log-company/plugin-table-personalization/src/client/features/table-personalization/model/columnWidthBinding.tsx)                                 | Общий декоратор и локальное применение через native fork                    |
| [ColumnWidthHeader.tsx](/Users/daniil/log_company/packages/plugins/@log-company/plugin-table-personalization/src/client/features/table-personalization/ui/ColumnWidthHeader.tsx)                                      | Перетаскивание, клавиатура, отмена, сброс и очистка обработчиков            |
| [ColumnPreferences.test.ts](/Users/daniil/log_company/packages/plugins/@log-company/plugin-table-personalization/src/server/domain/__tests__/ColumnPreferences.test.ts)                                               | Невалидные значения, границы и старые настройки                             |
| [TablePersonalizations.test.ts](/Users/daniil/log_company/packages/plugins/@log-company/plugin-table-personalization/src/server/application/__tests__/TablePersonalizations.test.ts)                                  | Независимость параметров, права, повторные операции и ошибки                |
| [TablePersonalizationController.test.ts](/Users/daniil/log_company/packages/plugins/@log-company/plugin-table-personalization/src/server/interfaces/__tests__/TablePersonalizationController.test.ts)                 | HTTP width, авторизация и защита входа                                      |
| [PersonalizationsPostgres.integration.test.ts](/Users/daniil/log_company/packages/plugins/@log-company/plugin-table-personalization/src/server/__tests__/PersonalizationsPostgres.integration.test.ts)                | Конкурентные транзакции, пять типов таблиц, ACL, изоляция, каскады          |
| [PersonalizationController.test.ts](/Users/daniil/log_company/packages/plugins/@log-company/plugin-table-personalization/src/client/features/table-personalization/model/__tests__/PersonalizationController.test.ts) | Очередь, preview, откат, конфликт и устаревшие ответы                       |
| [columnWidthBinding.test.tsx](/Users/daniil/log_company/packages/plugins/@log-company/plugin-table-personalization/src/client/features/table-personalization/model/__tests__/columnWidthBinding.test.tsx)             | Native заголовки/ячейки, metadata, UID, реактивность и неизменность модели  |
| [ColumnWidthHeader.test.tsx](/Users/daniil/log_company/packages/plugins/@log-company/plugin-table-personalization/src/client/features/table-personalization/ui/__tests__/ColumnWidthHeader.test.tsx)                  | UI перетаскивания, один запрос, граница th, клавиатура и Escape             |
| [ColumnSettingsButton.test.tsx](/Users/daniil/log_company/packages/plugins/@log-company/plugin-table-personalization/src/client/features/table-personalization/ui/__tests__/ColumnSettingsButton.test.tsx)            | Обновление API-фикстуры и регрессия существующего диалога                   |
| [TablePersonalizationApi.test.ts](/Users/daniil/log_company/packages/plugins/@log-company/plugin-table-personalization/src/client/features/table-personalization/api/__tests__/TablePersonalizationApi.test.ts)       | Контракт отдельного width и защита от устаревшей карты                      |
| [TABLE_PERSONALIZATION_PLUGIN.md](/Users/daniil/log_company/docs/log-company/TABLE_PERSONALIZATION_PLUGIN.md)                                                                                                         | Инструкция для пользователя, API и установка новой версии                   |
| [TABLE_COLUMN_WIDTHS.md](/Users/daniil/log_company/docs/log-company/TABLE_COLUMN_WIDTHS.md)                                                                                                                           | Исследование, решения, изменённые файлы и фактические проверки              |

## Проверки

Фактические команды:

```bash
corepack yarn eslint --fix --no-ignore packages/plugins/@log-company/plugin-table-personalization/src
node --max-old-space-size=8192 packages/plugins/@log-company/plugin-table-personalization/scripts/check-types.cjs
corepack yarn test:client packages/plugins/@log-company/plugin-table-personalization/src/client --run --maxWorkers=1 --minWorkers=1
TABLE_PERSONALIZATION_POSTGRES_INTEGRATION=1 DB_DIALECT=postgres DB_HOST=127.0.0.1 DB_PORT=15432 DB_USER=nocobase DB_DATABASE=table_personalization_test DB_TEST_PREFIX=table_personalization_test corepack yarn vitest run --config /Users/daniil/log_company/packages/plugins/@log-company/vitest.config.ts --root packages/plugins/@log-company plugin-table-personalization plugin-collection-search/src/client/features/collection-search/lib/__tests__/TableIndexedSearchController.test.ts plugin-collection-search/src/server/application/__tests__/SearchCurrentCollection.test.ts --maxWorkers=1 --minWorkers=1
node node_modules/prettier/bin/prettier.cjs --check --ignore-path /dev/null 'packages/plugins/@log-company/plugin-table-personalization/src/**/*.{ts,tsx}' packages/plugins/@log-company/plugin-table-personalization/package.json packages/plugins/@log-company/plugin-table-personalization/scripts/check-types.cjs packages/plugins/@log-company/plugin-table-personalization/tsconfig.json
corepack yarn build @log-company/plugin-table-personalization
corepack yarn tar @log-company/plugin-table-personalization
/usr/local/bin/docker compose exec -T app yarn pm update /app/nocobase/storage/tar/@log-company/plugin-table-personalization-2.0.67.tgz
/usr/local/bin/docker compose restart app
```

- ESLint: код 0. Strict TypeScript: 0 диагностик. Prettier: все файлы соответствуют форматированию.
- Client: **59 тестов**, 8 файлов, все прошли. После уточнения области захвата заголовка отдельно повторены
  4 теста `ColumnWidthHeader.test.tsx`; код 0.
- Node / PostgreSQL / поиск: **113 тестов**, 10 файлов, все прошли; 17 интеграционных тестов выполнены
  на PostgreSQL 16 в отдельном контейнере без томов, затем контейнер остановлен. Серверные тесты последовательны.
  Повторное применение существующей каскадной миграции и удаление пользователя/таблицы/ссылки проверены.
- Сборка и tar: код 0. Менеджер пакетов установил 2.0.67; runtime package и включённый applicationPlugins
  подтверждают 2.0.67. Приложение запущено, `/signin` возвращает HTTP 200.

В авторизованной вкладке проверены:

1. Перетаскивание «Номер рейса» 150 → 230 → 280 px; сохранение после reload.
2. Граница handle совпадает с фактической правой границей th, а нативная ширина ячейки действительно меняется.
3. Поиск `P762MH`: запрос и одна найденная строка сохраняются после drag.
4. Перемещение колонки, скрытие и возврат: ширина 280 сохраняется; окно открывается и закрывается без блокировки страницы.
5. Click-to-open по номеру рейса; вложенная связанная таблица «Китайский клиент» 150 → 200 → 240,
   повторное открытие карточки сохраняет настройку.
6. Добавленное из полного каталога поле «Дата создания»: 150 → 200, reload сохраняет ширину при новом runtime UID.
7. Двойной клик возвращает общую ширину. Штатная форма «Добавить новый рейс» открывается после изменения ширины,
   закрыта без отправки. Записи не создавались и не редактировались.

По журналу приложения было ровно семь ожидаемых операций ширины (drag, клавиатура, два сброса);
все ответили 200. Mousemove не создавал дополнительные width-запросы.
Тестовые ширины, добавленное поле и изменение порядка восстановлены через интерфейс; вложенная тестовая
персонализация удалена штатным сбросом. Исходная запись основной таблицы сохранена: 19 UID, 13 скрытых, пустая карта ширин.

До и после проверок `flowModels`: **580 записей**, MD5 упорядоченных UID и options
**19e8bcb5a68a7ea24101ae4534f009f4**. `transport_runs`: 3 записи.
Персональная ширина не изменила общую конфигурацию и бизнес-записи.

Снимки функциональной проверки:
[обычная таблица](/Users/daniil/.codex/visualizations/2026/10/09/01a11e84-19a8-75c2-87dd-6cc8fa839ee2/table-personal-widths.jpg),
[таблица в карточке](/Users/daniil/.codex/visualizations/2026/10/09/01a11e84-19a8-75c2-87dd-6cc8fa839ee2/table-personal-widths-popup.jpg).

## Ограничения проверки

В браузере использована предоставленная пользователем сессия. Повторный вход другого реального пользователя
вручную не выполнялся; изоляция владельцев, смена пользователя/роли и постоянное хранение проверены
автоматизированно. Для неиспользуемых в действующей БД TableSelect/SubTable/DisplaySubTable/PopupSubTable
выполнены native FlowEngine и PostgreSQL проверки вместо создания новых UI-блоков в общей конфигурации.
