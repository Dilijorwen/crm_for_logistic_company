# Несколько китайских клиентов в поставке — 2.0.123

## Выполнено

В одной поставке можно выбрать одного или нескольких китайских клиентов. Обновлены формы создания и
редактирования, общий список, поставки рейса, правая панель, поиск, фильтрация и история изменений.
Версия 2.0.123 установлена на localhost штатным обновлением NocoBase.

## Изменённые файлы

Пути ниже относительно `packages/plugins/@log-company/plugin-process-governance/`, кроме документации.

| Файл | Назначение |
| --- | --- |
| `package.json` | Версия 2.0.123. |
| `src/client/pages/logistics/model/types.ts` | Массив клиентов в записи и параметрах сохранения. |
| `src/client/pages/logistics/api/LogisticsService.ts` | Чтение и сохранение нескольких идентификаторов. |
| `src/client/pages/logistics/ui/ShipmentFormModal.tsx` | Множественный выбор с обязательным минимумом в одного клиента. |
| `src/client/pages/logistics/ui/LogisticsWorkspaceTable.tsx` | Все клиенты в общем списке. |
| `src/client/pages/logistics/ui/RunShipmentsPanel.tsx` | Все клиенты в списке поставок рейса. |
| `src/client/pages/logistics/model/workspace.ts` | Поиск по всем клиентам поставки. |
| `src/client/pages/logistics/ui/HistoryTable.tsx` | Подпись поля в истории. |
| `src/client/widgets/workspace-table/api/WorkspaceSummaryApi.ts` | Все клиенты в правой панели. |
| `src/client/pages/logistics/api/__tests__/LogisticsService.test.ts` | Проверка чтения и сохранения нескольких клиентов. |
| `src/client/pages/logistics/model/__tests__/workspace.test.ts` | Актуальная модель записи в проверках поиска. |
| `src/server/domain/logistics/ShipmentChineseClients.ts` | Проверка непустого набора идентификаторов. |
| `src/server/domain/logistics/LogisticsError.ts` | Тип ошибки некорректного выбора клиентов. |
| `src/server/application/logistics/SynchronizeShipmentChineseClients.ts` | Проверка сохранённых связей и совместимость с прежним одиночным клиентом. |
| `src/server/application/logistics/RecordLogisticsRelationChange.ts` | История добавления и удаления клиента. |
| `src/server/infrastructure/persistence/nocobase/NocoBaseShipmentChineseClientsRepository.ts` | Адаптер связей NocoBase и синхронизация прежнего внешнего ключа. |
| `src/server/infrastructure/metadata/LogisticsAssociationFields.ts` | Прямая и обратная связи многие-ко-многим. |
| `src/server/infrastructure/read-model/LogisticsWorkspaceViewSql.ts` | Агрегация имён без размножения строк. |
| `src/server/collections/shipmentChineseClients.ts` | Скрытая коллекция связей. |
| `src/server/collections/logisticsWorkItems.ts` | Подпись «Китайские клиенты». |
| `src/server/composition/LogisticsModule.ts` | Подключение сервиса, адаптера и обработчиков сохранения. |
| `src/server/interfaces/hooks/ShipmentChineseClientHooks.ts` | Валидация и синхронизация при сохранении. |
| `src/server/interfaces/hooks/LogisticsHooks.ts` | Отслеживание изменений связей. |
| `src/server/interfaces/http/LogisticsPreActions.ts` | Нормализация входного массива клиентов. |
| `src/server/interfaces/http/LogisticsWorkspaceActions.ts` | Фильтрация по связи с любым клиентом. |
| `src/server/migrations/20261111010000-multiple-shipment-chinese-clients.ts` | Перенос связей, обновление метаданных, форм и представления. |
| `src/server/collections/__tests__/logisticsCollections.test.ts` | Проверка обратной связи. |
| `src/server/interfaces/hooks/__tests__/LogisticsHistory.integration.test.ts` | Сохранение, удаление, история и откат при неизвестном клиенте. |
| `src/server/interfaces/http/__tests__/LogisticsPreActions.test.ts` | Входные значения, несколько клиентов и прежний формат. |
| `src/server/interfaces/http/__tests__/LogisticsWorkspaceActions.test.ts` | Фильтрация по любому клиенту. |
| `src/server/migrations/__tests__/20260923090000-register-logistics-reverse-associations-and-timestamps.test.ts` | Соответствие обратной связи текущей модели. |
| `src/server/migrations/__tests__/20261111010000-multiple-shipment-chinese-clients.test.ts` | Миграция PostgreSQL и повторный запуск. |
| `docs/log-company/PROCESS_GOVERNANCE_PLUGIN.md` | Описание модели и совместимости. |
| `docs/log-company/SHIPMENT_MULTIPLE_CLIENTS_2026-11-11.md` | Отчёт о реализации и проверках. |

## Архитектурные решения

Сохранён путь поля `chinese_client`: существующие настройки и разрешения используют прежний ключ.
Связь переведена на штатный `belongsToMany` NocoBase. Обновлены и свойства сохранённых селекторов,
и настройка `selectSettings.allowMultiple`, чтобы прежнее значение `false` не отменяло множественный выбор.

Полный состав клиентов хранится в таблице связей. Старый `chinese_client_id` содержит одного из выбранных
клиентов для совместимости с одиночными запросами. Результат сохранения проверяется в той же транзакции:
неизвестный клиент не приводит к частичному изменению состава.

Представление объединяет имена в одну строку. Фильтр обращается к самой связи, поэтому точный поиск
по одному клиенту находит поставку с несколькими клиентами, без дублирования сумм и строк.

## База данных

Миграция `20261111010000-multiple-shipment-chinese-clients` выполнена и зарегистрирована на localhost.

- Новая таблица `shipment_chinese_clients`: `id`, `shipment_id`, `chinese_client_id`.
- Уникальный индекс по паре поставка–клиент и индекс по клиенту.
- Внешние ключи: удаление поставки удаляет её связи; удаление используемого клиента ограничено.
- Обратная связь `chinese_clients.shipments` переведена на многие-ко-многим.
- Представление `logistics_work_items` пересоздаётся атомарно для агрегации имён.
- Контрольные суммы строк `shipments` и девяти таблиц ролей/разрешений до и после обновления совпали.
- Число строк представления сохранилось. Прежние клиенты перенесены; ключи полей и UID моделей сохранены.
- В четырёх существующих формах подтверждено включение множественного выбора.

## Проверки

Команды выполнялись из корня проекта через `corepack yarn`.

| Команда или проверка | Результат |
| --- | --- |
| `DB_DIALECT=sqlite DB_STORAGE=:memory: yarn test:server packages/plugins/@log-company/plugin-process-governance/src/server --run --maxWorkers=1 --minWorkers=1 --silent` | 176 пройдено; 3 проверки PostgreSQL пропущены в SQLite. |
| `yarn test:client packages/plugins/@log-company/plugin-process-governance/src/client --run --maxWorkers=1 --minWorkers=1 --silent` | 123 пройдено. |
| `yarn vitest run --config packages/plugins/@log-company/vitest.config.ts 20261111010000-multiple-shipment-chinese-clients --maxWorkers=1 --minWorkers=1 --silent` с отдельной PostgreSQL 16 | Миграционный тест пройден: повторное выполнение, несколько клиентов, уникальность и внешние ключи. |
| `yarn vitest run --config packages/plugins/@log-company/vitest.config.ts __tests__/ArchitectureBoundaries.test.ts __tests__/ArchitectureRules.test.ts __tests__/OnionBoundaries.test.ts --maxWorkers=1 --minWorkers=1` | 24 пройдено. |
| `yarn node scripts/check-log-company-types.cjs client` и `server` | По 0 ошибок типов. |
| `yarn tsc --noEmit -p packages/plugins/@log-company/tsconfig.domain.json` | Успешно. |
| `yarn eslint --fix --no-ignore` для изменённых TS/TSX и форматирование Prettier | Успешно. |
| `PLUGIN_PACKAGE_PREFIX=@nocobase/plugin-,@nocobase/preset-,@nocobase/plugin-pro-,@log-company/plugin- yarn build @log-company/plugin-process-governance` | Полная сборка, включая декларации, успешна. |
| `yarn tar @log-company/plugin-process-governance` | Архив 2.0.123 создан, новые серверные файлы и миграция присутствуют. |
| `docker compose exec -T app yarn pm update /app/nocobase/storage/tar/@log-company/plugin-process-governance-2.0.123.tgz` | Установлено. |
| `docker compose exec -T app yarn nocobase upgrade --skip-code-update` | Миграция выполнена; ошибок в журнале нет. |
| `docker compose restart app` | CRM запущена; ошибок запуска в журнале нет. |
| HTTP-проверка страницы и клиентского JS | Страница HTTP 200; SHA-256 отданного JS совпал со сборкой: `025be2e98eba7c0bf5e5c22365f2c7607552abfa68144a59f8153eff45c54940`. |
| `git diff --check` | Успешно. |
| `graphify update .` | Граф обновлён. |

Тестовая PostgreSQL остановлена. Тестовые бизнес-записи в рабочую базу не добавлялись.

## Неустранённые ограничения

Визуальная проверка и ручное прохождение браузерного сценария не выполнялись по указанию пользователя.
Проверены код, автоматизированные сценарии, миграция, сохранённые формы, данные и установленная сборка.
