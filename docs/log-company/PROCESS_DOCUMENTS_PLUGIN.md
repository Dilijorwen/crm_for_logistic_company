# @log-company/plugin-process-documents

## Назначение

`@log-company/plugin-process-documents` добавляет файловый модуль только для коллекции `customs_processes`.

В edit-форму процесса добавлена вкладка `Документы`. Внутри вкладки пользователь работает с файлами и папками конкретного процесса: загружает файлы или папку с компьютера, скачивает и удаляет документы.

Блок также работает в форме создания процесса. До сохранения формы документы хранятся как draft по временному токену, а после успешного создания `customs_processes` автоматически прикрепляются к созданному процессу.

Плагин не меняет:

- `@log-company/plugin-process-discussion`
- `@log-company/plugin-process-governance`
- `@log-company/plugin-process-tree`
- `process_comments`
- бизнес-поля `customs_processes`

## Пути

- Исходники: `/Users/daniil/log_company/packages/plugins/@log-company/plugin-process-documents`
- Tarball: `/Users/daniil/log_company/storage/tar/@log-company/plugin-process-documents-2.0.60.tgz`
- Установленный плагин: `/Users/daniil/log_company/storage/plugins/@log-company/plugin-process-documents`
- Данные MinIO: `/Users/daniil/log_company/storage/minio`
- Backup перед изменениями:
  - `/Users/daniil/log_company/backups/docker-compose-20260707-171146.yml`
  - `/Users/daniil/log_company/backups/nocobase-20260707-171146.sql.gz`

## Docker и MinIO

В `/Users/daniil/log_company/docker-compose.yml` добавлен сервис `minio`:

- image: `minio/minio:RELEASE.2025-05-24T17-08-30Z`
- доступен только внутри Docker-сети `nocobase`
- наружу не публикуются ни S3 API, ни console port
- `app` обращается к MinIO по `http://minio:9000`
- volume: `./storage/minio:/data`

Bucket создаётся серверным плагином при старте, если его ещё нет:

```text
log-company-process-documents
```

Переменные в `/Users/daniil/log_company/.env`:

```dotenv
PROCESS_DOCUMENTS_MINIO_ENDPOINT=http://minio:9000
PROCESS_DOCUMENTS_MINIO_REGION=us-east-1
PROCESS_DOCUMENTS_MINIO_BUCKET=log-company-process-documents
PROCESS_DOCUMENTS_MINIO_ACCESS_KEY=log_company_process_documents
PROCESS_DOCUMENTS_MINIO_SECRET_KEY=log_company_process_documents_secret
```

В `docker-compose.yml` также заданы локальные default-значения через `${VAR:-...}`.

## Коллекции и поля

Созданы две коллекции.

### `process_document_folders`

Фактические поля:

- `id`
- `title`
- `process_id`
- `parent_folder_id`
- `draft_token`
- `createdBy`
- `createdById`
- `updatedBy`
- `updatedById`

Семантика:

- `process_id` хранит ID процесса `customs_processes`; для документов в форме создания временно `null`.
- `draft_token` хранит временный ключ документов до сохранения нового процесса; после создания процесса очищается.
- `parent_folder_id = null` означает корневую папку процесса.
- `parent_folder_id != null` означает вложенную папку.

### `process_documents`

Фактические поля:

- `id`
- `title`
- `original_filename`
- `process_id`
- `folder_id`
- `draft_token`
- `storage_key`
- `mime_type`
- `file_size`
- `createdBy`
- `createdById`
- `updatedBy`
- `updatedById`

Семантика:

- `process_id` хранит ID процесса `customs_processes`; для документов в форме создания временно `null`.
- `draft_token` хранит временный ключ документов до сохранения нового процесса; после создания процесса очищается.
- `folder_id = null` означает файл в корне документов процесса.
- `folder_id != null` означает файл в папке этого же процесса.
- `storage_key` хранит ключ объекта в MinIO.

Важно: в NocoBase 2.0.60 relation metadata для прямых fields `process`, `folder`, `parent_folder` к этим таблицам вызывала ошибки загрузки приложения (`targetKey` / `field`). Поэтому установленная рабочая версия использует явные FK-поля `process_id`, `folder_id`, `parent_folder_id`, а бизнес-связи и целостность enforcing выполняются серверным кодом плагина.

## Хранение объектов

Объекты сохраняются в MinIO с ключом:

```text
processes/{process_id}/{uuid}.{safe_extension}
```

Для формы создания до сохранения процесса используется временный префикс:

```text
processes/drafts/{draft_token}/{uuid}.{safe_extension}
```

CRM-папки и исходное имя файла не используются как физический путь объекта. Переименование или удаление CRM-папок не ломает ключи файлов, а длинные русские имена не попадают в MinIO object key. Исходное отображаемое имя хранится в `title` и `original_filename`.

## Серверные actions

Плагин регистрирует resource `processDocuments`:

- `list`
- `createFolder`
- `uploadFiles`
- `download`
- `deleteFile`
- `folderDeleteSummary`
- `deleteFolder`

Клиент не обращается к MinIO напрямую и не получает постоянные MinIO-ключи.

## Загрузка файлов

`uploadFiles` принимает multipart-form с `processId` или `draftToken`, опциональным `folderId` и массивом `files`.

Особенности:

- используется disk temp upload через multer, не загрузка всего набора файлов в память;
- после успешной записи объекта в MinIO создаётся запись `process_documents`;
- при `draftToken` запись создаётся без `process_id`, но с `draft_token`;
- после завершения временные файлы удаляются;
- ограничения по MIME/размеру/количеству не добавлены плагином.

## Загрузка папки

Клиент использует скрытый input:

```html
<input type="file" multiple webkitdirectory>
```

На сервере включён `preservePath: true`, поэтому относительные пути выбранной папки сохраняются и раскладываются в `process_document_folders`.

При повторной загрузке одноимённой верхней папки создаётся новая отдельная папка, например `Контракты (1)`. Содержимое не объединяется.

## Дубликаты

Папки в одном родителе:

```text
Контракты
Контракты (1)
Контракты (2)
```

Файлы в одной папке:

```text
contract.pdf
contract (1).pdf
contract (2).pdf
```

Расширение файла сохраняется. Ничего не перезаписывается.

## Скачивание

Файл скачивается через NocoBase action:

```text
GET /api/processDocuments:download?documentId=...
```

Перед выдачей файла проверяется доступ к документу и процессу. MinIO наружу не публикуется.

## Удаление

### Файл

Удаление файла:

1. Проверяет право на изменение процесса и destroy документа.
2. Удаляет объект из MinIO через hook `process_documents.beforeDestroy`.
3. Удаляет запись `process_documents`.
4. Если объект в MinIO уже отсутствует, запись CRM удаляется, а факт пишется в лог.

### Папка

Удаление папки рекурсивное:

1. `folderDeleteSummary` считает вложенные папки и файлы.
2. UI показывает подтверждение.
3. `deleteFolder` собирает дерево папок.
4. Удаляет документы, затем папки от глубоких к верхним.
5. Удаление выполняется в транзакции.

Если удаление объекта MinIO завершится ошибкой, hook пробрасывает ошибку и транзакция не должна удалить CRM-структуру молча.

## Целостность

Серверные проверки работают в actions и hooks коллекций:

- нельзя создать папку/документ без `processId` и без `draftToken`;
- нельзя назначить родителем папку другого процесса;
- нельзя положить файл в папку другого процесса;
- нельзя изменить process документа так, чтобы folder относился к другому процессу;
- нельзя вложить папку саму в себя;
- нельзя создать цикл папок.

Сообщения ошибок возвращаются на русском.

## ACL

Плагин не обходит ACL NocoBase.

Чтение:

- требуется доступ к `customs_processes` на `get/list/view`;
- требуется доступ к `process_document_folders` и `process_documents` на `list/get`.

Запись:

- создание папки требует update-доступа к процессу и create для `process_document_folders`;
- загрузка требует update-доступа к процессу и create для `process_documents`;
- удаление файла требует update-доступа к процессу и destroy для `process_documents`;
- удаление папки требует update-доступа к процессу и destroy для `process_document_folders`.

Кнопки создания, загрузки и удаления скрываются, если сервер вернул `canWrite = false`.

## UI

Вкладка `Документы` добавлена в edit-tabs процесса в `flowModels`:

- `pdocs_tab_main_0707`
- `pdocs_grid_main_0707`
- `pdocs_block_main_0707`
- `pdocs_tab_alt_0707`
- `pdocs_grid_alt_0707`
- `pdocs_block_alt_0707`

Также добавлены записи `flowModelTreePath`, чтобы вкладки реально отображались после перезагрузки.

В форму создания процесса добавлен тот же блок документов. В реальном layout он находится под цепочкой `BlockGridModel -> ChildPageTabModel -> ChildPageModel -> AddNewActionModel`, поэтому клиент определяет create-контекст не только через `formBlockContext`, но и через подъём по `model.parentId` через `flowEngine`.

В интерфейсе:

- один компактный блок `Документы`;
- кнопки `Загрузить`, `Обновить`;
- `Загрузить` открывает меню `Файлы` / `Папку`;
- отдельной кнопки `Создать папку` нет;
- breadcrumbs от корня `Документы`;
- папки открываются кликом;
- `..` возвращает на уровень выше;
- файлы показывают размер, дату и автора;
- предпросмотра, переименования, перемещения и drag-and-drop нет.

В форме создания блок показывает:

```text
Документы будут прикреплены к процессу после сохранения формы.
```

На странице без записи и вне формы создания блок показывает:

```text
Сначала сохраните процесс, чтобы открыть документы.
```

## Сборка и обновление

```bash
cd /Users/daniil/log_company/packages/plugins/@log-company/plugin-process-documents

npx esbuild src/server/index.ts \
  --bundle --platform=node --format=cjs \
  --external:@nocobase/server \
  --external:@nocobase/database \
  --external:@nocobase/actions \
  --external:@nocobase/utils \
  --outfile=dist/server/index.js

npx esbuild src/server/plugin.ts \
  --bundle --platform=node --format=cjs \
  --external:@nocobase/server \
  --external:@nocobase/database \
  --external:@nocobase/actions \
  --external:@nocobase/utils \
  --outfile=dist/server/plugin.js

npm pack --pack-destination /Users/daniil/log_company/storage/tar
mv -f /Users/daniil/log_company/storage/tar/log-company-plugin-process-documents-2.0.60.tgz \
  /Users/daniil/log_company/storage/tar/@log-company/plugin-process-documents-2.0.60.tgz

cd /Users/daniil/log_company
docker compose exec -T app ./node_modules/.bin/nocobase pm add \
  /app/nocobase/storage/tar/@log-company/plugin-process-documents-2.0.60.tgz
docker compose restart app
```

Client bundle находится в `dist/client/index.js`. При изменении клиента его тоже нужно пересобрать перед `npm pack`.

## Отключение или удаление

Отключить плагин:

```bash
cd /Users/daniil/log_company
docker compose exec -T app ./node_modules/.bin/nocobase pm disable @log-company/plugin-process-documents
docker compose restart app
```

Удалить плагин из NocoBase:

```bash
cd /Users/daniil/log_company
docker compose exec -T app ./node_modules/.bin/nocobase pm remove @log-company/plugin-process-documents
docker compose restart app
```

Данные таблиц и MinIO-объекты отдельно не удаляются этими командами.

## Проверка

Фактическая проверка выполнена 2026-07-07 и дополнена 2026-07-08 после добавления поддержки формы создания.

API и сервер:

- `processDocuments:list` для процесса `372081949605888` возвращает пустой корень и `canWrite: true`.
- Создание папки `Контракты` работает.
- Повторное создание `Контракты` создаёт `Контракты (1)`.
- Создание вложенной папки `2026` работает.
- Загрузка двух файлов `contract.pdf` создаёт `contract.pdf` и `contract (1).pdf`.
- Объекты физически появились в `storage/minio/log-company-process-documents/processes/...`.
- Скачивание через `/api/processDocuments:download` вернуло исходное содержимое файла и имя `contract.pdf`.
- Загрузка папки с путями `UploadRoot/2025/contract.txt` и `UploadRoot/2026/agreement.txt` создала вложенную структуру.
- Повторная загрузка той же папки создала `UploadRoot (1)`.
- Загрузка папки/файла с русским именем сохраняет читаемые `title` и `original_filename`, а `storage_key` создаётся безопасным коротким ключом вида `processes/{process_id}/{uuid}.pdf`.
- Загрузка файла в режиме создания процесса работает по `draftToken`: до сохранения `process_id = null`, `draft_token` заполнен.
- После `customs_processes:create` с `_processDocumentsDraftToken` файл автоматически получает `process_id` созданного процесса, а `draft_token` очищается.
- Финальная API-проверка 2026-07-08:
  - `Проверка создания.txt` создан как draft `draft-1783490662-doc-final-check`;
  - создан процесс `374271717670913` с `title = 20 - API-DRAFT-FINAL-1783490662 с ЮРА`;
  - запись `process_documents 374271717670912` получила `process_id = 374271717670913` и пустой `draft_token`.
  - после проверки тестовые файл и процесс удалены через API; остаточных строк по ним нет.
- Попытка положить файл процесса A в папку процесса B вернула `Нельзя использовать папку другого таможенного процесса.`
- Попытка создать папку с родителем из другого процесса вернула `Нельзя использовать папку другого таможенного процесса.`
- Самоссылка папки вернула `Нельзя вложить папку саму в себя.`
- Цикл папок вернул `Нельзя создать цикл в структуре папок.`
- Удаление файла удалило запись CRM и объект MinIO.
- Рекурсивное удаление папки удалило вложенные папки, файлы и MinIO-объекты.
- После очистки тестов: `process_document_folders = 0`, `process_documents = 0`, файлов в MinIO по `processes/` нет.

Браузер:

- В edit-форме процесса `372081949605888` видна вкладка `Документы`.
- Блок показывает кнопки `Загрузить`, `Обновить`.
- Меню кнопки `Загрузить` содержит варианты `Файлы` и `Папку`.
- После очистки показывает `Документов пока нет`.
- На странице без `filterByTk` вкладка блокируется сообщением `Сначала сохраните процесс, чтобы открыть документы.`
- В браузере загружен bundle `@log-company/plugin-process-documents/dist/client/index.js?hash=d491c7fd`.
- До финальной клиентской правки browser-проверка формы создания показывала старое сообщение при загруженном bundle `?hash=9b84ae1f`.
- Причина найдена в клиентском определении create-контекста: блок поднимался только по `model.parent`, но в реальном popup цепочка доступна через `model.parentId` и `flowEngine.getModel(parentId, true)`.
- После правки установлен новый client bundle с hash файла `0ea4a6458e791518a96de8f1f702c3e2d8ed2dde80d4f50d03f6ecf1f5e76456`.
- In-app browser после перезапуска зависал на reload/goto, поэтому финальная проверка прикрепления документов в Add new подтверждена через API, БД и контейнерные hashes.

Docker:

- Выполнено `docker compose down --remove-orphans && docker compose up -d`.
- После полного перезапуска `app`, `postgres`, `minio` поднялись.
- `processDocuments:list` снова работает.
- Bucket `log-company-process-documents` сохранился.
- Новых ошибок плагина после готовности приложения в логах нет.

Установленные hashes после финальной сборки:

```text
tarball: 2a330db19490525313e525b7c311d56375d88f98d4118f893dfb44e0b3d767dc
server bundle: a854d6b7591c89e00a24d3d8df38fd0cdb62861e74ace21b3ac356b3140eaa81
client bundle: 0ea4a6458e791518a96de8f1f702c3e2d8ed2dde80d4f50d03f6ecf1f5e76456
```

## Ограничения первой версии

- Нет предпросмотра файлов.
- Нет переименования.
- Нет перемещения между папками.
- Нет drag-and-drop.
- Нет общей библиотеки документов.
- Нет связей файлов с сущностями кроме `customs_processes`.
- Relation metadata NocoBase для `process/folder/parent_folder` заменена явными FK-полями из-за ошибок загрузки NocoBase 2.0.60; целостность обеспечивается серверным плагином.
