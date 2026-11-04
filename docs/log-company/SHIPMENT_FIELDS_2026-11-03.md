# Поля поставки: обновление 2.0.114

## Выполнено

- Из подписей полей и колонок убрано «НТМ», включая подписи в формах, истории и сообщениях проверки чисел. Вкладка и категория «НТМ» сохранены.
- «Номер доставки», «Дата выпуска декларации» и «Дата выпуска заявления» убраны из создания, редактирования, таблиц, выбора колонок и доступных фильтров.
- Существующие модели форм и колонок обновлены миграцией. Ссылки на удалённые элементы очищены из раскладки, поиска, сортировки, персональных колонок и сохранённых шаблонов.
- Остальные поля сохраняют UID, обязательность, настройки и порядок. При удалении ячейки раскладки сохраняется соответствие размеров оставшимся ячейкам.
- Сохранение через прежний интерфейс больше не отправляет значения трёх скрытых полей и не очищает архивные значения.

## Изменённые файлы

Базовый путь исходников: `packages/plugins/@log-company/plugin-process-governance/`.

| Файл относительно базового пути | Изменение |
| --- | --- |
| `package.json` | Версия 2.0.114 для штатной установки. |
| `src/server/collections/logisticsCollectionFields.ts` | Штатное скрытие архивного поля без удаления столбца. |
| `src/server/collections/shipments.ts` | Скрыты три поля, изменены шесть подписей. |
| `src/server/collections/logisticsWorkItems.ts` | Такие же изменения в проекции рабочего списка. |
| `src/server/infrastructure/metadata/LogisticsWorkspaceNativeModels.ts` | Три поля исключены из новых форм. |
| `src/server/infrastructure/metadata/InstallWorkspacePresentation.ts` | Новые заголовки колонок и применение изменения при новой установке. |
| `src/server/infrastructure/metadata/WorkspaceAssociatedShipmentsTree.ts` | Новые подписи во вкладке поставок рейса и селекторе. |
| `src/server/infrastructure/metadata/SimplifyShipmentFields.ts` | Транзакционное обновление существующих полей, моделей, раскладки и сохранённых видов. |
| `src/server/infrastructure/metadata/__tests__/SimplifyShipmentFields.test.ts` | Три регрессионных теста, настоящий FlowModelRepository. |
| `src/server/migrations/20261103030000-simplify-shipment-fields.ts` | Новая afterLoad-миграция. |
| `src/server/application/logistics/NormalizeShipmentNumericFields.ts` | Подпись суммы без «НТМ» в сообщениях валидации. |
| `src/client/pages/logistics/ui/ShipmentFormModal.tsx` | Старые формы: три поля исключены, подписи обновлены. |
| `src/client/pages/logistics/ui/LogisticsWorkspaceTable.tsx` | Старый рабочий список: исключены колонки, обновлены подписи. |
| `src/client/pages/logistics/ui/RunShipmentsPanel.tsx` | Исключён номер доставки. |
| `src/client/pages/logistics/ui/HistoryTable.tsx` | Подписи без «НТМ»; старые события по архивным полям остаются читаемыми. |
| `src/client/pages/logistics/model/workspace.ts` | Номер доставки исключён из текстового поиска старого списка. |
| `src/client/pages/logistics/api/LogisticsService.ts` | Архивные поля исключены из активной выборки и отправляемых значений. Существующие типы ответа совместимы с прежними данными. |
| `src/client/pages/logistics/api/__tests__/LogisticsService.test.ts` | Проверка, что сохранение не отправляет архивные поля. |

Документация: этот отчёт, `docs/log-company/WORKSPACE_GROUPED_INTERFACE.md`, `docs/log-company/PROCESS_GOVERNANCE_PLUGIN.md`. Граф кода обновлён командой `graphify update .`.

## Архитектурные решения

Используется штатное `hidden: true` и `uiSchema['x-hidden']`. Существующий механизм персонализации уже исключает такие поля из каталога колонок и фильтров; отдельная реализация скрытия не добавлялась. Новая миграция удаляет только привязанные к архивным полям узлы через штатный FlowModelRepository, сохраняя остальные UID и настройки. Категория «НТМ» не переименовывается. Настройки других коллекций и внешних источников не затрагиваются.

Ранее применённые миграции не изменены. Повторный запуск новой миграции не меняет результат и повторно не увеличивает ревизии шаблонов.

## База данных

Новые таблицы, физические столбцы, индексы и связи не создаются и не удаляются. SQL-проекция сохраняет совместимую структуру. Существующие значения трёх архивных полей сохранены; скрытие применяется к метаданным двух коллекций (`shipments`, `logistics_work_items`). Миграция обновляет метаданные форм и сохранённые виды, а не бизнес-записи.

## Проверки

Выполнены:

- `corepack yarn test:client packages/plugins/@log-company/plugin-process-governance/src/client --run --maxWorkers=1 --minWorkers=1` — 25 файлов, 118 тестов, успешно.
- `corepack yarn test:server packages/plugins/@log-company/plugin-process-governance/src/server --run --maxWorkers=1 --minWorkers=1` — 43 файла, 163 теста, успешно.
- После уточнения обработки размеров и внешних источников повторно выполнен `test:server .../SimplifyShipmentFields.test.ts --run --maxWorkers=1 --minWorkers=1` — 3 теста, успешно.
- `corepack yarn test:architecture` — 24 теста, успешно.
- `node scripts/check-log-company-types.cjs client` и `... server` — 0 ошибок.
- `corepack yarn eslint --fix` на всех изменённых TypeScript/TSX-файлах — успешно.
- `corepack yarn prettier --write` для нового обработчика, теста миграции, теста сервиса и формы поставки — успешно. Совместимый с установленным форматтером синтаксис импорта типов не меняет исполнение.
- `corepack yarn build @log-company/plugin-process-governance --no-dts` и `corepack yarn tar @log-company/plugin-process-governance` — успешно.
- `docker compose exec -T app yarn pm update /app/nocobase/storage/tar/@log-company/plugin-process-governance-2.0.114.tgz` — успешно.
- `docker compose exec -T app yarn nocobase upgrade` — новая миграция выполнена успешно.
- `docker compose restart app` — приложение запущено с новой версией.

Проверка установленной системы после перезапуска, только на чтение:

- Установлена версия 2.0.114.
- SHA-256 клиентского файла, реально полученного по HTTP с localhost, совпадает с исходной сборкой: `435d911256eccec9d0295c2cb88ecd4d5bbc151a62319afb26fcdd1ee9e1eb75`.
- Контрольная сумма сохранённых значений архивных полей совпадает со снимком до установки, 12 поставок.
- Контрольная сумма моделей остальных полей создания не изменилась; осталось 28 активных полей.
- Все шесть определений архивных полей (по три в каждой коллекции) скрыты.
- Среди настроенных полей обеих коллекций отсутствуют привязки трёх архивных полей; подписи `ntm_*` не содержат «НТМ».
- Категория «НТМ» в общей форме создания сохранена.
- SQL-проекция доступна, содержит 15 строк.
- Анонимный API-запрос по-прежнему возвращает 401.

## Неустранённые ограничения

Визуальная проверка не проводилась по указанию пользователя. Авторизованные действия в браузере в этом обновлении не проверялись. Автоматическая проверка безопасности отклонила создание тестовой root-сессии через JWT-секрет; этот способ не использовался. Проверки localhost выполнены SQL-запросами только на чтение, получением статической сборки по HTTP и анонимным API-запросом.
