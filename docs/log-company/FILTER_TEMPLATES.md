# Личные шаблоны таблиц

`@log-company/plugin-table-personalization` версии **2.0.75**, NocoBase **2.0.60**.

## Пользовательское поведение

Отдельная кнопка с надписью **«Шаблоны»** расположена слева от кнопки **«Колонки»** в панели обычной
таблицы FlowEngine, включая таблицы во всплывающих окнах. В окне «Фильтр» остаётся штатный редактор условий.
Кнопка доступна и у таблицы, в которой ещё нет кнопки фильтра. В конструкторе интерфейса персональные кнопки скрыты.

Шаблон сохраняет вместе:

- условия фильтрации, включая вложенные группы «И/ИЛИ»;
- выбранные и скрытые колонки;
- порядок колонок;
- заданную ширину колонок в пикселях. Отсутствие фиксированного значения означает штатную автоматическую ширину.

Все шаблоны личные. Пользователь видит, создаёт, обновляет, переименовывает и удаляет только свои шаблоны.
Root также не получает доступа к чужим шаблонам. Разделов «Общие» / «Личные» и выбора доступности больше нет.
При первом открытии списка для каждого доступного значения поля `status` создаётся личный шаблон с названием
статуса и условием «Статус равен этому значению». Он использует исходный набор, порядок и ширину колонок таблицы.
Сохранённый пользователем шаблон с тем же названием имеет приоритет. Начальные шаблоны можно изменять и удалять.
После удаления начальный шаблон не появляется повторно. При отсутствии доступного поля `status` с настроенным
списком значений начальные шаблоны не создаются.

Выбор шаблона заменяет текущий фильтр и настройки колонок. Выбор **«Без шаблона»** очищает пользовательский
фильтр и удаляет персональную настройку колонок, возвращая текущий исходный вид таблицы из конструктора.
Повторный выбор уже выбранного варианта тоже применяет его: можно заново восстановить шаблон или сбросить колонки через «Без шаблона».
Остальные фильтры ресурса — Data Scope, ассоциации, поиск и ограничения доступа — сохраняются.
После открытия страницы сохранённый шаблон автоматически не выбирается. Обычные персональные колонки
сохраняются прежним механизмом; явный выбор «Без шаблона» сбрасывает их.

«Сохранить как новый» создаёт полный снимок текущего состояния таблицы. «Обновить шаблон» изменяет выбранную
запись только по явному нажатию. Обычные изменения фильтра, порядка, состава и ширины колонок не изменяют
сохранённый шаблон. Переименование меняет только название. Удаление шаблона оставляет текущий вид таблицы.

Шаблоны привязаны к UID таблицы и проверенному пути ссылок `ReferenceBlockModel`. Две таблицы одной коллекции
и разные ссылочные экземпляры имеют независимые списки. Строка данных, случайный ID popup и сессия в ключ не входят.

## Архитектура

Исходный рендерер таблицы и её общая схема сохраняются. `PersonalizedTableBlockModel` предоставляет место
для персональных действий. Widget `TableTemplatesBlockModel` объединяет существующие features персонализации
и шаблонов; импорты между соседними features не вводятся. Новая кнопка вставляется перед существующей кнопкой колонок.

`SavedFilterActionModel` наследует штатный редактор, submit/reset и метаданные фильтра, не содержит управления
шаблонами и сохраняет пустой пользовательский фильтр по умолчанию. При наличии кнопки фильтра шаблон применяет
условия через её штатное событие submit. Без кнопки используется отдельная группа того же `MultiRecordResource`;
последующее штатное применение фильтра снимает эту группу, чтобы условия не складывались незаметно.
Режим ручной загрузки данных сохраняется.

Снимок колонок строится по актуальным персональным настройкам после завершения очереди сохранения ширин.
В снимок включаются и заданные исходной таблицей ширины. Выбор шаблона использует операцию `restore`, которая
заменяет доступные ширины целиком, включая удаление старых overrides. Обычное окно «Колонки» по-прежнему
сохраняет порядок/видимость без перезаписи актуальных ширин.

Сначала сохраняются и подготавливаются колонки; только после успеха применяется фильтр. Ошибка восстановления
колонок не заменяет текущие условия. Состояния загрузки, сохранения, применения и ошибок отображаются в окне;
повторные операции блокируются. Ошибка сохранения сохраняет имя и форму. Поздние ответы при смене владельца
или экземпляра игнорируются. Схемы и ACL повторно проверяются сервером.

Сервер сохраняет Onion Architecture: в application/domain находятся сценарии и инварианты,
а HTTP, ORM, транзакции и блокировки находятся во внешних слоях. Для преобразования условий используется
уже установленный платформенный `@nocobase/utils/client`; peer-зависимость закреплена на текущей версии `2.0.60`.
Новая сторонняя библиотека не устанавливалась.

## API и права

Существующее имя ресурса `tableFilterTemplates` сохранено. Все действия вызываются через POST,
параметры передаются непосредственно в теле запроса. Для `update` в строке запроса также передаётся
`filterByTk=<id>`, который NocoBase проверяет до обработки запроса. Его значение должно совпадать с `id` из тела.

| Action   | Параметры сверх `identity: { tableUid, referencePath }`         |
| -------- | --------------------------------------------------------------- |
| `list`   | Нет                                                             |
| `create` | `name`, `filter`, `columnSettings`, `schemaSignature`           |
| `rename` | `id`, `revision`, `name`                                        |
| `update` | `id`, `revision`, `filter`, `columnSettings`, `schemaSignature` |
| `delete` | `id`, `revision`                                                |

Результат: `{ data: { templates, schemaSignature } }`.
Шаблон: `{ id, name, filter, columnSettings, revision }`.
`columnSettings`: `{ version: 1, columnOrder, hiddenColumnUids, columnWidths }`.
Владелец берётся только из серверной аутентификации. Чтение, обновление и удаление выполняются с фильтром
по владельцу и экземпляру. `visibility`, `scopeKey`, `canCreateShared`, клиентский `userId` не поддерживаются.

Добавлена операция POST **`tablePersonalizations:restore`** с телом `{ identity, settings, schemaSignature }`.
Она применяет полный снимок, а `save` по-прежнему сохраняет текущие ширины. Авторизация, полевые права,
проверка схемы и владелец у restore те же, что у остальных действий персонализации.

Проверяются существование таблицы и ссылок, доступ к маршруту, коллекции, полям и ассоциациям. Недоступные
колонки и их ширины не выдаются клиенту. Шаблон с недоступным полем фильтра не возвращается этому пользователю.
Generic API служебных коллекций закрыт, включая root. Идентификатор чужой записи не позволяет её изменить.

Названия: от 1 до 100 символов после trim, без управляющих символов; уникальны для пользователя в экземпляре таблицы.
Фильтр: максимум 65 536 символов JSON, 100 узлов, глубина 10. Колонки используют действующие ограничения:
до 500 UID, корректные скрытые поля, ширины от 50 до 3000 пикселей. Незавершённые условия проверяются на клиенте и сервере.

Создание/обновление проверяет актуальный `schemaSignature`, включая полевые ACL. Конкурентные изменения
защищены блокировкой строки и ревизией. Ошибки: 400 — неверный ввод; 401 — нет входа; 403 — недостаточно прав;
404 — отсутствующая или чужая запись; 409 — устаревшая схема/ревизия либо дубликат имени;
500 — безопасная ошибка с серверным журналированием.

## База данных и переход

Сохранена скрытая коллекция `lc_table_filter_templates`. Добавлено обязательное JSON-поле **`columnSettings`**.
Удалены `visibility` и `scopeKey`. Уникальный индекс `lc_filter_templates_name` теперь охватывает
`(instanceKey, userId, name)`. Индексы по `userId`, `tableUid`, `instanceRootUid` и физические внешние ключи
на пользователя, таблицу и корень экземпляра с каскадами сохранены.

Миграция **`20261102010000-personal-table-templates`** выполняется до загрузки коллекций, чтобы безопасно
добавить обязательное поле к существующей таблице. В транзакции она добавляет nullable-поле, удаляет старые
шаблоны без снимка колонок, снимает старый индекс и поля доступности, делает снимок обязательным и создаёт
новый индекс. Удаление старых шаблонов прямо разрешено пользователем в задаче. Бизнес-записи и текущие
персональные настройки колонок не удаляются.

Миграция повторяема: новые полные шаблоны при повторном запуске сохраняются. При свежей установке таблицу
и индексы создаёт штатная синхронизация определения коллекции; дополнительные DDL не дублируются.
Переход forward-only: удалённые старые шаблоны не восстанавливаются откатом миграции.

С версии 2.0.75 скрытая коллекция `lc_table_template_initializations` фиксирует однократное создание начальных
шаблонов. Уникальный индекс `(userId, instanceKey)` защищает от повторной инициализации. Запись о создании и
шаблоны сохраняются в одной транзакции. Миграция `20261109010000-template-initialization-cascades` добавляет
каскадное удаление отметки при удалении пользователя, таблицы или корня экземпляра. Существующие шаблоны
сохраняются.

## Установка

```sh
PLUGIN_PACKAGE_PREFIX=@nocobase/plugin-,@nocobase/preset-,@nocobase/plugin-pro-,@log-company/plugin- corepack yarn build @log-company/plugin-table-personalization
corepack yarn tar @log-company/plugin-table-personalization
docker compose exec -T app yarn pm update /app/nocobase/storage/tar/@log-company/plugin-table-personalization-2.0.75.tgz
docker compose exec -T app yarn nocobase upgrade --skip-code-update
docker compose restart app
```

Перезагрузить страницу после установки. Runtime-копии в `storage/plugins/` вручную не редактируются.
Рабочие Docker volumes, `.env` и файловые хранилища не пересоздаются.

Визуальную проверку выполняет пользователь по его просьбе.

## Изменённые файлы

Пути относительно `packages/plugins/@log-company/plugin-table-personalization/`.

| Файл                                                                                                      | Назначение                                                                       |
| --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `package.json`                                                                                            | Версия 2.0.72 и закреплённая peer-зависимость существующего платформенного utils |
| `src/client/app/plugin.ts`                                                                                | Регистрация таблицы с отдельной кнопкой шаблонов                                 |
| `src/client/features/filter-templates/index.ts`                                                           | Публичный API feature для widget                                                 |
| `src/client/features/filter-templates/model/FilterTemplatesController.ts`                                 | Личные шаблоны, подготовка снимка, блокировка операций и применение              |
| `src/client/features/filter-templates/model/SavedFilterActionModel.tsx`                                   | Возврат штатного окна фильтра и его метаданных; снятие отдельной группы условий  |
| `src/client/features/filter-templates/model/TableTemplateHost.ts`                                         | Контракт между UI шаблонов и таблицей                                            |
| `src/client/features/filter-templates/model/__tests__/FilterTemplatesController.test.ts`                  | Регрессионные проверки обновлённого поведения и контрактов                       |
| `src/client/features/filter-templates/model/__tests__/SavedFilterActionModel.test.tsx`                    | Регрессионные проверки обновлённого поведения и контрактов                       |
| `src/client/features/filter-templates/ui/FilterTemplatesToolbar.tsx`                                      | Управление полными шаблонами без выбора доступности                              |
| `src/client/features/filter-templates/ui/TableTemplatesButton.tsx`                                        | Отдельная кнопка «Шаблоны» с доступным именем                                    |
| `src/client/features/filter-templates/ui/__tests__/FilterTemplatesToolbar.test.tsx`                       | Регрессионные проверки обновлённого поведения и контрактов                       |
| `src/client/features/table-personalization/api/TablePersonalizationApi.ts`                                | Запрос восстановления полного снимка с ширинами                                  |
| `src/client/features/table-personalization/api/__tests__/TablePersonalizationApi.test.ts`                 | Регрессионные проверки обновлённого поведения и контрактов                       |
| `src/client/features/table-personalization/model/PersonalizationController.ts`                            | Восстановление через выделенную операцию restore                                 |
| `src/client/features/table-personalization/model/PersonalizedTableBlockModel.tsx`                         | Снимок актуальных колонок и место для персональных действий                      |
| `src/client/features/table-personalization/model/__tests__/PersonalizationController.test.ts`             | Регрессионные проверки обновлённого поведения и контрактов                       |
| `src/client/features/table-personalization/model/__tests__/PersonalizedTableBlockModel.creation.test.tsx` | Регрессионные проверки обновлённого поведения и контрактов                       |
| `src/client/features/table-personalization/ui/__tests__/ColumnSettingsButton.test.tsx`                    | Регрессионные проверки обновлённого поведения и контрактов                       |
| `src/client/features/table-personalization/ui/__tests__/ColumnWidthHeader.test.tsx`                       | Регрессионные проверки обновлённого поведения и контрактов                       |
| `src/client/shared/lib/index.ts`                                                                          | Публичный экспорт ключа группы фильтра                                           |
| `src/client/shared/lib/templateFilterKey.ts`                                                              | Единый ключ фильтра шаблона для таблицы без кнопки фильтра                       |
| `src/client/widgets/table-templates/index.ts`                                                             | Публичный API widget                                                             |
| `src/client/widgets/table-templates/model/TableTemplatesBlockModel.tsx`                                   | Объединение шаблонов, фильтра и персональных колонок; порядок кнопок             |
| `src/client/widgets/table-templates/model/__tests__/TableTemplatesBlockModel.test.tsx`                    | Регрессионные проверки обновлённого поведения и контрактов                       |
| `src/server/__tests__/PersonalizationsPostgres.integration.test.ts`                                       | Интеграционные проверки PostgreSQL: личные шаблоны, restore, миграция и каскады  |
| `src/server/application/FilterTemplatePorts.ts`                                                           | Порты хранилища с обязательным владельцем и колонками                            |
| `src/server/application/TableFilterTemplates.ts`                                                          | Сохранение фильтра и колонок; проверка схемы и личного доступа                   |
| `src/server/application/TablePersonalizations.ts`                                                         | Применение полного снимка через restore                                          |
| `src/server/application/__tests__/TableFilterTemplates.test.ts`                                           | Регрессионные проверки обновлённого поведения и контрактов                       |
| `src/server/collections/tableFilterTemplates.ts`                                                          | Поле columnSettings и уникальность имени по владельцу/таблице                    |
| `src/server/composition/TableFilterTemplateModule.ts`                                                     | Связывание сценариев без привилегии root на чужие шаблоны                        |
| `src/server/domain/FilterTemplate.ts`                                                                     | Удаление правил общих шаблонов с сохранением валидации фильтра                   |
| `src/server/domain/RestoreColumnSettings.ts`                                                              | Замена доступных ширин с сохранением непрозрачных настроек                       |
| `src/server/domain/__tests__/FilterTemplate.test.ts`                                                      | Регрессионные проверки обновлённого поведения и контрактов                       |
| `src/server/domain/__tests__/RestoreColumnSettings.test.ts`                                               | Регрессионные проверки обновлённого поведения и контрактов                       |
| `src/server/infrastructure/NocoBaseFilterTemplateRepository.ts`                                           | Выборка и изменение только шаблонов текущего владельца                           |
| `src/server/interfaces/TableFilterTemplateController.ts`                                                  | Обновлённый личный API                                                           |
| `src/server/interfaces/TablePersonalizationController.ts`                                                 | Регистрация и валидация операции restore                                         |
| `src/server/interfaces/__tests__/TableFilterTemplateController.test.ts`                                   | Регрессионные проверки обновлённого поведения и контрактов                       |
| `src/server/interfaces/__tests__/TablePersonalizationController.test.ts`                                  | Регрессионные проверки обновлённого поведения и контрактов                       |
| `src/server/migrations/20261102010000-personal-table-templates.ts`                                        | Переход схемы и разрешённая очистка старых шаблонов                              |
| `src/shared/filterTemplates.ts`                                                                           | Контракт личного полного снимка без общих шаблонов                               |

Документация: `docs/log-company/FILTER_TEMPLATES.md` — новый контракт и отчёт;
`docs/log-company/TABLE_PERSONALIZATION_PLUGIN.md` — актуальный порядок кнопок, версия и API restore.

## Выполненные проверки — 2 ноября 2026

- `corepack yarn eslint --fix --no-ignore <затронутые TS/TSX-файлы из перечня выше>` — успешно.
- `node node_modules/prettier/bin/prettier.cjs --check --ignore-path /dev/null <затронутые файлы>` — успешно.
- `git diff --check -- packages/plugins/@log-company/plugin-table-personalization docs/log-company/FILTER_TEMPLATES.md docs/log-company/TABLE_PERSONALIZATION_PLUGIN.md` — успешно.
- `node --max-old-space-size=8192 packages/plugins/@log-company/plugin-table-personalization/scripts/check-types.cjs` — **0 строгих диагностик**, включая тесты.
- `corepack yarn typecheck:log-company:domain` — успешно.
- `corepack yarn test:architecture` — **24 проверки прошли**.
- `corepack yarn test:client packages/plugins/@log-company/plugin-table-personalization/src/client --run --maxWorkers=1 --minWorkers=1 --silent` — **94 теста в 13 файлах прошли**.
- `TABLE_PERSONALIZATION_POSTGRES_INTEGRATION=1 DB_DIALECT=postgres DB_HOST=127.0.0.1 DB_PORT=15435 DB_USER=nocobase DB_DATABASE=table_personalization_test_templates DB_TEST_PREFIX=table_personalization_test_templates corepack yarn vitest run --config packages/plugins/@log-company/vitest.config.ts plugin-table-personalization --maxWorkers=1 --minWorkers=1 --silent` — **161 проверка в 13 файлах прошла**, включая 24 PostgreSQL интеграционных сценария. Серверные тесты выполнялись последовательно в отдельном временном контейнере.

Проверены независимость одинаковых личных шаблонов двух пользователей, запрет чужих изменений для root,
скрытие недоступных полей, точное восстановление ширин, сброс к общей таблице, положение кнопки слева от
«Колонки», неизменность общей схемы, отсутствие кнопки фильтра, операторы без значения, повторы,
конкурентные изменения, HTTP-ошибки и повторный запуск миграции с сохранением новых шаблонов.

## Установка и проверка runtime — 2 ноября 2026

- Сборка и упаковка командами из раздела «Установка» завершились успешно.
- `docker compose exec -T app yarn pm update /app/nocobase/storage/tar/@log-company/plugin-table-personalization-2.0.72.tgz`,
  `docker compose exec -T app yarn nocobase upgrade --skip-code-update`, `docker compose restart app` — успешно.
- Плагин включён; установленная версия **2.0.72**. SHA-256 установленного клиентского файла совпадает с финальной сборкой исходников.
- SQL-проверка подтвердила `columnSettings NOT NULL`, отсутствие `visibility` / `scopeKey`
  и уникальный индекс `(instanceKey, userId, name)`. До миграции старых шаблонов было **0**, фактическое удаление записей не потребовалось.
- HTTP через `curl`: `/signin` — **200**; POST `tableFilterTemplates:list` и `tablePersonalizations:restore` без входа — **401**.
- Изолированная тестовая PostgreSQL остановлена и удалена. Рабочие volumes и файлы конфигурации не пересоздавались.
- Визуальная проверка не выполнялась по прямой просьбе пользователя.

## Файлы версии 2.0.75

Пути `src/` и `package.json` относятся к `packages/plugins/@log-company/plugin-table-personalization/`.

| Файл                                                                           | Изменение                                                                             |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| `package.json`                                                                 | Версия плагина 2.0.75                                                                 |
| `src/client/features/filter-templates/api/FilterTemplateApi.ts`                | Параметр `filterByTk` в HTTP-запросе обновления                                       |
| `src/client/features/filter-templates/api/__tests__/FilterTemplateApi.test.ts` | Проверка параметра в запросе                                                          |
| `src/server/application/FilterTemplatePorts.ts`                                | Порт однократного сохранения начальных шаблонов                                       |
| `src/server/application/TableFilterTemplates.ts`                               | Инициализация при открытии личного списка                                             |
| `src/server/application/__tests__/TableFilterTemplates.test.ts`                | Проверка таблицы без начальных вариантов                                              |
| `src/server/application/ports.ts`                                              | Доступные варианты статусов в метаданных таблицы                                      |
| `src/server/collections/tableTemplateInitializations.ts`                       | Коллекция отметок и индексы                                                           |
| `src/server/composition/TableFilterTemplateModule.ts`                          | Регистрация защиты служебных коллекций                                                |
| `src/server/domain/StatusTemplateDrafts.ts`                                    | Условия по статусам и исходный состав колонок                                         |
| `src/server/domain/__tests__/StatusTemplateDrafts.test.ts`                     | Проверки снимка, дубликатов и ограничений                                             |
| `src/server/infrastructure/NocoBaseFilterTemplateRepository.ts`                | Транзакционное создание личных шаблонов и отметки                                     |
| `src/server/infrastructure/NocoBaseTableConfiguration.ts`                      | Чтение доступных статусов и их подписей                                               |
| `src/server/infrastructure/__tests__/NocoBaseTableConfiguration.test.ts`       | Типизация тестовых моделей конфигурации                                               |
| `src/server/interfaces/TableFilterTemplateController.ts`                       | Сверка идентификатора и защита коллекций                                              |
| `src/server/interfaces/__tests__/TableFilterTemplateController.test.ts`        | Проверки идентификатора и закрытого служебного API                                    |
| `src/server/migrations/20261109010000-template-initialization-cascades.ts`     | Каскадные внешние ключи                                                               |
| `src/server/__tests__/PersonalizationsPostgres.integration.test.ts`            | Проверки HTTP, прав, независимости копий, параллельного открытия, удаления и миграции |
| `docs/log-company/FILTER_TEMPLATES.md`                                         | Контракт, поведение, миграция и результаты проверок                                   |
| `docs/log-company/TABLE_PERSONALIZATION_PLUGIN.md`                             | Версия, установка и описание начальных вариантов                                      |

## Проверки версии 2.0.75

- `corepack yarn eslint --fix --no-ignore <изменённые TS-файлы>` и `node node_modules/prettier/bin/prettier.cjs --check --ignore-path /dev/null <изменённые файлы>` прошли. `git diff --check` прошёл.
- `node --max-old-space-size=8192 packages/plugins/@log-company/plugin-table-personalization/scripts/check-types.cjs` прошёл с 0 диагностик. `corepack yarn typecheck:log-company:domain` прошёл.
- `corepack yarn test:architecture` прошёл, 24 проверки.
- `corepack yarn test:client packages/plugins/@log-company/plugin-table-personalization/src/client --run --maxWorkers=1 --minWorkers=1 --silent` прошёл, 95 тестов.
- `TABLE_PERSONALIZATION_POSTGRES_INTEGRATION=1 DB_DIALECT=postgres DB_HOST=127.0.0.1 DB_PORT=15436 DB_USER=nocobase DB_DATABASE=table_personalization_test_status DB_TEST_PREFIX=table_personalization_test_status corepack yarn vitest run --config packages/plugins/@log-company/vitest.config.ts plugin-table-personalization --maxWorkers=1 --minWorkers=1 --silent` прошёл, 172 теста, включая 26 интеграционных. Проверены запрос `update` через штатный HTTP-обработчик NocoBase, параллельная инициализация, доступ к полю статуса, локализованные подписи, повторяемость миграции и каскадное удаление.
- Сборка и упаковка командами из раздела «Установка» прошли. Архив содержит клиентскую сборку, определение коллекции и миграцию.
- `docker compose exec -T app yarn pm update /app/nocobase/storage/tar/@log-company/plugin-table-personalization-2.0.75.tgz`, `docker compose exec -T app yarn nocobase upgrade --skip-code-update` и `docker compose restart app` прошли. Установленная версия 2.0.75 включена, SHA-256 клиентского файла совпал со сборкой.
- Read-only запросы через `docker compose exec -T postgres psql` подтвердили запись о миграции, уникальный индекс владельца и экземпляра, индексы таблицы и корня, три каскадных внешних ключа. До и после обновления в рабочей базе было 0 сохранённых шаблонов.
- HTTP-проверка `curl` после перезапуска прошла. `/signin` вернул 200. Запросы `tableFilterTemplates:list` и `tableFilterTemplates:update` с параметром `filterByTk` для обновления вернули 401 без входа.
- `graphify update .` обновил граф кода. Визуальную проверку выполняет пользователь.
