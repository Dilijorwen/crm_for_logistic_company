# Персональные столбцы таблиц

`@log-company/plugin-table-personalization` добавляет кнопку **«Столбцы»** в обычные таблицы FlowEngine.
Окно **«Мои столбцы»** предлагает все доступные для чтения поля коллекции, включая не добавленные в общую таблицу.
Оно позволяет выбирать поля, менять порядок перетаскиванием или кнопками
«Выше» / «Ниже», сохранять настройки и сбрасывать только собственные настройки этой таблицы.
Правую границу заголовка можно перетаскивать для персонального изменения ширины. Стрелки меняют ширину
на 10 px, Shift + стрелки — на 50 px; двойной клик возвращает общую ширину этого столбца.
Версия плагина: **2.0.67**; проверяемая версия NocoBase: **2.0.60**.

Исследование и согласованное решение:
[TABLE_PERSONALIZATION_RESEARCH.md](/Users/daniil/log_company/docs/log-company/TABLE_PERSONALIZATION_RESEARCH.md).
Исследование ширины, охват таблиц и проверки:
[TABLE_COLUMN_WIDTHS.md](/Users/daniil/log_company/docs/log-company/TABLE_COLUMN_WIDTHS.md).

## Применение настроек

Плагин расширяет существующий `TableBlockModel` через публичный реестр моделей. Сохранённые `use`, UID,
подмодели, свойства ячеек, функции `render` / `onCell`, действия, параметры ресурса и кликабельные поля сохраняются.
Порядок и видимость применяются к выходному массиву `getColumns()`. Персонально скрытый столбец не получает
`model.hidden`: его загрузка, appends, beforeRender и участие в поиске продолжают работать как раньше.

В конструкторе интерфейса работает исходный `getColumns()`, а кнопка персонализации скрыта. Обычным пользователям
не нужно выдавать право глобальной настройки интерфейса. Служебные столбцы и действия сохраняют свой порядок
и исходные свойства. Пользователь меняет порядок полей только внутри групп закрепления слева / без закрепления / справа.

В отсутствие настроек используется общий состав таблицы. Поля коллекции вне общей таблицы доступны в выборе,
но выключены до явного выбора пользователя, в том числе при загрузке настроек старых версий.
Новые общие столбцы появляются в конце своей группы после ранее упорядоченных полей.
Удалённые поля не создаются заново. Общая скрытость, FlowEngine `forbidden`
и текущий ACL имеют приоритет. При обновлении моделей в открытой странице список пересчитывается реактивно;
изменения администратора в другом браузере приходят при штатной повторной загрузке моделей или страницы.

Привязка выполняется по UID конкретной таблицы. Для ссылок на шаблоны клиент передаёт последовательность UID
обёрток `ReferenceBlockModel`; сервер проверяет каждую ссылку по сохранённому дереву и включает промежуточные
цели в канонический ключ. Две ссылки на одну таблицу имеют независимые настройки. Копия таблицы с новым UID
начинает с общих настроек. В ключ не входят строка данных, идентификатор сессии или случайный ID FlowEngine.

Дополнительные поля получают стабильный идентификатор `lc_field_<SHA-256(dataSourceKey, collectionName, fieldName)>`.
Их штатные `TableColumnModel` и display-модели создаются только в памяти, вне `table.subModels`, и не попадают
в сериализованную общую схему. Штатная привязка выбирает отображение строк, чисел, дат, перечислений и связей;
для поля без display-привязки используется штатный JSON display. Новые персональные поля доступны для чтения;
они не включают quick edit или настройку popup. Настроенные администратором столбцы сохраняют свои действия.
Для выбранных связей дополняется `appends` исходного ресурса; при явном `fields` добавляются выбранные поля.
При сбросе и смене владельца удаляются только добавленные персонализацией параметры и модели.
Фильтры, Data Scope, поиск, сортировка и пагинация продолжают работать через исходный ресурс.

## Хранение и миграция

Служебная коллекция `lc_table_personalizations` содержит:

| Поле                     | Назначение                                                               |
| ------------------------ | ------------------------------------------------------------------------ |
| `id`                     | Стандартный идентификатор записи NocoBase                                |
| `userId`                 | Текущий пользователь; клиент не может выбирать владельца                 |
| `instanceKey`            | SHA-256 проверенного пути экземпляра                                     |
| `instanceRootUid`        | UID внешней ссылки или самой таблицы                                     |
| `tableUid`               | UID фактической таблицы                                                  |
| `settings`               | JSON `{ version: 1, columnOrder: string[], hiddenColumnUids: string[] }` |
| `createdAt`, `updatedAt` | Стандартные временные метки                                              |

Уникальный индекс `(userId, instanceKey)` предотвращает дубликаты. Отдельные индексы созданы на `tableUid`
и `instanceRootUid`. Идентификаторы и JSON обязательны. Атомарный PostgreSQL upsert сохраняет последнюю
успешную конфигурацию при конкурентной работе двух вкладок. Никакие значения бизнес-записей не хранятся.

Определение коллекции отвечает за синхронизацию таблицы и индексов. Миграция
`20261009090000-personalization-cascades` добавляет физические внешние ключи на `users.id`, `flowModels.uid`
для таблицы и для корня экземпляра; все три имеют `ON DELETE CASCADE` и `ON UPDATE CASCADE`.
Миграция идемпотентна и работает с фактическими именами таблиц и колонок, включая schema / table prefix.
При первой установке `install()` выполняет её после синхронизации коллекций. При обновлении её обнаруживает
штатный механизм миграций NocoBase. `down()` удаляет ограничения, сохраняя персональные настройки.
Миграция не изменяет существующие бизнес-таблицы, строки пользователей или схемы FlowEngine.

## API и права

Все четыре действия вызываются через POST. Параметры — тело запроса, без поля `values`:

```json
{
  "identity": { "tableUid": "table-uid", "referencePath": [] }
}
```

| Действие                      | Дополнительные параметры                                         | Результат                                                              |
| ----------------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `tablePersonalizations:get`   | Нет                                                              | Доступные дескрипторы, эффективные настройки или `null`, подпись схемы |
| `tablePersonalizations:save`  | `settings`, `schemaSignature` из последнего get                  | Сохранённые эффективные настройки и актуальные дескрипторы             |
| `tablePersonalizations:reset` | Нет                                                              | Общие настройки (`settings: null`)                                     |
| `tablePersonalizations:width` | `columnUid`, `width` (50–3000 px либо `null`), `schemaSignature` | Изменение только ширины одного доступного столбца                      |

Ответ NocoBase: `{ data: { columns, settings, schemaSignature } }`. Дескриптор содержит только
`uid`, `title`, `fieldPath`, `fixed` и необязательный `source: 'collection'` для дополнительного поля.
Каталог строится по полям коллекции, а не только по сохранённым моделям столбцов.
Ответ дополнительно содержит `resizableColumnUids`, включая штатные служебные столбцы действий и JS.
Необязательный `settings.columnWidths` — словарь UID → целая ширина в пикселях. Старые JSON версии 1
поддерживаются без преобразования. Изменение ширины использует блокировку той же записи пользователя и экземпляра;
сохранение порядка/видимости сохраняет её актуальные ширины. Новые таблицы, поля и миграции не нужны.
Сырые `stepParams`, фильтры, значения записей и настройки недоступных
полей не возвращаются. Прямые действия над служебной коллекцией и generic list/create/update/destroy
над `tablePersonalizations` блокируются даже при широких правах роли.

Сервер берёт владельца из `state.currentUser`, проверяет существование таблицы, принадлежность ссылки,
доступ к маршруту по актуальным `currentRoles`, действие чтения коллекции и разрешённые поля.
Для связей дополнительно проверяются исходная ассоциация, каждое звено пути и поле подписи целевой коллекции.
Вложенные `appends` и `except` проверяются по полному пути, а не только по имени корневой ассоциации.
Права на бизнес-записи и Data Scope продолжает применять исходный ресурс таблицы; API персонализации
не читает записи и не изменяет фильтры, resourceOf, sourceId, сортировку, пагинацию или allowedActions.

Невалидный JSON, неизвестные ключи, повторяющиеся UID, неподдерживаемая версия, слишком длинные идентификаторы
и некорректный список скрытых полей отклоняются. Лимит: 500 настроенных полей на таблицу и 20 ссылок в пути.
Сохранение неизвестного или недоступного столбца запрещено. Изменение схемы или состава разрешённых полей
после открытия окна возвращает 409; клиент загружает актуальные дескрипторы и сохраняет пересечение черновика.

Сохранение списка, доступного в текущем интерфейсе, не стирает настройки временно недоступных или скрытых
общими правилами столбцов. Их UID остаются непрозрачными в хранилище и не выдаются в ответе. Физически удалённые
колонки удаляются из сохранённого JSON при следующем явном сохранении. GET ничего не записывает.

Коды: 400 — неверный ввод, 401 — нет входа, 403 — нет доступа, 404 — нет таблицы,
409 — изменилась схема, 500 — безопасная ошибка хранилища с серверным логированием.
Смена пользователя / роли сбрасывает локальное состояние; устаревшие ответы не применяются.
Сохранение блокирует повторную отправку. Окно открывается сразу; загрузка показывает индикатор внутри окна и допускает отмену. Ошибка сохранения не закрывает окно и не стирает черновик.

## Установка и обновление

Запускать из `/Users/daniil/log_company`; runtime-копии в `storage/plugins/` вручную не редактировать.

```sh
corepack yarn build @log-company/plugin-table-personalization
corepack yarn tar @log-company/plugin-table-personalization
docker compose exec -T app yarn pm add /app/nocobase/storage/tar/@log-company/plugin-table-personalization-2.0.67.tgz
docker compose exec -T app yarn pm enable @log-company/plugin-table-personalization
```

Для уже установленного плагина вместо add/enable:

```sh
docker compose exec -T app yarn pm update /app/nocobase/storage/tar/@log-company/plugin-table-personalization-2.0.67.tgz
```

После add/enable или update завершить обновление и перезапустить локальное приложение:

```sh
docker compose exec -T app yarn nocobase upgrade --skip-code-update
docker compose restart app
```

Команды не пересоздают volumes PostgreSQL или файлового хранилища. После обновления клиентской сборки перезагрузить страницу. Если другая надстройка уже подменяет
`TableBlockModel`, загрузка этого плагина сообщает конфликт, чтобы не затереть её поведение.
При отключении исходная регистрация восстанавливается; существующие экземпляры требуют перезагрузки страницы.

## Проверки для разработчика

Быстрые серверные/domain/application тесты и тесты клиентской логики:

```sh
corepack yarn vitest run --config /Users/daniil/log_company/packages/plugins/@log-company/vitest.config.ts \
  --root packages/plugins/@log-company plugin-table-personalization --maxWorkers=1 --minWorkers=1
```

Клиентские тесты с реальными моделями FlowEngine и Ant Design:

```sh
corepack yarn test:client packages/plugins/@log-company/plugin-table-personalization/src/client --run --maxWorkers=1 --minWorkers=1
```

Строгая проверка типов нового плагина с настоящими типами исходников workspace:

```sh
node --max-old-space-size=8192 packages/plugins/@log-company/plugin-table-personalization/scripts/check-types.cjs
corepack yarn eslint --fix packages/plugins/@log-company/plugin-table-personalization/src \
  packages/plugins/@log-company/plugin-table-personalization/scripts/check-types.cjs
corepack yarn eslint --fix --no-ignore packages/plugins/@log-company/plugin-table-personalization/src/client/features/table-personalization/lib/columnLayout.ts \
  packages/plugins/@log-company/plugin-table-personalization/src/client/features/table-personalization/lib/__tests__/columnLayout.test.ts
node node_modules/prettier/bin/prettier.cjs --check --ignore-path /dev/null 'packages/plugins/@log-company/plugin-table-personalization/src/**/*.{ts,tsx}' \
  packages/plugins/@log-company/plugin-table-personalization/scripts/check-types.cjs \
  packages/plugins/@log-company/plugin-table-personalization/package.json \
  packages/plugins/@log-company/plugin-table-personalization/tsconfig.json
```

Upstream NocoBase компилируется без `strict` и не имеет всех собранных `.d.ts` в текущем checkout.
Скрипт проверяет собственные исходники и тесты в `strict`, используя реальные исходники зависимостей;
он не выдаёт ошибки чужих файлов за ошибки нового плагина. Штатная сборка дополнительно создаёт декларации.

В текущем checkout установлен Prettier 3.1.1, используемый также ESLint, но старый executable `yarn prettier`
запускает 2.2.1. Поэтому актуальная команда выше вызывает установленный formatter напрямую, без изменения зависимостей.

Интеграционные тесты PostgreSQL разрешены только на отдельной базе с префиксом `table_personalization_test`.
Пример временной базы без рабочей директории данных:

```sh
docker run --rm --name log-company-table-personalization-test-db \
  -p 127.0.0.1:15432:5432 -e POSTGRES_HOST_AUTH_METHOD=trust \
  -e POSTGRES_DB=table_personalization_test -e POSTGRES_USER=nocobase -d postgres:16
TABLE_PERSONALIZATION_POSTGRES_INTEGRATION=1 DB_DIALECT=postgres DB_HOST=127.0.0.1 DB_PORT=15432 \
  DB_USER=nocobase DB_DATABASE=table_personalization_test DB_TEST_PREFIX=table_personalization_test \
  corepack yarn vitest run --config /Users/daniil/log_company/packages/plugins/@log-company/vitest.config.ts \
  --root packages/plugins/@log-company plugin-table-personalization --maxWorkers=1 --minWorkers=1
docker stop log-company-table-personalization-test-db
```

Тесты покрывают CRUD персональных настроек, повторы, гонки upsert, двух пользователей и экземпляры,
401/400/403/404/409/500, generic API, полевые и вложенные ACL, ссылки и циклы, подпись схемы,
удаление и каскады, неизменность сериализованного FlowEngine, применение настроек после асинхронной загрузки, исходные render/onCell и действие поиска,
переключение владельца, ошибки, отмену, восстановление скрытого столбца и сброс в интерфейсе.

## Проверки первоначальной реализации 2.0.62 (9 октября 2026)

- **59 новых тестов** в 9 файлах: 48 проверок node/серверного слоя и 17 клиентских,
  включая 6 одинаковых проверок контроллера в обоих окружениях.
- **35 существующих регрессионных тестов**: поиск (19), TableColumnModel (7), ClickableFieldModel (6),
  aclCheckRefresh (3). Всего **94 уникальных теста** в 14 файлах прошли.
- `node --max-old-space-size=8192 .../scripts/check-types.cjs`: 0 строгих диагностик собственных файлов.
- `corepack yarn eslint --fix` для исходников и скрипта; отдельно `--no-ignore` для двух файлов `lib`:
  код завершения 0. `corepack yarn prettier --check --ignore-path /dev/null` для исходников, скрипта,
  конфигурации и двух документов: код завершения 0.
- `corepack yarn build @log-company/plugin-table-personalization` и
  `corepack yarn tar @log-company/plugin-table-personalization`: код завершения 0.
- Плагин установлен через штатный менеджер плагинов и включён в локальном Docker NocoBase 2.0.60.
  Выполнены `yarn nocobase upgrade --skip-code-update` и перезапуск приложения.
  Миграция проверена в PostgreSQL: уникальный индекс владельца, индексы таблицы/корня,
  три внешних ключа с каскадным удалением. Бизнес-таблицы не менялись.
- Реальный анонимный POST `/api/tablePersonalizations:get` возвращает 401.
  Страница приложения отвечает 200. Тестовые записи не создавались в рабочей базе;
  отдельный временный PostgreSQL-контейнер остановлен после тестов.
- При первоначальной реализации ручной сценарий в авторизованном браузере не был выполнен: была доступна только форма входа.
  Сохранение, отмена, ошибки, восстановление скрытого поля и сброс проверены клиентскими тестами Ant Design;
  изоляция пользователей, экземпляров, права и каскады — интеграционными тестами реального PostgreSQL.

Команда финального последовательного прогона node/PostgreSQL и поиска:

```sh
TABLE_PERSONALIZATION_POSTGRES_INTEGRATION=1 DB_DIALECT=postgres DB_HOST=127.0.0.1 DB_PORT=15432 \
  DB_USER=nocobase DB_DATABASE=table_personalization_test DB_TEST_PREFIX=table_personalization_test \
  corepack yarn vitest run --config /Users/daniil/log_company/packages/plugins/@log-company/vitest.config.ts \
  --root packages/plugins/@log-company plugin-table-personalization \
  plugin-collection-search/src/client/features/collection-search/lib/__tests__/TableIndexedSearchController.test.ts \
  plugin-collection-search/src/server/application/__tests__/SearchCurrentCollection.test.ts \
  --maxWorkers=1 --minWorkers=1 --reporter=dot
```

Результат: 67 проверок, 9 файлов. Клиентская команда из раздела выше: 17 проверок, 3 файла.
Существующие проверки ядра запущены отдельными последовательными `corepack yarn test:client`:

```sh
corepack yarn test:client packages/core/client/src/flow/models/blocks/table/__tests__/TableColumnModel.test.tsx --run --maxWorkers=1 --minWorkers=1
corepack yarn test:client packages/core/client/src/flow/models/fields/__tests__/ClickableFieldModel.test.ts --run --maxWorkers=1 --minWorkers=1
corepack yarn test:client packages/core/client/src/flow/actions/__tests__/aclCheckRefresh.test.ts --run --maxWorkers=1 --minWorkers=1
```

## Исправление открытия окна в 2.0.63

Первый клик ранее ожидал GET до открытия окна. Асинхронное обновление столбцов пересоздавало панель действий,
а состояние Modal принадлежало кнопке в этой панели. В браузере воспроизведён пустой `.ant-modal-wrap`,
который перекрывал страницу и перехватывал клики после второго нажатия; API при этом отвечал 200.

Окно теперь открывается через штатный `model.context.viewer.dialog`, который размещает его в общем holder FlowEngine.
Кнопка открывает окно сразу, а загрузка выполняется внутри `ColumnSettingsDialog`. Модель удерживает ссылку
на открытый view и предотвращает повторное открытие даже при пересоздании кнопки. Закрытие удаляет view;
смена владельца, режим конструктора и unmount таблицы также уничтожают открытое окно. Отмена доступна при
загрузке; закрытие блокируется только во время сохранения. Черновик и сообщения об ошибках сохраняются.

Клиентский прогон после исправления: **20 тестов в 3 файлах прошли**, включая 9 проверок окна со штатным
FlowEngine view holder и Ant Design. Новые сценарии проверяют первый клик при незавершённом GET,
отмену до ответа, отсутствие оставшегося wrap, работу действий страницы после закрытия, повторный клик,
пересоздание панели с сохранением черновика и смену владельца.

Команда: `corepack yarn test:client packages/plugins/@log-company/plugin-table-personalization/src/client --run --maxWorkers=1 --minWorkers=1`.
Строгая проверка типов и ESLint затронутых файлов завершились без ошибок. Схема базы данных не менялась.

Дополнительно выполнены без ошибок:

```sh
node --max-old-space-size=8192 packages/plugins/@log-company/plugin-table-personalization/scripts/check-types.cjs
corepack yarn eslint --fix packages/plugins/@log-company/plugin-table-personalization/src/client/features/table-personalization/ui \
  packages/plugins/@log-company/plugin-table-personalization/src/client/features/table-personalization/model/PersonalizedTableBlockModel.tsx
corepack yarn build @log-company/plugin-table-personalization
corepack yarn tar @log-company/plugin-table-personalization
git diff --check
```

Prettier `--check --ignore-path /dev/null` прошёл для семи затронутых файлов: трёх компонентов UI,
их теста, модели таблицы, `package.json` и этого документа.

Версия **2.0.63 установлена** штатным `yarn pm update`, приложение перезапущено через Docker Compose.
Startup upgrade завершился; версия runtime-пакета и включённого `applicationPlugins` — 2.0.63,
страница входа вернула HTTP 200. Новых миграций в этом исправлении нет.

В авторизованном браузере проверены реальные сценарии на странице «Таможенное оформление»
(`86b0rz9mq5v`, таблица `3018afd4aa4`):

- Окно открывается с первого клика и остаётся открытым после загрузки и пересоздания панели действий.
- Скрытие «Город отправления» сохраняется и применяется после перезагрузки страницы.
- Сброс возвращает исходные столбцы; созданная проверкой настройка удалена штатным UI,
  число записей персонализации для таблицы снова равно исходному значению 0.
- Сохранение и отмена удаляют `.ant-modal-wrap`; фильтр и открытие карточки рейса после закрытия работают.
- В таблице «Поставки» внутри карточки рейса окно также открывается с первого клика и закрывается крестиком.
  Переключение вкладок карточки после закрытия работает; её собственный заполненный modal остаётся до Escape.

Проверка не изменяла бизнес-записи или общую конфигурацию таблиц.

## Расширение каталога полей в 2.0.65

По уточнению пользователя от 9 октября каталог теперь включает все зарегистрированные поля текущей коллекции,
доступные для чтения, в том числе отсутствующие в общей таблице. Права изменения или удаления не заменяют
право чтения. Поля с серверным `hidden: true`, которые NocoBase исключает из JSON, не предлагаются даже root.
Для связей проверяется также доступность поля подписи целевой коллекции, включая её серверную скрытость.
Дополнительные поля изначально выключены и включаются только явным персональным выбором.
Окно поддерживает поиск по названию и техническому имени; поиск не удаляет остальные поля из черновика.

При добавлении поля создаются настоящие штатные модели отображения FlowEngine без сохранения общей схемы.
Ошибки загрузки связей откатывают новые модели и параметры ресурса; повторное сохранение позволяет повторить загрузку.
Смена владельца и устаревшие запросы очищают незавершённые модели и добавленные ими параметры.
Изменение метаданных коллекции обнаруживается подписью схемы. Схема БД и миграции в этом обновлении не менялись.

Фактически выполненные проверки после изменений:

```sh
corepack yarn eslint --fix --no-ignore packages/plugins/@log-company/plugin-table-personalization/src
node --max-old-space-size=8192 packages/plugins/@log-company/plugin-table-personalization/scripts/check-types.cjs
corepack yarn test:client packages/plugins/@log-company/plugin-table-personalization/src/client --run --maxWorkers=1 --minWorkers=1
TABLE_PERSONALIZATION_POSTGRES_INTEGRATION=1 DB_DIALECT=postgres DB_HOST=127.0.0.1 DB_PORT=15432 \
  DB_USER=nocobase DB_DATABASE=table_personalization_test DB_TEST_PREFIX=table_personalization_test \
  corepack yarn vitest run --config /Users/daniil/log_company/packages/plugins/@log-company/vitest.config.ts \
  --root packages/plugins/@log-company plugin-table-personalization \
  plugin-collection-search/src/client/features/collection-search/lib/__tests__/TableIndexedSearchController.test.ts \
  plugin-collection-search/src/server/application/__tests__/SearchCurrentCollection.test.ts \
  --maxWorkers=1 --minWorkers=1
corepack yarn build @log-company/plugin-table-personalization
corepack yarn tar @log-company/plugin-table-personalization
git diff --check
```

- Клиентские тесты: **29 проверок в 4 файлах прошли**.
- Последовательный прогон node/PostgreSQL и поиска: **76 проверок в 9 файлах прошли**.
- Всего **97 уникальных тестов**: 78 плагина и 19 существующего поиска; 8 проверок контроллера
  выполняются в обоих окружениях и учитываются один раз.
- Строгая проверка: 0 диагностик собственных файлов. ESLint, сборка и упаковка завершились с кодом 0.
- `node node_modules/prettier/bin/prettier.cjs --check --ignore-path /dev/null` для исходников,
  скрипта, конфигурации и двух документов: все файлы соответствуют форматированию, код завершения 0.
- PostgreSQL проверен в отдельном временном контейнере без рабочих volumes. После тестов контейнер остановлен и удалён.
- Новые проверки покрывают каталог вне общей таблицы, ACL поля и подписи связи, права только update/destroy,
  подделку UID, серверную скрытость обычных полей и подписи связи, изменение метаданных, отсутствие неожиданно включённых полей в старых настройках,
  настоящие модели и отображение значений, сохранение фильтра, очистку параметров ресурса,
  ошибки и повторную загрузку, смену владельца во время загрузки и поиск полей в окне.

Версия **2.0.65 установлена и включена** в локальном NocoBase через штатный менеджер плагинов:

```sh
/usr/local/bin/docker compose exec -T app yarn pm update /app/nocobase/storage/tar/@log-company/plugin-table-personalization-2.0.65.tgz
/usr/local/bin/docker compose restart app
/usr/local/bin/docker compose exec -T app node -p "require('./storage/plugins/@log-company/plugin-table-personalization/package.json').version"
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:13000/signin
```

Все команды завершились с кодом 0. Runtime-пакет и `applicationPlugins` содержат версию 2.0.65;
плагин включён. Startup upgrade завершился запуском приложения, страница входа отвечает HTTP 200.

В авторизованном браузере на странице «Таможенное оформление» (`86b0rz9mq5v`, таблица `3018afd4aa4`) проверено:

- Каталог предлагает **17 доступных полей** вместо 6 исходных столбцов; `vehicle` и `vehicle_id`
  с серверным `hidden: true` отсутствуют в выборе. Остальные дополнительные поля изначально выключены.
- Поиск находит поля по названиям; ранее в этой проверке также проверен поиск по техническому имени `createdAt`.
- Дополнительные «Дата создания» и «Создатель» показывают реальные даты и подпись связанного пользователя.
  Сохранение обоих полей применяется после перезагрузки страницы.
- При выбранных дополнительных полях поиск `TRZU1081518` оставляет 2 строки; очистка возвращает исходные 3 строки.
- После проверки оба дополнительных поля выключены через штатное окно. Состав и порядок исходных
  выбранных столбцов совпадают с сохранённым перед проверкой состоянием. Существующая запись предпочтений
  сохранена: количество записей для таблицы равно исходному значению 1.
- Повторное открытие, отмена и открытие карточки рейса работают. После закрытия окон осталось 0 `.ant-modal-wrap`.
- Количество общих `flowModels` осталось 576, контрольная сумма `uid + options` осталась
  `37a04df917ca4759b300cd5311f736f0`. Персональная настройка не записала дополнительные поля в общую схему.

Рабочие бизнес-записи не изменялись. Проверка предпочитает восстановление исходного выбора вместо сброса
существующих пользовательских предпочтений. Снимок итогового окна:
[table-personalization-catalog.jpg](/Users/daniil/.codex/visualizations/2026/10/09/01a11e84-19a8-75c2-87dd-6cc8fa839ee2/table-personalization-catalog.jpg).

## Восстановление пункта «Таблица» в 2.0.66

В конструкторе воспроизведена замена пункта «Таблица» техническим именем `TableBlockModel`.
Причина находится в клиентском расширении таблицы: `PersonalizedTableBlockModel` регистрировался
под штатным именем, но не регистрировал метаданные базового класса. `FlowModel.meta` читает `WeakMap`
по самому конструктору; наследование класса и `registerModels` не переносят эти метаданные.
Из-за этого терялись название, поиск, группа, сортировка меню и фабрика начальной конфигурации.
`CollectionBlockModel.defineChildren` возвращал настройки ресурса без штатных `use` и
`subModels.columns: [{ use: 'TableActionsColumnModel' }]`.

Расширение теперь вызывает `PersonalizedTableBlockModel.define(TableBlockModel.meta)` после проверки,
что базовая модель зарегистрировала метаданные. Используется исходная фабрика, без дублирования её
конфигурации. Действия, ACL, поиск, персональная проекция столбцов и серверный слой не изменены.
Это тот же принцип корректной регистрации, который применён в исправлении
[EditFormModel](/Users/daniil/log_company/docs/log-company/EDIT_FORM_MODEL_REGRESSION.md).
Исправление таблицы не требует отката синхронизации форм или переноса статуса поставок.

Новый `PersonalizedTableBlockModel.creation.test.tsx` воспроизводит потерю метаданных и начального
столбца действий при регистрации плагина. Контрольный сценарий использует исходный `TableBlockModel`.
Проверены меню коллекций, связанные и другие записи, привязка исходной записи,
сериализация существующих столбцов и действий, таблицы выбора, отключение и конфликт расширений.

Фактически выполнены:

- Клиентские тесты плагина: **37 проверок, 5 файлов**, включая 8 новых регрессионных сценариев.
- Последовательные node/PostgreSQL тесты плагина и поиска: **76 проверок, 9 файлов**.
  PostgreSQL запускался отдельно, на порту 15432, с базой `table_personalization_test` и временным
  хранилищем в памяти; рабочая база CRM не использовалась тестами.
- Регрессионные проверки создания `EditFormModel`: **8 проверок, 1 файл**.
- Штатные проверки таблиц NocoBase: **25 проверок, 9 файлов**, включая действия строк,
  открытие popup, обновление после quick edit, высоту блока и таблицы выбора.
- `node --max-old-space-size=8192 .../scripts/check-types.cjs`: **0 строгих диагностик**
  во всех собственных исходниках и тестах плагина.
- `corepack yarn eslint --fix` для изменённой модели и нового теста: код завершения 0.
- Prettier `--check --ignore-path /dev/null` для модели, теста, `package.json` и документа:
  код завершения 0; `git diff --check` также прошёл.
- `corepack yarn build @log-company/plugin-table-personalization` и
  `corepack yarn tar @log-company/plugin-table-personalization`: код завершения 0.

Команды клиентских регрессионных прогонов:

```sh
corepack yarn test:client packages/plugins/@log-company/plugin-table-personalization/src/client --run --maxWorkers=1 --minWorkers=1 --reporter=verbose
corepack yarn test:client packages/core/client/src/flow/models/blocks/table --run --maxWorkers=1 --minWorkers=1 --reporter=verbose
corepack yarn test:client packages/plugins/@log-company/plugin-process-governance/src/client/logistics/__tests__/ShipmentSynchronizedEditFormModel.creation.test.ts --run --maxWorkers=1 --minWorkers=1 --reporter=verbose
```

Версия **2.0.66 установлена** штатным `yarn pm update`, затем выполнен `docker compose restart app`.
SHA-256 runtime-клиента совпадает с собранным исходником:
`a43bbc5865ca3d7677cbf1ce3e218c643cc905f7f4521464357749f465fe898c`.
Приложение запущено, PostgreSQL и MinIO остаются healthy.

В авторизованном браузере проверено:

- Пункт «Таблица» снова находится первым в блоках данных; доступны поиск, «Связанные записи»
  и «Другие записи». [Снимок восстановленного меню](/Users/daniil/.codex/visualizations/2026/10/09/01a11fdf-c870-7290-a891-40b4adf3427a/table-menu-restored.png).
- Во временной вкладке карточки рейса создана связанная таблица поставок. Штатный столбец
  `TableActionsColumnModel` создан автоматически; поле «Номер поставки» добавлено через конструктор.
- После перезагрузки видны три связанные поставки: 16, 20 и 21. В обычном режиме окно
  «Мои столбцы» открывается и предлагает поля коллекции; проверка закрыта через «Отмена».
  Ошибок в консоли браузера не зарегистрировано.
- Сразу после обновления хеши конфигураций всех **578 исходных моделей** совпали с контрольными.
  Во время дальнейшей проверки изменялась исходная вкладка вне тестового сценария:
  добавлены таблица `f1d427c0834` и поле китайского клиента, удалена форма `fd616213fc9`,
  обновлён layout `966974cb267`. Эти изменения сохранены и не откатывались.
- Удалены только **6 собственных тестовых моделей** и 55 относящихся к ним путей дерева.
  Очистка проверяла точные UID, хеши конфигураций, название тестовой вкладки и отсутствие чужих потомков.
  Хеши существующих персональных настроек совпадают с исходными. Режим конструктора выключен.

Схема базы, миграции и бизнес-данные в этом исправлении не меняются.

## Границы поддержки

- Обычные `TableBlockModel` текущего FlowEngine, включая таблицы во всплывающих окнах и ссылки на шаблоны.
- Настраиваются существующие стандартные `TableColumnModel` и дополнительные разрешённые поля той же коллекции.
- Legacy Formily-таблицы, таблицы выбора, подтаблицы форм, JS/custom и служебные столбцы сохраняют свои штатные механизмы.
- Настройки ширины, закрепления, фильтров и поиска остаются общей конфигурацией; плагин сохраняет только порядок и скрытость.
- Плагин не вводит websocket-канал обновления схемы между браузерами.
- Индекс универсального поиска и его собственные проверки прав не изменены; ограничения исходного поиска,
  отмеченные в исследовании, не расширяются и не исправляются этим плагином.

## Перечень файлов

Все исходники нового плагина находятся в одном штатном пакете:

| Файл                                                                                                                                                                                                                                                                                  | Назначение                                                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| [client.d.ts](/Users/daniil/log_company/packages/plugins/@log-company/plugin-table-personalization/client.d.ts)                                                                                                                                                                       | Экспорт клиентских деклараций                                                         |
| [client.js](/Users/daniil/log_company/packages/plugins/@log-company/plugin-table-personalization/client.js)                                                                                                                                                                           | Клиентский entrypoint штатного scaffold                                               |
| [package.json](/Users/daniil/log_company/packages/plugins/@log-company/plugin-table-personalization/package.json)                                                                                                                                                                     | Метаданные, совместимость и уже существующие peer-зависимости                         |
| [scripts/check-types.cjs](/Users/daniil/log_company/packages/plugins/@log-company/plugin-table-personalization/scripts/check-types.cjs)                                                                                                                                               | Повторяемая строгая проверка собственных исходников и тестов                          |
| [server.d.ts](/Users/daniil/log_company/packages/plugins/@log-company/plugin-table-personalization/server.d.ts)                                                                                                                                                                       | Экспорт серверных деклараций                                                          |
| [server.js](/Users/daniil/log_company/packages/plugins/@log-company/plugin-table-personalization/server.js)                                                                                                                                                                           | Серверный entrypoint штатного scaffold                                                |
| [src/client/features/table-personalization/api/TablePersonalizationApi.ts](/Users/daniil/log_company/packages/plugins/@log-company/plugin-table-personalization/src/client/features/table-personalization/api/TablePersonalizationApi.ts)                                             | Типизированные запросы get/save/reset                                                 |
| [src/client/features/table-personalization/lib/**tests**/columnLayout.test.ts](/Users/daniil/log_company/packages/plugins/@log-company/plugin-table-personalization/src/client/features/table-personalization/lib/__tests__/columnLayout.test.ts)                                     | Группы закрепления, UID, скрытость и порядок без мутаций                              |
| [src/client/features/table-personalization/lib/columnLayout.ts](/Users/daniil/log_company/packages/plugins/@log-company/plugin-table-personalization/src/client/features/table-personalization/lib/columnLayout.ts)                                                                   | Проекция колонок и локальная перестановка черновика                                   |
| [src/client/features/table-personalization/model/PersonalizationController.ts](/Users/daniil/log_company/packages/plugins/@log-company/plugin-table-personalization/src/client/features/table-personalization/model/PersonalizationController.ts)                                     | Загрузка, сохранение, ошибки и защита от устаревших ответов                           |
| [src/client/features/table-personalization/model/PersonalCollectionColumns.ts](/Users/daniil/log_company/packages/plugins/@log-company/plugin-table-personalization/src/client/features/table-personalization/model/PersonalCollectionColumns.ts)                                     | Штатные модели дополнительных полей в памяти, загрузка и очистка параметров ресурса   |
| [src/client/features/table-personalization/model/PersonalizedTableBlockModel.tsx](/Users/daniil/log_company/packages/plugins/@log-company/plugin-table-personalization/src/client/features/table-personalization/model/PersonalizedTableBlockModel.tsx)                               | Расширение существующей таблицы без записи общей схемы                                |
| [src/client/features/table-personalization/model/**tests**/PersonalizationController.test.ts](/Users/daniil/log_company/packages/plugins/@log-company/plugin-table-personalization/src/client/features/table-personalization/model/__tests__/PersonalizationController.test.ts)       | Ошибки, конкурентные запросы и смена владельца                                        |
| [src/client/features/table-personalization/model/**tests**/PersonalCollectionColumns.test.tsx](/Users/daniil/log_company/packages/plugins/@log-company/plugin-table-personalization/src/client/features/table-personalization/model/__tests__/PersonalCollectionColumns.test.tsx)     | Реальные display-модели, связи, фильтры, ошибки, повтор и очистка устаревших запросов |
| [src/client/features/table-personalization/model/**tests**/PersonalizedTableBlockModel.test.tsx](/Users/daniil/log_company/packages/plugins/@log-company/plugin-table-personalization/src/client/features/table-personalization/model/__tests__/PersonalizedTableBlockModel.test.tsx) | Сериализация, render/onCell, действия, конструктор и ссылки                           |
| [src/client/features/table-personalization/ui/ColumnSettingsButton.tsx](/Users/daniil/log_company/packages/plugins/@log-company/plugin-table-personalization/src/client/features/table-personalization/ui/ColumnSettingsButton.tsx)                                                   | Кнопка открытия штатного view и реакция на смену владельца                            |
| [src/client/features/table-personalization/ui/ColumnRow.tsx](/Users/daniil/log_company/packages/plugins/@log-company/plugin-table-personalization/src/client/features/table-personalization/ui/ColumnRow.tsx)                                                                         | Перетаскивание, переключатель видимости и доступные кнопки порядка                    |
| [src/client/features/table-personalization/ui/ColumnSettingsDialog.tsx](/Users/daniil/log_company/packages/plugins/@log-company/plugin-table-personalization/src/client/features/table-personalization/ui/ColumnSettingsDialog.tsx)                                                   | Содержимое штатного view, загрузка, черновик, сохранение и сброс                      |
| [src/client/features/table-personalization/ui/**tests**/ColumnSettingsButton.test.tsx](/Users/daniil/log_company/packages/plugins/@log-company/plugin-table-personalization/src/client/features/table-personalization/ui/__tests__/ColumnSettingsButton.test.tsx)                     | Сохранение, отмена, ошибки, pending GET и пересоздание панели                         |
| [src/client/index.ts](/Users/daniil/log_company/packages/plugins/@log-company/plugin-table-personalization/src/client/index.ts)                                                                                                                                                       | Экспорт клиентского плагина                                                           |
| [src/client/plugin.ts](/Users/daniil/log_company/packages/plugins/@log-company/plugin-table-personalization/src/client/plugin.ts)                                                                                                                                                     | Регистрация и восстановление TableBlockModel                                          |
| [src/server/**tests**/PersonalizationsPostgres.integration.test.ts](/Users/daniil/log_company/packages/plugins/@log-company/plugin-table-personalization/src/server/__tests__/PersonalizationsPostgres.integration.test.ts)                                                           | Реальный PostgreSQL, MagicAttributeModel, ссылки, ACL, upsert и каскады               |
| [src/server/**tests**/PluginInstallation.test.ts](/Users/daniil/log_company/packages/plugins/@log-company/plugin-table-personalization/src/server/__tests__/PluginInstallation.test.ts)                                                                                               | Запуск миграции при первой установке                                                  |
| [src/server/application/TablePersonalizations.ts](/Users/daniil/log_company/packages/plugins/@log-company/plugin-table-personalization/src/server/application/TablePersonalizations.ts)                                                                                               | Сценарии получения, сохранения и сброса                                               |
| [src/server/application/**tests**/TablePersonalizations.test.ts](/Users/daniil/log_company/packages/plugins/@log-company/plugin-table-personalization/src/server/application/__tests__/TablePersonalizations.test.ts)                                                                 | Use cases, изоляция, повторы, права и ошибки хранения                                 |
| [src/server/application/ports.ts](/Users/daniil/log_company/packages/plugins/@log-company/plugin-table-personalization/src/server/application/ports.ts)                                                                                                                               | Порты хранения и проверки конфигурации                                                |
| [src/server/collections/tablePersonalizations.ts](/Users/daniil/log_company/packages/plugins/@log-company/plugin-table-personalization/src/server/collections/tablePersonalizations.ts)                                                                                               | Описание служебной таблицы и индексов                                                 |
| [src/server/domain/ColumnPreferences.ts](/Users/daniil/log_company/packages/plugins/@log-company/plugin-table-personalization/src/server/domain/ColumnPreferences.ts)                                                                                                                 | Валидация, согласование схемы и сохранение непрозрачных настроек                      |
| [src/server/domain/PersonalizationError.ts](/Users/daniil/log_company/packages/plugins/@log-company/plugin-table-personalization/src/server/domain/PersonalizationError.ts)                                                                                                           | Ошибки domain/application без HTTP-зависимостей                                       |
| [src/server/domain/**tests**/ColumnPreferences.test.ts](/Users/daniil/log_company/packages/plugins/@log-company/plugin-table-personalization/src/server/domain/__tests__/ColumnPreferences.test.ts)                                                                                   | Границы валидации, новая схема, непрозрачные и удалённые поля                         |
| [src/server/index.ts](/Users/daniil/log_company/packages/plugins/@log-company/plugin-table-personalization/src/server/index.ts)                                                                                                                                                       | Экспорт серверного плагина                                                            |
| [src/server/infrastructure/NocoBasePersonalizationRepository.ts](/Users/daniil/log_company/packages/plugins/@log-company/plugin-table-personalization/src/server/infrastructure/NocoBasePersonalizationRepository.ts)                                                                 | Атомарный upsert и выборка только текущего владельца                                  |
| [src/server/infrastructure/NocoBaseTableConfiguration.ts](/Users/daniil/log_company/packages/plugins/@log-company/plugin-table-personalization/src/server/infrastructure/NocoBaseTableConfiguration.ts)                                                                               | Проверенное дерево ссылок, маршруты, полевые ACL и подпись схемы                      |
| [src/server/interfaces/TablePersonalizationController.ts](/Users/daniil/log_company/packages/plugins/@log-company/plugin-table-personalization/src/server/interfaces/TablePersonalizationController.ts)                                                                               | HTTP-контракт, аутентификация, статусы и закрытие generic API                         |
| [src/server/interfaces/**tests**/TablePersonalizationController.test.ts](/Users/daniil/log_company/packages/plugins/@log-company/plugin-table-personalization/src/server/interfaces/__tests__/TablePersonalizationController.test.ts)                                                 | Статусы, безопасные ошибки и запрет generic API                                       |
| [src/server/migrations/20261009090000-personalization-cascades.ts](/Users/daniil/log_company/packages/plugins/@log-company/plugin-table-personalization/src/server/migrations/20261009090000-personalization-cascades.ts)                                                             | Идемпотентные физические внешние ключи с каскадным удалением                          |
| [src/server/plugin.ts](/Users/daniil/log_company/packages/plugins/@log-company/plugin-table-personalization/src/server/plugin.ts)                                                                                                                                                     | Composition root и миграция при первой установке                                      |
| [src/shared/contracts.ts](/Users/daniil/log_company/packages/plugins/@log-company/plugin-table-personalization/src/shared/contracts.ts)                                                                                                                                               | Общие DTO и безопасное преобразование внешних значений                                |
| [tsconfig.json](/Users/daniil/log_company/packages/plugins/@log-company/plugin-table-personalization/tsconfig.json)                                                                                                                                                                   | Строгий TypeScript с типами workspace                                                 |

Документы задачи:

| Файл                                                                                                              | Назначение                                                    |
| ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| [TABLE_PERSONALIZATION_RESEARCH.md](/Users/daniil/log_company/docs/log-company/TABLE_PERSONALIZATION_RESEARCH.md) | Исследование и согласованное архитектурное решение            |
| [TABLE_PERSONALIZATION_PLUGIN.md](/Users/daniil/log_company/docs/log-company/TABLE_PERSONALIZATION_PLUGIN.md)     | Реализация, API, установка, проверки и полный перечень файлов |
