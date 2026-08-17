# Process Discussion Plugin

## Что установлено

- Плагин: `@log-company/plugin-process-discussion`
- Версия: `2.0.60`
- Блок в конструкторе: `Обсуждение процесса`
- URL локального NocoBase: `http://localhost:13000`
- Docker image: `nocobase/nocobase:2.0.60-full`
- PostgreSQL: `postgres:16`

## Пути

- Исходники: `/Users/daniil/log_company/packages/plugins/@log-company/plugin-process-discussion`
- Установленный пакет: `/Users/daniil/log_company/storage/plugins/@log-company/plugin-process-discussion`
- Tarball: `/Users/daniil/log_company/storage/tar/@log-company/plugin-process-discussion-2.0.60.tgz`
- Backup compose: `/Users/daniil/log_company/backups/docker-compose-20260629-000000.yml`
- Backup DB: `/Users/daniil/log_company/backups/nocobase-20260629-000000.sql.gz`

## Архитектура

Плагин добавляет клиентский `BlockModel` и серверный action для безопасного удаления ещё не отправленных
вложений. Новые коллекции и таблицы не создаются.

Серверная часть разделена по Onion Architecture:

- `domain` — коды ошибок удаления вложений;
- `application` — сценарий удаления pending-вложения и порты;
- `infrastructure` — NocoBase-репозиторий, проверяющий владельца и ссылки на `attachments`;
- `interfaces` — action `processDiscussionAttachments:discard`;
- `composition` — сборка зависимостей и регистрация cascade-настроек.

Блок работает внутри записи коллекции `customs_processes`. Он поддерживает record view и `Form (Edit)`, но целевой сценарий CRM - popup `Form (Edit)` существующего процесса.

Ключ текущего процесса определяется устойчиво, без хардкода UID popup, формы или конкретного ID:

1. Текущая запись ближайшей родительской `Form (Edit)`.
2. Контекст popup действия `Edit`.
3. Текущий record context блока.
4. `filterByTk` / route params как fallback.

Если открыты вложенные popup и в URL присутствует несколько сегментов `filterbytk`, route fallback берёт
правый, то есть ключ записи самого внутреннего popup. Общий разбор маршрута предоставляет
`@log-company/plugin-process-governance` и также используют блоки документов и дерева процесса.

Для обращения к процессу используется `filterByTk` / primary key текущей записи, поэтому блок не завязан только на поле `id`. Сообщения читаются и создаются через association resource `customs_processes.comments`, то есть через существующую связь `customs_processes.comments -> process_comments.process_id`.

Используемые поля:

- `process_comments.text`
- `process_comments.createdAt`
- `process_comments.createdBy`
- `process_comments.attachment`

Вложения загружаются в стандартную коллекцию `attachments` через attachment field `process_comments.attachment`.
При загрузке блок помечает запись metadata-признаком `attachmentPurpose = process-discussion`.

## Поведение блока

- Показывает последние 50 сообщений, старые страницы догружаются кнопкой.
- Новые сообщения подтягиваются polling-ом раз в 15 секунд, только когда вкладка и блок видимы.
- Поддерживает текст, вложения и комбинированные сообщения.
- В `Form (Edit)` комментарий создается сразу в `process_comments`, не попадает в состояние основной формы и не требует основной кнопки `Submit`.
- Основной `Submit` формы сохраняет только поля `customs_processes`; уже отправленные комментарии остаются сохраненными даже если пользователь отменит редактирование процесса.
- При смене процесса блок очищает старую ленту и загружает комментарии нового процесса.
- Сортировка сообщений: старые сверху, новые снизу.
- Свои сообщения подсвечиваются по `createdBy.id`.
- В первой версии нет редактирования, удаления, веток ответов, упоминаний, уведомлений и realtime WebSocket.
- В `Form (Add new)` и на странице без текущей записи блок показывает сообщение о необходимости сначала сохранить процесс.

## Открепление вложения до отправки

Кнопка удаления рядом с загруженным, но ещё не отправленным файлом вызывает:

```text
POST /api/processDiscussionAttachments:discard
```

Сервер разрешает удаление только когда:

- пользователь авторизован;
- attachment создан текущим пользователем;
- attachment помечен как загруженный блоком обсуждения;
- attachment ещё не связан ни с одной записью через attachment-поле.

После проверок удаляется запись `attachments`. Штатный hook `@nocobase/plugin-file-manager` удаляет физический
объект из настроенного storage. Глобальное право `attachments:destroy` роли не требуется и не выдаётся.
Если удаление не удалось, файл остаётся в composer, чтобы пользователь мог повторить операцию.

## Сборка

`nocobase/nocobase:2.0.60-full` не содержит полный dev toolchain для сборки плагинов. Для повторной сборки внутри этого image сначала временно установить build-зависимости:

```bash
cd /Users/daniil/log_company
docker compose exec -T app yarn add -W -D @nocobase/build@2.0.60 ts-node @vitejs/plugin-react vite @nocobase/client@2.0.60 react@18.3.1 react-dom@18.3.1 react-is@18.3.1
docker cp /Users/daniil/log_company/packages/plugins/@log-company/plugin-process-discussion/. log_company-app-1:/app/nocobase/packages/plugins/@log-company/plugin-process-discussion/
docker compose exec -T app yarn build @log-company/plugin-process-discussion --no-dts
docker compose exec -T app yarn tar @log-company/plugin-process-discussion
```

После сборки рекомендуется пересоздать `app` из исходного image, чтобы runtime не оставался с временными dev-зависимостями:

```bash
cd /Users/daniil/log_company
docker compose up -d --force-recreate app
```

## Установка или обновление пакета

```bash
cd /Users/daniil/log_company
mkdir -p storage/plugins/@log-company/plugin-process-discussion
tar -xzf storage/tar/@log-company/plugin-process-discussion-2.0.60.tgz -C storage/plugins/@log-company/plugin-process-discussion
docker compose up -d --force-recreate app
```

Первая регистрация в NocoBase:

```bash
cd /Users/daniil/log_company
docker compose exec -T app yarn pm add @log-company/plugin-process-discussion
docker compose exec -T app yarn pm enable @log-company/plugin-process-discussion
docker compose up -d --force-recreate app
```

Если плагин уже зарегистрирован, после замены файлов достаточно пересоздать `app`. При необходимости можно принудительно обновить запись плагина:

```bash
cd /Users/daniil/log_company
docker compose exec -T app yarn pm update @log-company/plugin-process-discussion
docker compose up -d --force-recreate app
```

## Отключение и удаление

Отключить без удаления файлов:

```bash
cd /Users/daniil/log_company
docker compose exec -T app yarn pm disable @log-company/plugin-process-discussion
docker compose up -d --force-recreate app
```

Удалить регистрацию из NocoBase:

```bash
cd /Users/daniil/log_company
docker compose exec -T app yarn pm remove @log-company/plugin-process-discussion
docker compose up -d --force-recreate app
```

После `pm remove` можно вручную удалить каталог `/Users/daniil/log_company/storage/plugins/@log-company/plugin-process-discussion`, если пакет больше не нужен.

## ACL

Плагин не выдает права автоматически. Права нужно настроить в NocoBase для нужных ролей.

Минимально требуется:

- Доступ к чтению нужных записей `customs_processes`.
- Доступ к чтению/list для комментариев процесса через `customs_processes.comments` или напрямую для `process_comments`.
- Доступ к create для `customs_processes.comments` или `process_comments`.
- Доступ к чтению `createdBy` и `attachment`, потому что блок запрашивает appends `createdBy` и `attachment`.
- Доступ к загрузке файлов в `attachments:create` для attachment field `process_comments.attachment`.

Для открепления pending-вложения достаточно доступа к custom action `processDiscussionAttachments:discard`,
который открыт для вошедших пользователей и затем выполняет object-level проверки владельца, назначения и ссылок.
Право `attachments:destroy` не требуется.

Рекомендуемая область данных для `process_comments`: только комментарии процессов, которые доступны этой роли. Плагин использует association resource `customs_processes.comments`, но ACL все равно нужно проверить на уровне ролей NocoBase.

## Удаление процесса с комментариями

Связь `customs_processes.comments` / `process_comments.process` должна использовать `onDelete = CASCADE`.

Без этого NocoBase блокирует удаление процесса с ошибкой `RESTRICT`, если в `process_comments` есть записи для этого процесса. Серверная часть плагина при загрузке:

- обновляет in-memory `referenceMap` NocoBase для `process_comments.process_id -> customs_processes.id`;
- выставляет `onDelete = CASCADE` в runtime field options;
- сохраняет `onDelete = CASCADE` в таблице `fields` для:
  - `customs_processes.comments`;
  - `process_comments.process`.

При удалении процесса связанные записи `process_comments` удаляются автоматически. Записи `attachments` как файлы не удаляются этим исправлением; удаляются комментарии и их association-связи.

## Проверка после установки

```bash
cd /Users/daniil/log_company
docker compose ps
curl -I http://localhost:13000
docker compose exec -T postgres psql -U nocobase -d nocobase -c "select name, enabled, installed, \"packageName\" from \"applicationPlugins\" where name='@log-company/plugin-process-discussion';"
```

Ожидаемо:

- `app` и `postgres` в статусе `Up`.
- HTTP `200 OK` на `http://localhost:13000`.
- В `applicationPlugins` у плагина `enabled = true` и `installed = true`.

Через UI: войти в NocoBase, открыть раздел `Таможенное оформление`, открыть существующую машину через действие `Edit`, перейти в `Form (Edit)` на вкладку/секцию `Комментарии` и добавить блок `Обсуждение процесса`.

Основной сценарий проверки:

1. Отправить текстовый комментарий.
2. Отправить файл без текста.
3. Изменить поле процесса и нажать основной `Submit`.
4. Открыть другой процесс и убедиться, что лента очищается и сообщения не смешиваются.
5. Открыть `Add new` процесса и убедиться, что блок не падает с `No filterByTk found for multi-record resource`, а показывает сообщение о необходимости сначала сохранить процесс.
6. Создать временный процесс с комментариями и удалить его через `POST /api/customs_processes:destroy?filterByTk=<id>`; ожидаемо HTTP `200`, процесс удален, комментарии удалены каскадом, ошибки `RESTRICT` нет.

Проверка 11.08.2026:

- во вложенном popup китайца `370463144542208` и процесса `379173154324480` вкладка `Обсуждение` запросила
  `/api/customs_processes/379173154324480/comments:list` и получила HTTP 200;
- пустое состояние `Сообщений пока нет` является корректным: у выбранного процесса пока нет комментариев.

Проверка 30.07.2026:

- подтверждена исходная ошибка: роль `manager` получала `403 No permissions` на `attachments:destroy`, поэтому
  откреплённый attachment и физический файл оставались в storage;
- удаление переведено на `processDiscussionAttachments:discard`, без расширения глобального ACL;
- action проверяет владельца, metadata-признак и отсутствие ссылок перед удалением записи и файла;
- добавлены application-тесты успеха, отсутствующей записи, чужого владельца, неверного назначения,
  уже используемого вложения и ошибки удаления.

Проверка 07.07.2026:

- `fields.options.onDelete` для `customs_processes.comments` = `CASCADE`.
- `fields.options.onDelete` для `process_comments.process` = `CASCADE`.
- Временный процесс `990000000001001` с двумя комментариями был удален через REST API: ответ `HTTP=200`, `{"data":1}`.
- После удаления: `process_after = 0`, `comments_after = 0`, `orphan_test_comments = 0`.
