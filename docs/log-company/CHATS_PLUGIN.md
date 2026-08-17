# @log-company/plugin-chats

## Назначение

`@log-company/plugin-chats` добавляет в CRM отдельный раздел `Чаты` для личных и групповых бесед пользователей NocoBase.

Плагин не использует `process_comments`, не изменяет `customs_processes` и не меняет назначение `@log-company/plugin-process-discussion`. Обсуждения таможенных процессов и общие CRM-чаты остаются двумя независимыми подсистемами.

## Архитектура

Серверная часть следует Onion Architecture:

- `domain` — чистые правила чатов, участников, удаления сообщений и вложений;
- `application` — use cases, DTO и порты репозиториев, транзакций, пользователей и хранилища;
- `infrastructure` — PostgreSQL/NocoBase-репозитории, MinIO, определение MIME, ID, время и логирование;
- `interfaces` — NocoBase resources, HTTP-преобразование, ACL и hook удаления пользователя;
- `composition/ChatModule.ts` — единственная точка сборки зависимостей.

Контроллеры не принимают `authorId` от клиента. Идентификатор действующего пользователя всегда извлекается из авторизованного контекста NocoBase, после чего use case повторно проверяет membership конкретного чата.

## Таблицы

Миграция `20260717130000-create-chat-schema.ts` создаёт четыре таблицы.

### `chats`

- `id bigint` — snowflake ID;
- `type` — `direct` или `group`;
- `title` — только для группы;
- `direct_key` — стабильный ключ пары участников личного чата;
- `created_by_id` — nullable FK на `users` с `ON DELETE SET NULL`;
- `created_at`, `updated_at`, `last_message_at`, `deleted_at`.

Unique index `chats_direct_key_unique` не допускает дубликаты личных чатов даже при конкурентных запросах. У групп ключ равен `NULL`, поэтому индекс не ограничивает количество групповых чатов.

### `chat_members`

- snapshot `member_name` сохраняет отображаемое имя;
- `user_id` — nullable FK на `users`;
- `role` — `owner`, `admin` или `member`;
- `joined_at`, `left_at`, `last_read_at`, `is_muted`.

Частичный unique index разрешает только одно активное membership пользователя в чате, но сохраняет историю выходов и повторных приглашений.

### `chat_messages`

- snapshot `author_name`;
- nullable `author_id` и `deleted_by_id`;
- `text`, `message_type`, `reply_to_message_id`;
- `created_at`, `deleted_at`.

Сообщения загружаются по индексу `(chat_id, created_at DESC, id DESC)`. Удаление только мягкое: текст и вложения перестают выдаваться, а запись истории остаётся.

### `chat_message_attachments`

Хранит метаданные объекта: `storage_key`, исходное имя, MIME, размер и дату. Бинарные данные в PostgreSQL не сохраняются.

Откат миграции удаляет metadata collections и таблицы в обратном порядке. Откат является разрушительной административной операцией и удалит историю чатов, поэтому на рабочей среде перед ним обязателен backup.

Миграция `20260717132000-enforce-chat-schema.ts` выполняется после штатной синхронизации NocoBase и идемпотентно закрепляет CHECK/FK-ограничения и индексы, в том числе когда таблицы были заранее созданы из collection-схем.

## Resources и actions

### `chats`

- `list`, `get`;
- `createDirect`, `createGroup`;
- `addMembers`, `removeMember`, `leave`, `updateGroup`;
- `unreadCount`, `availableUsers`.

### `chatMessages`

- `list`, `send`, `delete`, `markRead`.

### `chatAttachments`

- `upload`, `download`.

Resources доступны только вошедшим пользователям. NocoBase ACL является внешним контуром, а доступ к каждой беседе дополнительно проверяется прикладным `ChatAccessService`.

## Личные и групповые чаты

Для пары пользователей direct key строится независимо от порядка ID. Создание использует `INSERT ... ON CONFLICT DO NOTHING`: победившая транзакция создаёт чат и оба membership, остальные запросы возвращают уже существующий чат.

Создатель группы получает роль `owner`. `owner` и `admin` могут менять название, приглашать и удалять участников. Удалить владельца или выйти владельцем нельзя без передачи владения; отдельный сценарий передачи роли в первой версии не предусмотрен. Добавление, удаление, выход и переименование создают локализуемые системные сообщения.

## История, polling и непрочитанные чаты

История отдаётся курсорно по паре `(created_at, id)`, по 50 сообщений по умолчанию и не более 100. Клиент сохраняет позицию прокрутки при загрузке старых страниц.

`last_read_at` хранится в membership текущего пользователя. Badge показывает число чатов, в которых после этой отметки есть хотя бы одно неудалённое сообщение другого пользователя или системное сообщение. Список, последние сообщения и badge обновляются polling-ом раз в 12 секунд и при возврате вкладки браузера в видимое состояние. Все потребители переменной `$chats` совместно используют один polling badge на API-клиент; это исключает дублирующиеся интервалы при одновременном рендеринге нескольких схем NocoBase.

## Вложения и MinIO

Загрузка проходит через сервер и состоит из следующих стадий:

1. multer сохраняет файлы во временный каталог ОС с лимитами количества и размера;
2. сервер проверяет имя, расширение, заявленный MIME и сигнатуру содержимого;
3. объект записывается под временным MinIO-ключом;
4. сообщение и metadata вложений создаются в транзакции PostgreSQL;
5. объект копируется на финальный ключ `chats/{chatId}/{messageId}/...`;
6. после commit временный объект удаляется.

При ошибке продвижения транзакция откатывается, а временные и возможные финальные объекты удаляются компенсацией. Ошибки компенсации логируются. Скачивание всегда проходит через `chatAttachments:download` и повторно проверяет активное membership пользователя.

Разрешены `txt`, `csv`, `pdf`, изображения и основные форматы Microsoft Office. Максимум — 10 файлов по 25 МБ на сообщение.

## Конфигурация MinIO

В Docker по умолчанию используются:

```dotenv
CHAT_MINIO_ENDPOINT=http://minio:9000
CHAT_MINIO_REGION=us-east-1
CHAT_MINIO_BUCKET=log-company-chats
```

Для доступа плагин сначала читает `CHAT_MINIO_ACCESS_KEY` и `CHAT_MINIO_SECRET_KEY`, а при их отсутствии использует существующие `PROCESS_DOCUMENTS_MINIO_ACCESS_KEY` и `PROCESS_DOCUMENTS_MINIO_SECRET_KEY`. Это позволяет работать с тем же закрытым MinIO-сервисом, но в отдельном bucket. Клиент не получает MinIO credentials или постоянные object keys.

## Удаление пользователя

Hook `users.beforeDestroy` в транзакции удаления:

- завершает активные membership и обнуляет `chat_members.user_id`;
- обнуляет `chat_messages.author_id` и `deleted_by_id`;
- обнуляет `chats.created_by_id`.

Snapshot-поля `member_name` и `author_name`, сообщения и вложения сохраняются. Личный чат становится недоступным для отправки, но оставшийся пользователь продолжает видеть историю с признаком `Пользователь удалён`.

## Клиент

Отдельная страница зарегистрирована по адресу `/admin/chats`, а миграция `20260717131000-register-chats-menu.ts` создаёт пункт desktop menu с badge `$chats.unreadCount`.

Desktop layout состоит из списка бесед и активной переписки. На узком экране список и чат показываются последовательно. Реализованы состояния загрузки, пустого результата и ошибки; повторная отправка блокируется. Все пользовательские строки находятся в словарях `en-US` и `ru-RU`.

Контекст глобальной переменной `$chats` сохраняет ссылочную стабильность, пока не изменился `unreadCount`. Это обязательный инвариант: NocoBase подключает зарегистрированные переменные через `useLocalVariables` во многих блоках, поэтому новый объект из `useCtx()` при каждом рендере вызывает каскадные обновления всего интерфейса.

## Сборка и упаковка

Из корня репозитория:

```bash
corepack yarn build @log-company/plugin-chats
corepack yarn tar @log-company/plugin-chats
```

Tarball создаётся штатной командой NocoBase. Установка выполняется через plugin manager; вручную копировать исходники в `storage/plugins` нельзя.

## Проверки

Основные команды:

```bash
corepack yarn eslint --fix packages/plugins/@log-company/plugin-chats
corepack yarn test packages/plugins/@log-company/plugin-chats/src/server --run --reporter=verbose
corepack yarn test packages/plugins/@log-company/__tests__/OnionBoundaries.test.ts --run --reporter=verbose
corepack yarn e2e packages/plugins/@log-company/plugin-chats/src/client/__e2e__/chats.test.ts
corepack yarn build @log-company/plugin-chats
corepack yarn tar @log-company/plugin-chats
docker compose config --quiet
```

PostgreSQL integration tests защищены от запуска на рабочей БД. Для них обязательны `CHAT_POSTGRES_INTEGRATION=1`, `DB_DIALECT=postgres` и отдельный `DB_TEST_PREFIX`, начинающийся с `chat_test`. MinIO integration включается через `CHAT_MINIO_INTEGRATION=1` и использует отдельный тестовый bucket.
