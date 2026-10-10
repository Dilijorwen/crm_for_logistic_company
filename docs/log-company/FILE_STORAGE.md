# Единое файловое хранилище

Плагин `@log-company/plugin-file-storage` — общая инфраструктура хранения для всех модулей Log Company.
Бинарные данные находятся в одном закрытом MinIO bucket `log-company-files`, метаданные и права — в PostgreSQL.
Документы поставок, вложения чатов, обсуждений и разрешительных документов используют этот bucket.
Последние два вида файлов проходят через штатный NocoBase file-manager.

## Структура объектов

```text
log-company-files/
  v1/<application>/
    attachments/<server-generated-uuid>.<extension>
    chat-attachments/chats/<chatId>/<messageId>/<attachmentId>-<safeFileName>
    chat-attachments/chats/tmp/...
    process-documents/shipments/<shipmentId>/<uuid>.<extension>
    process-documents/shipments/drafts/<draftToken>/<uuid>.<extension>
    process-documents/processes/...       # сохранённые старые документы
```

`application` — имя приложения NocoBase, обычно `main`. `v1` — версия схемы ключей, а не версия бизнес-модуля.
Одинаковые логические ключи в разных областях или приложениях никогда не означают один объект.
Папки внутри bucket — префиксы объектов, не каталоги на файловой системе. Пользовательское имя хранится отдельно.
Не редактируйте `storage/minio` вручную. Этот каталог целиком принадлежит MinIO.

## Конфигурация

Общая конфигурация задаётся один раз: `FILE_STORAGE_ENDPOINT`, `FILE_STORAGE_REGION`, `FILE_STORAGE_BUCKET`,
`FILE_STORAGE_ACCESS_KEY`, `FILE_STORAGE_SECRET_KEY`. Docker обращается к сервису `minio:9000`.
Секреты нельзя помещать в исходники; пользовательский `.env` не изменяется автоматически.
Для существующей установки до настройки общей конфигурации поддерживается fallback на учётные данные
`PROCESS_DOCUMENTS_MINIO_*`. Старые `CHAT_MINIO_*` и `PROCESS_DOCUMENTS_MINIO_*` обозначают источники переноса
и совместимого чтения, а не независимые целевые хранилища.

## Архитектура и расширение

- Domain/application каждого бизнес-модуля объявляют свой storage port и проверяют права на исходный объект.
- Infrastructure адаптирует этот port к `MinioStorageArea` из `@log-company/plugin-file-storage/storage`.
- Composition root вызывает `readFileStorageConfig(process.env, plugin.app.name)` и задаёт уникальное имя области.
- Общий модуль централизует S3 SDK, конфигурацию, безопасные ключи и схему namespace.
- Нельзя создавать ещё один S3-клиент, bucket или набор переменных окружения для новой функции.
- Новая область имеет стабильное имя вроде `contracts`; логический ключ содержит ID сущности и серверный UUID.
- Изменение структуры ключей сопровождается новой миграцией с копированием, проверкой и совместимым чтением.
- Загрузка/удаление связанных metadata выполняются с транзакцией и компенсацией. Object key клиенту не передаётся.

Доступ к общим вложениям NocoBase выдаётся короткоживущей подписанной ссылкой на сервер приложения (5 минут).
До выдачи ссылки применяется штатный ACL file-manager. Изменение ID или срока делает подпись недействительной.
Bucket не публичный. Чаты и документы поставок выдаются только через свои API с повторной проверкой membership/ACL.
HTML и SVG не открываются inline; разрешённые изображения, PDF, обычный текст, аудио и видео можно просматривать.
Ключ файловых ссылок генерируется криптографически и сохраняется в
`storage/apps/<application>/file_storage_secret.dat` с правами `0600`. Он не зависит от демонстрационного `APP_KEY`
и не попадает в Git. Резервная копия рабочего `storage/apps` должна включать этот ключ.

## Перенос существующих данных

Миграция `20261005090000-unify-file-storage` копирует объекты из прежних chat/document buckets под соответствующие
префиксы. Затем копирует общие вложения из локального storage, проверяет размеры и переключает их metadata.
Общее MinIO-хранилище становится storage по умолчанию, а ссылки полей на прежний `local` storage обновляются.
Старые bucket и локальные исходные файлы не удаляются: это сохранённый резерв для проверки/восстановления.
Миграция forward-only; автоматического уничтожающего отката нет. Перед применением требуется backup PostgreSQL.

Существующие физические объекты вне metadata не объявляются пользовательскими вложениями и не удаляются.
Отдельные общие вложения и удалённые чаты архивируются без физического удаления объектов. Это исключает
потерю файла при откате БД; очистка архива по срокам хранения — отдельная явно согласованная операция.

## Сборка и установка

Сначала собирается и устанавливается `plugin-file-storage`, затем обновляются зависимые chats/process-documents.
Все зависимости между плагинами объявлены в `peerDependencies`, чтобы NocoBase соблюдал порядок загрузки.

```bash
corepack yarn build @log-company/plugin-file-storage --no-dts
corepack yarn tar @log-company/plugin-file-storage
docker compose exec -T app yarn pm add /app/nocobase/storage/tar/@log-company/plugin-file-storage-2.0.60.tgz
docker compose exec -T app yarn pm enable @log-company/plugin-file-storage
docker compose exec -T app yarn nocobase upgrade
```

При локальной сборке задайте `PLUGIN_PACKAGE_PREFIX=@nocobase/plugin-,@nocobase/preset-,@log-company/plugin-`,
чтобы зависимости на собственные плагины оставались внешними и не дублировались в пакетах. В Docker эта настройка
уже включена. Сборка с `--no-dts` не является проверкой типов; её выполняют отдельно.

Обновления выполняются через `pm update` из собранных tarball. Runtime-копии в `storage/plugins` не редактируют.
После обновления конфигурации контейнер приложения пересоздают без удаления volumes.

Для встроенного PDF.js-просмотра Compose подключает `docker/nocobase/log-company-mime.conf`.
Он добавляет MIME-тип `application/javascript` для `.mjs`, не заменяя остальные настройки nginx.
Без этого браузер блокирует worker PDF.js, хотя сам PDF корректно загружается.
В просмотрщике file-manager URL worker дополнен стабильным параметром `esm=1`, чтобы не использовать
бинарный HTTP-ответ, сохранённый браузером до исправления MIME-типа.
