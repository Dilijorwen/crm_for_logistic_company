# Регрессия создания EditFormModel

## Первопричина

Регрессию внёс коммит `688dbf4f6540dde02730a574fb940319b89f81df`
(`fix(process-governance): synchronize shipment edits with runs`), предшествующий `79e3907`.
В `plugin-process-governance/src/client/index.ts` штатная регистрация заменена на
`EditFormModel: ShipmentSynchronizedEditFormModel`. Новый подкласс в
`src/client/logistics/ShipmentSynchronizedEditFormModel.ts` переопределял создание ресурса, но не регистрировал
метаданные исходной модели.

`FlowModel.define()` сохраняет метаданные в `WeakMap`, ключом которой является сам класс.
`FlowModel.meta` читает `modelMetas.get(this)`. Наследование класса не переносит запись в этой карте.
Переименование подкласса в `EditFormModel` при `FlowEngine.registerModels()` также не переносит метаданные.
В отличие от метаданных, регистрация flows поддерживает цепочку наследования.

У штатного `EditFormModel` метаданные включают название, порядок в меню, параметры поиска и:

```ts
createModelOptions: {
  use: 'EditFormModel',
  subModels: { grid: { use: 'FormGridModel' } },
}
```

Без этих метаданных `CollectionBlockModel.defineChildren()` формирует параметры выбранной коллекции,
но теряет конфигурацию дочерней сетки. `AddSubModelButton` создаёт и сохраняет такую форму.
Унаследованный flow `formModelSettings.layout` вызывает штатное действие `layout`, которое обращается к
`ctx.model.subModels.grid.findSubModel()`. Сетки нет, поэтому первый render завершается исключением.
Существующие формы работают, потому что их сохранённые `subModels` уже содержат сетку и поля.

## Подтверждение

### Логи и установленная сборка

В `system_error_2026-10-09.log`, строки 359–364, зафиксированы два одинаковых frontend-сбоя:

```text
undefined is not an object (evaluating 'n.model.subModels.grid.findSubModel')
handler@http://localhost:13000/p__index.b16725d2.async.js:716:7521
@http://localhost:13000/p__index.b16725d2.async.js:2466:14458
```

Диагностика относится к новым формам `a9d9351ea67` для `chinese_clients` и `fd616213fc9` для `transport_runs`.
В request-логе, строки 2020 и 2082, `flowModels:save` возвращает `200` для обеих форм,
но в сохраняемых конфигурациях отсутствует `subModels.grid`. Ошибки авторизации других запросов
не являются причиной этого сбоя.

Установленный bundle NocoBase 2.0.60 прочитан по указанным в stack trace координатам:
строка 716 содержит действие `layout` с `n.model.subModels.grid.findSubModel(...)`,
строка 2466 — выполнение handler в executor FlowEngine. Соответствующие исходники:

- `packages/core/client/src/flow/models/blocks/form/EditFormModel.tsx`: штатные метаданные создания;
- `packages/core/flow-engine/src/models/flowModel.tsx`: `meta`, `define()`, `_createSubModels()`;
- `packages/core/client/src/flow/models/base/CollectionBlockModel.tsx`: `defineChildren()`;
- `packages/core/client/src/flow/actions/layout.tsx`: обращение к сетке;
- `packages/core/client/src/flow/models/blocks/form/FormBlockModel.tsx`: flow `formModelSettings`.

До обновления ошибка дополнительно воспроизведена в авторизованном интерфейсе локального приложения:
карточка рейса открыла `fd616213fc9` и показала `Render failed` с тем же stack trace.

### Git и воспроизведение

`git show 79e3907` проверен: он переносит статус с рейсов на поставки и не меняет регистрацию или подкласс формы.
В текущей ветке `79e3907` является HEAD; последующих коммитов нет. Проверены также незакоммиченные изменения
и регистрации моделей остальных собственных плагинов. Они не меняют эту регистрацию `EditFormModel`.
`git blame` строки регистрации и история файла подкласса указывают на `688dbf4`.

Регрессионный тест использует реальные `Application`, загрузку плагина, `FlowEngine`,
`CollectionBlockModel.defineChildren()`, `FormGridModel` и действие `layout`.
До исправления три сценария создания — для поставок, рейсов и китайских клиентов — падают с:

```text
TypeError: Cannot read properties of undefined (reading 'findSubModel')
```

Четвёртая проверка подтверждает отсутствие метаданных подкласса. Загрузка уже сохранённой сетки,
синхронизация поставок и штатная форма создания записи проходят и до исправления: результат `4 failed, 3 passed`.
Добавленная контрольная проверка штатной формы без замены регистрации также проходит.
После исправления все восемь проверок проходят.

## Исправление

Подкласс явно регистрирует исходные метаданные через `ShipmentSynchronizedEditFormModel.define(editFormMeta)`.
Перед регистрацией проверяется наличие метаданных базового класса; отсутствующее определение не подменяется
значением по умолчанию и не игнорируется. Не вводится отдельная форма или альтернативный способ её создания.
Штатные `use: 'EditFormModel'`, дочерняя сетка, параметры меню и унаследованные flows сохраняются.
Синхронизация сохранённых поставок остаётся ограниченной ресурсами `shipments`.

Изменены только:

- `packages/plugins/@log-company/plugin-process-governance/src/client/logistics/ShipmentSynchronizedEditFormModel.ts`;
- новый тест `src/client/logistics/__tests__/ShipmentSynchronizedEditFormModel.creation.test.ts`;
- версия плагина: `2.0.93` в исходном рабочем дереве → `2.0.94`;
- `docs/log-company/PROCESS_GOVERNANCE_PLUGIN.md` и этот отчёт.

Схема БД, миграции, индексы, связи, бизнес-правила, ACL и перенос статуса не изменяются.
Существовавшие до задачи незакоммиченные изменения сохранены.

## Автоматические проверки

Фактически выполнены из корня проекта:

- `corepack yarn eslint --fix` для двух изменённых TypeScript-файлов — успешно, без предупреждений;
- `corepack yarn test:client packages/plugins/@log-company/plugin-process-governance --run --reporter=verbose`
  — 10 файлов, 46 тестов пройдено;
- повторный запуск файла регрессии после финальных изменений — 8 тестов пройдено;
- `corepack yarn test:server packages/plugins/@log-company/plugin-process-governance/src/server --run --reporter=verbose --no-file-parallelism --maxWorkers=1 --minWorkers=1`
  — 36 файлов, 109 тестов пройдено, включая интеграционные проверки истории и тесты переноса статуса/ACL;
- `corepack yarn tsc --noEmit --project packages/plugins/@log-company/tsconfig.build.json`
  — общий typecheck не проходит: при первоначальном запуске получено 574 диагностики, включая отсутствующие
  декларации `@nocobase/client` и ошибки strict-типизации upstream `plugin-file-manager`;
- отдельная строгая проверка двух изменённых файлов через TypeScript Compiler API с реальными исходниками
  зависимостей из `tsconfig.paths.json` — успешно; проверяются синтаксические и семантические диагностики обоих файлов;
- `corepack yarn build @log-company/plugin-process-governance` — успешно;
- `corepack yarn tar @log-company/plugin-process-governance` — успешно;
- `git diff --check` — успешно.

Скрипт отдельной проверки находится в `/tmp/check-edit-form-types.cjs` и запускается командой
`node --max-old-space-size=8192 /tmp/check-edit-form-types.cjs`.
Проверка всего проекта не считается пройденной; диагностики несвязанных файлов не подавляются и не исправляются
массовым рефакторингом в рамках этой задачи.

## Проверка установленного приложения

В локальный Docker-runtime NocoBase 2.0.60 установлен пакет `2.0.94` штатной командой:

```bash
docker compose exec -T app yarn pm update /app/nocobase/storage/tar/@log-company/plugin-process-governance-2.0.94.tgz
docker compose restart app
docker compose ps
```

Plugin manager сам выполняет штатное обновление приложения. Дополнительные миграции этой задачей не добавлялись.
Версия установленного плагина проверена; SHA-256 клиентского bundle в `dist/client/index.js`
и в установленном пакете совпадает:
`756e6fc34304f235847aa9a14b830266b23fa572ff5d075db835c6e9ead577a0`.
Runtime-файлы вручную не редактировались.

В авторизованном интерфейсе под ролью `root`:

1. В popup стандартного действия таблицы рейсов создана отдельная вкладка «Проверка EditFormModel».
2. Через «Добавить блок → Форма (Редактировать) → Текущая запись» создан новый штатный `EditFormModel`
   `2455b3ba8e3` для `transport_runs` с дочерним `FormGridModel` `3ea6c10fe0d`.
3. Через штатное меню полей добавлено «Номер машины». Поле получило значение текущего рейса.
4. Через меню действий добавлен штатный `FormSubmitActionModel`.
5. Конфигурация формы, сетки, поля и действия сохранена через `flowModels:save`; наличие соответствующих записей
   подтверждено чтением БД. После перезагрузки формы поле и действие присутствуют, ошибки render нет.
6. Отправка неверного значения `!` получила `422` и сообщение валидации номера машины.
   После восстановления исходного значения отправка получила `200`.
   В этой ручной проверке бизнес-значение записи намеренно не изменялось; сохранение изменённых значений
   проверяется интеграционными тестами. Реальные данные не использовались как расходные тестовые записи.
7. Ранее настроенная форма клиента `ebcbb235b9b` открыта с её существующими полями, значениями и действием отправки.
8. Созданные для проверки семь моделей вкладки и их 67 записей дерева удалены в одной транзакции.
   Уборка ограничена точными UID, проверяет название тестовой вкладки и отсутствие чужих потомков.
   Исходные модели не менялись. Контрольные суммы `options` всех `flowModels` и список UID
   полностью совпадают со снимком до установки и UI-проверки.
9. Режим конструктора возвращён в исходное выключенное состояние.

Скриншот созданной формы после повторной загрузки сохранён локально в `/tmp/edit-form-verification.jpg`.
Архив сборки находится в `storage/tar/@log-company/plugin-process-governance-2.0.94.tgz` и не добавляется в Git.

Ручное переключение на каждую рабочую роль не выполнялось: UI-проверка проводилась под `root`.
Сохранение контракта ACL формы проверено регрессионным тестом (`update`), перенос полевых прав — серверными тестами
миграций; сама авторизация и её исходный код этим исправлением не изменены.
