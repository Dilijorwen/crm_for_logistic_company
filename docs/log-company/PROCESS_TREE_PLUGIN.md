# Плагин дерева процессов

## Назначение

`@log-company/plugin-process-tree` добавляет клиентский блок `Дерево процессов` для NocoBase 2.0.60. Целевой сценарий: вкладка `Дерево процесса` в форме редактирования существующей записи `customs_processes`.

Плагин только клиентский. Он не создает и не меняет таблицы, поля, связи, роли, статусы, Docker-образ, БД, порты и не трогает `@log-company/plugin-process-discussion` или `@log-company/plugin-process-governance`.

## Пути

- Исходники: `/Users/daniil/log_company/packages/plugins/@log-company/plugin-process-tree`
- Tarball: `/Users/daniil/log_company/storage/tar/@log-company/plugin-process-tree-2.0.60.tgz`
- Установленный плагин: `/Users/daniil/log_company/storage/plugins/@log-company/plugin-process-tree`
- Клиентский bundle в контейнере: `/app/nocobase/storage/plugins/@log-company/plugin-process-tree/dist/client/index.js`

Контрольные хэши после установки:

- Tarball: `9017ca2c5b260c5a8bdc1a225374b01d320593f3dd887d8e9ffb01a51a9e77ba`
- Client bundle в исходниках/storage/контейнере: `da6b090f925a0b2b1bd7a1be800fac0806ec15da693afe950f06fe3bff8096ae`

## Фактическое размещение

Блок установлен в metadata NocoBase:

- Вкладка `Дерево процесса`: `flowModels.uid = 00e42578e1a`, model `ChildPageTabModel`
- Grid вкладки: `flowModels.uid = 8fd8a9ef891`, model `BlockGridModel`
- Блок дерева: `flowModels.uid = ptree3f0703`, model `ProcessTreeBlockModel`

`ProcessTreeBlockModel` зарегистрирован с label `Дерево процессов`, поэтому он доступен как блок этого типа.

## Как работает получение текущего процесса

Блок ищет ID процесса устойчиво и без хардкода конкретной формы или popup:

1. Контекст update-формы: `formRecord`, `form.values`, `form.initialValues`, `service.data.data`.
2. Контекст popup action edit: `useCurrentPopupRecord`.
3. Record/data block/model context.
4. `filterByTk` из props/params.
5. Route fallback: сегмент `/filterbytk/<value>` или query `filterByTk`.

Для ключа используется metadata коллекции через `collectionManager.getFilterByTK`, затем filter target key / primary key, затем `id`. Это учитывает случаи, когда технический ключ отличается от обычного `id`.

В `Form (Add new)` или при отсутствии записи блок показывает:

`Сначала сохраните процесс, чтобы увидеть дерево связей.`

## Как загружается дерево

Открытый процесс загружается через `customs_processes:get`. Связи загружаются через существующие relation resources:

- `customs_processes.parent_processes`
- `customs_processes.child_processes`

Блок сначала строит связанную компоненту от открытого процесса: загружает предков, потом достраивает потомков от найденных корней. Корневой процесс - это процесс без родителей в загруженной компоненте.

В интерфейсе отображается единый лес корневых процессов. Открытый процесс не выносится в отдельную карточку или секцию, а находится внутри дерева на своем фактическом месте и выделяется стилем карточки.

Один и тот же процесс разрешено отображать несколько раз в разных независимых ветках дерева. Например, для связей `A -> E` и `B -> E` процесс `E` отображается полноценной карточкой под обоими родителями.

Глобальный `visited` для всего дерева не используется. Остановка выполняется только когда следующий узел уже есть в текущем пути ветки. В этом месте показывается предупреждение:

`Обнаружена циклическая связь. Часть дерева скрыта.`

Дети сортируются по `process_number`, затем по `createdAt`, затем по ID.

## Автор связи

Автор и дата связи берутся из `process_history`:

- `event_type = parent_added`
- `process_id = ID дочернего процесса`
- `new_value` совпадает с `title` родителя или с title без префикса порядкового номера

Если история недоступна или совпадение не найдено, показывается `Автор связи не указан`. Ошибка чтения истории не ломает дерево.

## Интерфейс

Внутри блока выводится один заголовок:

`Дерево процессов`

Не используются внутренние секции `Текущий процесс`, `Родительские процессы`, `Дочерние процессы`.

Карточка процесса показывает:

- `title`
- статус как label select-поля, fallback на техническое значение
- последнее изменение: `updatedBy.nickname/username` и `updatedAt`, fallback на `createdBy/createdAt`
- для текущей записи tag `Текущий процесс`
- для узлов с несколькими родителями строку `Родители: ...`

Текущая карточка и все ее предки принудительно раскрываются, чтобы путь до текущего процесса был виден сразу.

Стили используют токены темы Ant Design/NocoBase через `antdTheme.useToken()`, без самодельной отдельной палитры.

Клик по карточке меняет текущий `filterByTk` в существующем URL, очищает состояние дерева и загружает выбранный процесс. Отдельная страница меню или отдельный popup не создаются.

## Пересборка и обновление

Команды выполняются с хоста:

```bash
cd /Users/daniil/log_company/packages/plugins/@log-company/plugin-process-tree

# Собрать server entry.
npx esbuild src/server/index.ts \
  --bundle --platform=node --format=cjs \
  --external:@nocobase/server \
  --outfile=dist/server/index.js

npx esbuild src/server/plugin.ts \
  --bundle --platform=node --format=cjs \
  --external:@nocobase/server \
  --outfile=dist/server/plugin.js

# Собрать client entry во временный CJS bundle и завернуть в UMD,
# совместимый с загрузчиком NocoBase browser plugins.
npx esbuild src/client/index.tsx \
  --bundle --platform=browser --format=cjs \
  --external:react \
  --external:antd \
  --external:dayjs \
  --external:@formily/react \
  --external:@nocobase/client \
  --external:@ant-design/icons \
  --outfile=/tmp/plugin-process-tree-client.cjs
```

После сборки нужно обновить `dist/client/index.js` UMD-оберткой, упаковать и установить:

```bash
cd /Users/daniil/log_company/packages/plugins/@log-company/plugin-process-tree
npm pack --pack-destination /Users/daniil/log_company/storage/tar
mv /Users/daniil/log_company/storage/tar/log-company-plugin-process-tree-2.0.60.tgz \
  /Users/daniil/log_company/storage/tar/@log-company/plugin-process-tree-2.0.60.tgz

cd /Users/daniil/log_company
docker compose exec app ./node_modules/.bin/nocobase pm add /app/nocobase/storage/tar/@log-company/plugin-process-tree-2.0.60.tgz
docker compose exec app ./node_modules/.bin/nocobase pm enable @log-company/plugin-process-tree
docker compose restart app
```

После обновления проверить:

```bash
docker compose exec app sha256sum /app/nocobase/storage/plugins/@log-company/plugin-process-tree/dist/client/index.js
docker compose exec postgres psql -U nocobase -d nocobase -c \
  "select name, enabled, installed, version from \"applicationPlugins\" where name='@log-company/plugin-process-tree';"
```

В браузере в DevTools загружается:

`/static/plugins/@log-company/plugin-process-tree/dist/client/index.js?hash=8685a211`

## Отключение или удаление

Отключить:

```bash
cd /Users/daniil/log_company
docker compose exec app ./node_modules/.bin/nocobase pm disable @log-company/plugin-process-tree
docker compose restart app
```

Удалить пакет из NocoBase:

```bash
cd /Users/daniil/log_company
docker compose exec app ./node_modules/.bin/nocobase pm remove @log-company/plugin-process-tree
docker compose restart app
```

Если нужно удалить каталог установленного плагина, использовать штатный флаг:

```bash
docker compose exec app ./node_modules/.bin/nocobase pm remove --remove-dir @log-company/plugin-process-tree
```

## Фактические таблицы и поля

Плагин новых таблиц не создает. Он читает уже существующие:

- `customs_processes`
- `customs_process_parent_links`
- `process_history`

Проверенный технический нейминг:

- `customs_processes.id`
- `customs_processes.title`
- `customs_processes.process_number`
- `customs_processes.car_number`
- `customs_processes.chinese_client_id`
- `customs_process_parent_links.child_process_id`
- `customs_process_parent_links.parent_process_id`

Семантика join-таблицы:

- `parent_process_id` является родительским процессом
- `child_process_id` является дочерним процессом

## Права

Плагин не меняет ACL. Он использует существующие NocoBase resources и права текущего пользователя:

- чтение `customs_processes`
- чтение relations `parent_processes` / `child_processes`
- чтение `process_history` для подписей авторов связей

Если `process_history` недоступен, дерево остается рабочим, а у ребра показывается `Автор связи не указан`.

## Результаты проверок

- Браузерная проверка 07.07.2026 выполнялась на временных тестовых процессах `990000000000701..990000000000723`; после проверки временные строки удалены из `customs_processes` и `customs_process_parent_links`, контрольные счетчики `temp_links = 0`, `temp_processes = 0`.
- `A -> B -> C`, открыт `B`: отображается `A` на глубине 0, `B` на глубине 1 с tag `Текущий процесс`, `C` на глубине 2.
- `A -> B -> C`, открыт `C`: отображается `A` на глубине 0, `B` на глубине 1, `C` на глубине 2 с tag `Текущий процесс`.
- `A -> B` и `A -> C`, открыт `A`: отображается `A` на глубине 0 с tag `Текущий процесс`, `B` и `C` на глубине 1.
- `A -> E` и `B -> E`, открыт `E`: отображаются два корня `A` и `B`, а `E` отображается двумя полноценными карточками на глубине 1, обе с tag `Текущий процесс`; `eCount = 2`.
- Процесс без родителей и детей: реальный процесс `1 - CE6608 с КОЛЯ КИТ` отображается одной карточкой на глубине 0 с tag `Текущий процесс`.
- Во всех пяти сценариях внутри блока есть только заголовок `Дерево процессов`; секции `Родительские процессы` и `Дочерние процессы` отсутствуют.
- Во всех пяти сценариях нет `Сначала сохраните процесс` и нет `No filterByTk found`.
- Релевантных console logs по `plugin-process-tree`, `process-tree`, `filterByTk`, `No filterByTk` нет.
- Collapse/expand сохранен для узлов, не являющихся текущим процессом или предками текущего процесса.
- Клик по карточке по-прежнему меняет текущий `filterByTk`, очищает состояние дерева и загружает выбранный процесс.
- После `docker compose down --remove-orphans && docker compose up -d` плагин остается установленным и включенным, блок снова загружается в браузере.
- В Add new форме текущей конфигурации вкладки `Дерево процесса` нет; форма открылась без ошибки `No filterByTk found`. Код блока при отсутствии ID показывает понятное сообщение `Сначала сохраните процесс, чтобы увидеть дерево связей.`
- Искусственный цикл был временно создан прямой строкой в `customs_process_parent_links` (`C -> A`), получился путь `A -> B -> C -> A`. Дерево не зависло, цикл скрывался только в ветках, где следующий узел уже присутствовал в текущем пути. Тестовая строка удалена, `remaining = 0`.

Проверено после перезапуска:

- `@log-company/plugin-process-tree`: `enabled = true`, `installed = true`, `version = 2.0.60`
- bundle hash в контейнере: `da6b090f925a0b2b1bd7a1be800fac0806ec15da693afe950f06fe3bff8096ae`
- DevTools/browser script: `/static/plugins/@log-company/plugin-process-tree/dist/client/index.js?hash=8685a211`
- релевантных ошибок console/logs по `plugin-process-tree`, `process-tree`, `filterByTk` нет

## Ограничения

- Проверка недоступного связанного процесса не выполнялась через смену ролей, потому что задача запрещает менять права ролей. Код обрабатывает отказ чтения relation/process/history и показывает `Нет доступа к связанному процессу` или `Автор связи не указан`.
- Навигация по карточке реализована сменой `filterByTk` в текущем URL NocoBase. Отдельная страница меню или отдельный popup не создаются.
