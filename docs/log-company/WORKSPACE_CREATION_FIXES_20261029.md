# Создание и привязка в общем рабочем окне — версия 2.0.104

## Выполнено

- Две кнопки создания объединены в «Добавить» с выбором «Рейс / Поставка». Варианты учитывают права исходных коллекций.
- Явно восстановлены обязательные поля: номер машины, китайский клиент, наша компания и рейс новой поставки.
- При создании поставки доступна вкладка «Документы» с загрузкой в черновик до первого сохранения. Используется существующий механизм прикрепления draft после `shipments:create`.
- Вместо пустого окна выбора под таблицей поставок рейса расположена штатная форма поля «Поставки» с сохранением, как в предоставленном примере.
- Новая поставка из рейса получает этот рейс в начальные значения. После сохранения обновляются и общий список, и открытые списки/формы рейса.
- Popup показывает номер и название редактируемой записи. Формы по умолчанию имеют две колонки. Вложенные вкладки поставки отделены от навигации внешних вкладок.
- Формы используют явные исходные ID и сбрасывают родительскую ассоциацию. Сервер нормализует `runs` до идентификаторов и отвергает неопределённый рейс до обращения к ORM.
- Обновление не отправляет запросы для ещё не открытых вкладок, у которых ресурс пока не получил исходный ID.

## Изменённые файлы

Корень путей к коду: `packages/plugins/@log-company/plugin-process-governance/`.

| Файл | Назначение |
| --- | --- |
| `package.json` | Версия 2.0.104. |
| `src/client/app/plugin.ts` | Регистрация общего действия создания и формы с обновлением связанных блоков. |
| `src/client/shared/lib/workspace-record/index.ts` | Определение явных исходных идентификаторов. |
| `src/client/features/workspace-actions/index.ts` | Экспорт единой кнопки создания. |
| `src/client/features/workspace-actions/model/WorkspaceActionModels.tsx` | Передача исходных ID, текущего рейса, начальных значений и целевой вкладки. |
| `src/client/features/workspace-actions/model/__tests__/WorkspaceActionModels.test.ts` | Проверки создания из текущего рейса и вложенного popup. |
| `src/client/features/workspace-actions/ui/WorkspaceAddActionModel.tsx` | Единая кнопка с выбором типа записи и проверкой ACL. |
| `src/client/features/workspace-actions/ui/__tests__/WorkspaceAddActionModel.test.tsx` | Проверка выбранного типа, выделенных рейсов и сброса старого контекста. |
| `src/client/widgets/workspace-context/ui/WorkspaceContextModels.tsx` | Контекст исходной записи, заголовок, локальная навигация вложенных вкладок и отступы. |
| `src/client/widgets/workspace-context/ui/WorkspaceRecordHeader.tsx` | Загрузка номера и названия редактируемой записи. |
| `src/client/widgets/workspace-context/ui/__tests__/WorkspaceContextModels.test.ts` | Проверка исходных ID, независимости вкладок и фактических запросов сохранения штатного ресурса. |
| `src/client/features/synchronize-shipment-form/index.ts` | Экспорт формы создания. |
| `src/client/features/synchronize-shipment-form/model/WorkspaceCreateFormModel.ts` | Обновление открытого рейса и списка после создания. |
| `src/client/features/synchronize-shipment-form/model/ShipmentSynchronizedEditFormModel.ts` | Обновление соседних блоков при редактировании и пропуск ресурсов без ID. |
| `src/client/features/synchronize-shipment-form/model/__tests__/ShipmentSynchronizedEditFormModel.test.ts` | Проверки обновления в том же popup и отсутствия запросов с неопределёнными ключами. |
| `src/client/features/synchronize-shipment-form/model/__tests__/ShipmentSynchronizedEditFormModel.creation.test.ts` | Проверки обновления после успешного создания и сохранения поведения при ошибке. |
| `src/server/infrastructure/metadata/LogisticsWorkspaceNativeModels.ts` | Объединённое действие, обязательность полей, форма привязки, документы при создании, две колонки и явные ключи. |
| `src/server/infrastructure/metadata/UpgradeLogisticsWorkspace.ts` | Перенос создателей внутрь единой кнопки через штатный `attach` и удаление прежнего селектора. |
| `src/server/infrastructure/metadata/__tests__/LogisticsWorkspacePage.test.ts` | Проверка сохранённого дерева, обязательных полей, формы привязки и документов. |
| `src/server/interfaces/http/LogisticsPreActions.ts` | Нормализация ссылок на рейсы и безопасная ошибка при неопределённой ссылке. |
| `src/server/interfaces/http/__tests__/LogisticsPreActions.test.ts` | Проверки нормализации и отказа до сохранения. |
| `src/server/interfaces/http/__tests__/LogisticsPreActions.integration.test.ts` | Создание с автоматической связью и последующее изменение на настоящих репозиториях. |
| `src/server/migrations/20261029123000-fix-workspace-creation-and-associations.ts` | Новая миграция метаданных окна. |

Документация:

- `docs/log-company/PROCESS_GOVERNANCE_PLUGIN.md` — актуальное поведение создания, привязки и popup.
- `docs/log-company/WORKSPACE_CREATION_FIXES_20261029.md` — этот отчёт.

## Архитектурные решения

Сохранены штатные формы, поля, таблицы и возможности дизайнера NocoBase. Общее действие объединяет два существующих сценария создания, а не создаёт альтернативный API. Форма привязки изменяет поле `transport_runs.shipments` через обычное обновление рейса.

Исходные ID передаются отдельно от составного ключа строки. Формы поставки и рейса используют свои коллекции с явным сбросом родительской ассоциации. Внутренние вкладки не используют активную вкладку внешнего popup. Обновление выполняется после успешного сохранения; ресурсы неактивных вкладок без ключей пропускаются.

Документы остаются собственностью поставки. Для загрузки до сохранения используется существующий механизм черновиков плагина документов. Новое хранилище или отдельный механизм файлов не создавались.

## База данных

Новые бизнес-таблицы, поля, индексы и связи не добавлялись. Новая миграция `20261029123000-fix-workspace-creation-and-associations` изменяет метаданные интерфейса. Ранее применённые файлы миграций не редактировались. Правило удаления поставки и опустевшего рейса сохранено.

## Проверки

Выполнены ESLint, проверки типов клиента и сервера, архитектурных границ, тесты плагина, сборка и упаковка. Отдельные регрессии воспроизводят:

- сохранение штатным ресурсом в `shipments:update` и `transport_runs:update` с определённым `filterByTk`;
- независимость внешней и вложенной активных вкладок;
- создание поставки с текущим рейсом и сохранение связи после изменения;
- обновление соседней таблицы рейса после сохранения;
- отсутствие запросов ресурсов неактивных вкладок без исходного ID;
- обязательные поля и вкладку документов в реально сохранённом дереве FlowModel.

Результаты:

- Сервер: 140 тестов в 42 файлах успешно.
- Клиент: 70 тестов в 15 файлах успешно.
- Архитектура: 24 теста успешно.
- Проверки типов клиента и сервера: 0 ошибок.
- ESLint с исправлением форматирования и `git diff --check`: успешно.
- Сборка и упаковка 2.0.104: успешно.
- Штатная установка, новая миграция и перезапуск: успешно; приложение ответило HTTP 200, в логе есть `app has been started`.
- Отдельная PostgreSQL-база: создание с автоматической связью, привязка существующей поставки, последующее редактирование с вложенным снимком, отказ неопределённой ссылке и отвязка — успешно. Временная база после проверки удалена.
- Чтение рабочей базы: единая кнопка с двумя создателями, обязательные поля по именам, вкладка документов, исходный ключ формы привязки, доступ и поиск под четырьмя рабочими ролями — успешно. Пользовательские набор и порядок колонок сохранены.

Основные выполненные команды:

```bash
corepack yarn typecheck:log-company:client
corepack yarn typecheck:log-company:server
corepack yarn test:architecture
corepack yarn test:server packages/plugins/@log-company/plugin-process-governance --run --maxWorkers=1 --minWorkers=1
corepack yarn test:client packages/plugins/@log-company/plugin-process-governance --run --maxWorkers=1 --minWorkers=1
corepack yarn build @log-company/plugin-process-governance
corepack yarn tar @log-company/plugin-process-governance
docker compose exec -T app yarn pm update /app/nocobase/storage/tar/@log-company/plugin-process-governance-2.0.104.tgz
docker compose exec -T app yarn nocobase upgrade
docker compose restart app
docker compose exec -T -e WORKSPACE_VALIDATION_DATABASE=lc_ws_validation_20261029_104 app node /tmp/lc-workspace-create-postgres.cjs
docker compose exec -T app node /tmp/logistics-workspace-verify.cjs
```

`corepack yarn eslint --fix` запускался для изменённых файлов клиента, метаданных, HTTP-адаптера, миграции и тестов. Серверные тесты запускались последовательно.

## Неустранённые ограничения

Визуальный просмотр браузера и ручная загрузка файла через интерфейс не выполнялись по указанию пользователя. Документы при создании подключены к существующему механизму draft-загрузки; код, метаданные и связанные сценарии проверяются без визуального просмотра.
