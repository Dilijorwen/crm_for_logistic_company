# Исправления обсуждения, колонок истории и старых коллекций — 4 ноября 2026

## Выполнено

- Исправлено прикрепление загруженных файлов к обсуждению поставки от роли менеджера.
- Технический первичный ключ `id` и физические внешние ключи больше не предлагаются как дополнительные
  персональные колонки, включая историю поставок, историю рейсов и историю в боковой панели.
- Коллекции старой модели процессов скрыты в конструкторе. Если `customs_processes` больше не зарегистрирована,
  эти коллекции также исключаются из каталога настройки прав ролей.
- Собраны и установлены `plugin-process-discussion` **2.0.69**, `plugin-table-personalization` **2.0.74**,
  `plugin-process-governance` **2.0.117**. Применена миграция, локальное приложение перезапущено.

## Причины и архитектурные решения

### Вложения обсуждения

В действующем приложении `attachments:create` возвращал 200. Затем клиент отправлял
`shipment_comments:create` с `updateAssociationValues: ['attachment']`. Это требовало права изменения
целевых записей `attachments`. У менеджера такого права нет, поэтому штатный ACL удалял ID вложений из запроса.
Сам комментарий сохранялся, иногда с одним пробелом вместо текста.

Типизированный API-клиент теперь передаёт только ссылки на ранее загруженные файлы. Он не запрашивает изменение
самих файлов. Проверки ACL исходной коллекции и разрешённых полей сохранены; новые права ролям не выдавались.
Проверка с настоящим NocoBase ACL и SQLite воспроизводит исчезновение вложений при возврате прежнего параметра.

### Колонки

NocoBase автоматически добавляет первичный ключ к разрешённым полям чтения для привязки записей. Ранее каталог
персонализации воспринимал это как возможность добавить ID в интерфейс. Сервер исключает технические ID и
внешние ключи из дополнительных полей. Их прежние сохранённые UID остаются непрозрачными и не применяются.
Колонки, явно включённые дизайнером в общую схему, продолжают использовать штатную проверку ACL.

### Старые процессы

На момент проверки таблицы `process_comments`, `process_history` и трёх связей процессов не содержали записей;
физической таблицы `customs_processes` уже не было. Сохранённые модели интерфейса с историческими ссылками остались,
поэтому физическое удаление и массовая очистка ссылок не выполнялись.

Каталог `roles.dataSourcesCollections:list` в NocoBase 2.0.60 игнорирует свой фильтр `hidden` и читает runtime-
коллекции напрямую. Дополнительный middleware исключает только известные устаревшие имена после штатной
авторизации. Внешние источники данных и приложения с действующей коллекцией `customs_processes` не фильтруются.
Активные `shipment_comments`, `process_documents` и `process_document_folders` сохранены в настройке прав.

Новые зависимости не добавлялись. Runtime-копии получены штатной сборкой и установкой пакетов.

## Изменённые файлы

Пути указаны относительно корня репозитория.

| Файл                                                                                                                                             | Назначение                                                                              |
| ------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| `packages/plugins/@log-company/plugin-process-discussion/src/client/entities/discussion/api/DiscussionCommentsApi.ts`                            | Отправка комментария с ссылками на загруженные файлы                                    |
| `packages/plugins/@log-company/plugin-process-discussion/src/client/entities/discussion/index.ts`                                                | Публичный экспорт API сущности                                                          |
| `packages/plugins/@log-company/plugin-process-discussion/src/client/entities/discussion/api/__tests__/DiscussionCommentsApi.test.ts`             | Регрессия с настоящим ACL и SQLite: текст, файл без текста, запрет поля, ошибка запроса |
| `packages/plugins/@log-company/plugin-process-discussion/src/client/widgets/process-discussion/ui/ProcessDiscussionBlock.tsx`                    | Подключение исправленной отправки                                                       |
| `packages/plugins/@log-company/plugin-process-discussion/package.json`                                                                           | Версия 2.0.69                                                                           |
| `packages/plugins/@log-company/plugin-table-personalization/src/server/infrastructure/NocoBaseTableConfiguration.ts`                             | Исключение технических ключей из дополнительных колонок                                 |
| `packages/plugins/@log-company/plugin-table-personalization/src/server/infrastructure/__tests__/NocoBaseTableConfiguration.test.ts`              | Проверки каталога, явно настроенной колонки и отказа доступа                            |
| `packages/plugins/@log-company/plugin-table-personalization/package.json`                                                                        | Версия 2.0.74                                                                           |
| `packages/plugins/@log-company/plugin-process-governance/src/shared/legacyProcessCollections.ts`                                                 | Закрытый список устаревших коллекций                                                    |
| `packages/plugins/@log-company/plugin-process-governance/src/server/interfaces/http/LegacyProcessCollectionsCatalog.ts`                          | Фильтрация старых коллекций в настройке ролей                                           |
| `packages/plugins/@log-company/plugin-process-governance/src/server/interfaces/http/__tests__/LegacyProcessCollectionsCatalog.test.ts`           | Проверки обоих каталогов, внешнего источника, старого приложения и отказа ACL           |
| `packages/plugins/@log-company/plugin-process-governance/src/server/plugin.ts`                                                                   | Регистрация middleware каталога                                                         |
| `packages/plugins/@log-company/plugin-process-governance/src/server/collections/processHistory.ts`                                               | Скрытость старой истории при регистрации схемы                                          |
| `packages/plugins/@log-company/plugin-process-governance/src/server/migrations/20261104010000-hide-legacy-process-collections.ts`                | Идемпотентное скрытие старых коллекций в метаданных                                     |
| `packages/plugins/@log-company/plugin-process-governance/src/server/migrations/__tests__/20261104010000-hide-legacy-process-collections.test.ts` | Сохранность архивных строк, действующих документов и повторный запуск миграции          |
| `packages/plugins/@log-company/plugin-process-governance/package.json`                                                                           | Версия 2.0.117                                                                          |
| `docs/log-company/PROCESS_DISCUSSION_PLUGIN.md`                                                                                                  | Причина исправления и минимальные права                                                 |
| `docs/log-company/TABLE_PERSONALIZATION_PLUGIN.md`                                                                                               | Правило служебных идентификаторов                                                       |
| `docs/log-company/PROCESS_GOVERNANCE_PLUGIN.md`                                                                                                  | Архивирование старых коллекций и каталог ролей                                          |
| `docs/log-company/ROLE_ACCESS_FIXES_2026-11-04.md`                                                                                               | Отчёт о проверках и установке                                                           |

`graphify update .` обновил производные файлы графа: `graphify-out/graph.json`, `graphify-out/graph.html`
и `graphify-out/GRAPH_REPORT.md`.

## База данных

Новых таблиц, колонок, индексов и связей нет. Миграция
`20261104010000-hide-legacy-process-collections` меняет только `collections.hidden` для фиксированного списка
старых коллекций. Строки бизнес-данных, физические таблицы, существующие ACL и сохранённые ссылки не удаляются.
После обновления проверено: `process_comments` и `process_history` скрыты, а действующие коллекции документов
поставки остаются видимыми.

## Проверки

Все команды выполнялись из корня проекта. Дополнительно выполнены
`node node_modules/prettier/bin/prettier.cjs --check --ignore-path /dev/null` для затронутых TS/TSX и JSON:
все файлы соответствуют стилю. Четыре изменённых Markdown-документа отформатированы через `--write`.

| Команда                                                                                                                                                                                                                                                                                                                                                                          | Результат                                                                                                       |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `corepack yarn eslint --fix --no-ignore <изменённые TypeScript-файлы>`                                                                                                                                                                                                                                                                                                           | Выполнено для всех затронутых TS/TSX; ошибок нет                                                                |
| `corepack yarn typecheck:log-company:client`                                                                                                                                                                                                                                                                                                                                     | 0 ошибок                                                                                                        |
| `corepack yarn typecheck:log-company:server`                                                                                                                                                                                                                                                                                                                                     | 0 ошибок после финального изменения middleware                                                                  |
| `corepack yarn typecheck:log-company:domain`                                                                                                                                                                                                                                                                                                                                     | Успешно                                                                                                         |
| `corepack yarn vitest run --config packages/plugins/@log-company/vitest.config.ts plugin-process-discussion plugin-table-personalization plugin-process-governance/src/server/migrations/__tests__/20261104010000-hide-legacy-process-collections.test.ts plugin-process-governance/src/server/collections/__tests__/logisticsCollections.test.ts --maxWorkers=1 --minWorkers=1` | 167 пройдено, 24 PostgreSQL-проверки пропущены по условиям окружения                                            |
| `corepack yarn vitest run --config packages/plugins/@log-company/vitest.config.ts plugin-process-governance/src/server/interfaces/http/__tests__/LegacyProcessCollectionsCatalog.test.ts --maxWorkers=1 --minWorkers=1`                                                                                                                                                          | 6 пройдено после финального изменения                                                                           |
| `corepack yarn test:client packages/plugins/@log-company/plugin-table-personalization/src/client --run --maxWorkers=1 --minWorkers=1`                                                                                                                                                                                                                                            | 94 пройдено                                                                                                     |
| `corepack yarn test:client packages/plugins/@log-company/plugin-process-discussion/src/client/widgets/process-discussion/model/__tests__/ProcessDiscussionBlockModel.test.ts packages/plugins/@log-company/plugin-table-personalization/src/client --run --maxWorkers=1 --minWorkers=1`                                                                                          | Фактически выбран и пройден только первый файл: 2 теста; персонализация затем проверена отдельной командой выше |
| `corepack yarn test:architecture`                                                                                                                                                                                                                                                                                                                                                | 24 пройдено, в том числе после добавления middleware                                                            |
| `PLUGIN_PACKAGE_PREFIX=@nocobase/plugin-,@nocobase/preset-,@nocobase/plugin-pro-,@log-company/plugin- corepack yarn build @log-company/plugin-process-discussion`                                                                                                                                                                                                                | Успешно                                                                                                         |
| `PLUGIN_PACKAGE_PREFIX=@nocobase/plugin-,@nocobase/preset-,@nocobase/plugin-pro-,@log-company/plugin- corepack yarn build @log-company/plugin-table-personalization`                                                                                                                                                                                                             | Успешно                                                                                                         |
| `PLUGIN_PACKAGE_PREFIX=@nocobase/plugin-,@nocobase/preset-,@nocobase/plugin-pro-,@log-company/plugin- corepack yarn build @log-company/plugin-process-governance`                                                                                                                                                                                                                | Успешно после финального изменения                                                                              |
| `corepack yarn tar @log-company/plugin-process-discussion`                                                                                                                                                                                                                                                                                                                       | Пакет 2.0.69 собран                                                                                             |
| `corepack yarn tar @log-company/plugin-table-personalization`                                                                                                                                                                                                                                                                                                                    | Пакет 2.0.74 собран                                                                                             |
| `corepack yarn tar @log-company/plugin-process-governance`                                                                                                                                                                                                                                                                                                                       | Пакет 2.0.117 собран                                                                                            |
| `docker compose config --quiet`                                                                                                                                                                                                                                                                                                                                                  | Успешно                                                                                                         |
| `git diff --check`                                                                                                                                                                                                                                                                                                                                                               | Успешно                                                                                                         |
| `graphify update .`                                                                                                                                                                                                                                                                                                                                                              | AST обновлён: 50 133 узла, 138 210 связей; LLM не использовалась                                                |

Команды штатной установки выполнены последовательно:

```sh
docker compose exec -T app yarn pm update /app/nocobase/storage/tar/@log-company/plugin-process-discussion-2.0.69.tgz
docker compose exec -T app yarn pm update /app/nocobase/storage/tar/@log-company/plugin-table-personalization-2.0.74.tgz
docker compose exec -T app yarn pm update /app/nocobase/storage/tar/@log-company/plugin-process-governance-2.0.117.tgz
docker compose exec -T app yarn nocobase upgrade --skip-code-update
docker compose restart app
docker compose ps --format '{{.Service}} {{.State}} {{.Health}}'
```

Миграция отмечена как `migrated`; приложение работает, PostgreSQL и MinIO healthy. Установленные версии трёх
пакетов проверены после перезапуска.

### Проверки действующего приложения

Через `docker compose exec -T app node -e ...` выполнены два inline-сценария с короткоживущей сессией существующего
менеджера, без изменения его ACL и без вывода токенов:

1. Создана временная поставка без рейса, загружен текстовый файл с кириллическим именем. Старый запрос сохранил
   0 вложений, исправленный — 1. Метаданные файла сохранились. Проверка повторена после установки и перезапуска.
   Временные комментарии, поставка и файл удалены штатными API.
2. `tablePersonalizations:get` для `lcwsshiphistorytable`, `lcwsrunhistorytable`, `lcwssidehistory` не возвращает
   ID и физические внешние ключи, но возвращает обычные поля истории. Каталог настройки прав не возвращает
   старые процессы, при этом содержит `shipment_comments`, `process_documents`, `process_document_folders`.

## Неустранённые ограничения

- Пустые сообщения из попыток до исправления автоматически не перепривязывались к файлам: исходный запрос после
  ACL не сохранял эту связь. Такие вложения следует прикрепить повторно после полной перезагрузки страницы.
- Полный сценарий кликов в существующей браузерной сессии менеджера не выполнялся. Проверены компонентные тесты
  и реальные HTTP-запросы под ролью менеджера.
- 24 существующие PostgreSQL integration-проверки требуют отдельной изолированной БД и не запускались.
  Новые DB-регрессии проверены на SQLite, миграция дополнительно применена на действующем PostgreSQL.
- Сборка выдаёт предупреждения о размере имеющихся бандлов и проверке обновлений инструмента. Ошибок сборки нет.
- Обновление графа не обрабатывает один SQL-файл без необязательного `tree_sitter_sql`; существующий upstream-
  файл `GanttBlockProvider.tsx` извлечён частично из-за ошибки синтаксического разбора. Эти файлы не изменялись.
