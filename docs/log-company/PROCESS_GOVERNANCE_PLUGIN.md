# Process governance plugin

Документ описывает серверный плагин `@log-company/plugin-process-governance` для локального NocoBase `2.0.60-full`.

Плагин реализует бизнес-правила для `customs_processes`:

- автоматическое поле `title`;
- запрет циклов в графе `parent_processes`;
- разграничение прав на изменение `status` по ролям;
- неизменяемую историю изменений `process_history`.

Плагин не меняет `@log-company/plugin-process-discussion`, `process_comments`, определения ролей и существующий набор
бизнес-полей `customs_processes`. Он использует уже настроенные значения `status` и системные имена ролей NocoBase.

## Пути

Исходники:

```text
/Users/daniil/log_company/packages/plugins/@log-company/plugin-process-governance
```

Tarball:

```text
/Users/daniil/log_company/storage/tar/@log-company/plugin-process-governance-2.0.60.tgz
```

Установленный пакет:

```text
/Users/daniil/log_company/storage/plugins/@log-company/plugin-process-governance
```

Путь внутри контейнера:

```text
/app/nocobase/storage/plugins/@log-company/plugin-process-governance
```

Контрольные hash после установки:

```text
bb112409f87b0d488959eb8f9f70894b8452129681882818b5a4ff817ae9ea76  storage/tar/@log-company/plugin-process-governance-2.0.60.tgz
5952948c09e006cfdec6dba6f49ab4af02614c89d411a4e0b12ffc5179771ad2  storage/plugins/@log-company/plugin-process-governance/dist/server/plugin.js
8520cfd1c5cd636d2e6f50360f097f8424c1bcf838b20499caf09a480e59da85  storage/plugins/@log-company/plugin-process-governance/dist/server/services/ProcessGovernanceService.js
a721207e83e70d00502dcecda754e1aa731776e4e90f20419afc52208abdc720  storage/plugins/@log-company/plugin-process-governance/dist/server/migrations/20260714070000-compact-process-numbers.js
```

## Backup перед миграциями

Перед установкой сделаны:

```text
/Users/daniil/log_company/backups/nocobase-before-process-governance-20260702-125606.dump
/Users/daniil/log_company/backups/docker-compose-before-process-governance-20260702-125606.yml
```

## Сборка и обновление

Сборка выполняется из исходников:

```bash
cd /Users/daniil/log_company/packages/plugins/@log-company/plugin-process-governance
npx --yes esbuild@0.25.5 \
  src/server/index.ts \
  src/server/plugin.ts \
  src/server/collections/processHistory.ts \
  src/server/migrations/20260702090000-process-history-and-title-backfill.ts \
  src/server/migrations/20260702102000-register-process-history-metadata.ts \
  src/server/migrations/20260703030000-process-number-title.ts \
  src/server/migrations/20260714070000-compact-process-numbers.ts \
  src/server/services/ProcessGovernanceService.ts \
  --platform=node \
  --format=cjs \
  --outbase=src/server \
  --outdir=dist/server
find dist -type f -name '*.js' -print0 | xargs -0 -n1 node -c
npm pack --pack-destination /Users/daniil/log_company/storage/tar
```

Штатное обновление через NocoBase:

```bash
cd /Users/daniil/log_company
docker compose exec -T app yarn nocobase pm update /app/nocobase/storage/tar/@log-company/plugin-process-governance-2.0.60.tgz
docker compose restart app
```

Если `pm update` зависает после распаковки пакета, можно заменить установленный пакет тем же tarball и перезапустить `app`:

```bash
rm -rf /tmp/process-governance-unpack
mkdir -p /tmp/process-governance-unpack
tar -xzf /Users/daniil/log_company/storage/tar/@log-company/plugin-process-governance-2.0.60.tgz -C /tmp/process-governance-unpack
rsync -a --delete /tmp/process-governance-unpack/package/ /Users/daniil/log_company/storage/plugins/@log-company/plugin-process-governance/
docker compose restart app
```

После установки в БД:

```text
applicationPlugins.name      = @log-company/plugin-process-governance
applicationPlugins.enabled   = true
applicationPlugins.installed = true
applicationPlugins.version   = 2.0.60
```

## Отключение или удаление

Отключить:

```bash
cd /Users/daniil/log_company
docker compose exec -T app yarn nocobase pm disable @log-company/plugin-process-governance
docker compose restart app
```

Удалить пакет из NocoBase:

```bash
cd /Users/daniil/log_company
docker compose exec -T app yarn nocobase pm remove @log-company/plugin-process-governance
docker compose restart app
```

Удаление плагина не должно удалять существующие данные `customs_processes`. Таблица `process_history` остается в БД, если не выполнять отдельную ручную миграцию удаления.

## Фактический нейминг в базе

Проверено через таблицу `fields` и PostgreSQL.

`customs_processes`:

```text
id                 snowflakeId, primary key, filterTargetKey ["id"]
car_number         string, label "Номер машины"
chinese_client     belongsTo chinese_clients, FK chinese_client_id, targetKey id
process_number     integer, label "Порядковый номер", server-generated
title              string, label "Название", не unique
parent_processes   belongsToMany customs_processes through customs_process_parent_links
child_processes    reverse belongsToMany customs_processes through customs_process_parent_links
```

`customs_process_parent_links`:

```text
child_process_id   = текущий процесс
parent_process_id  = выбранный родительский процесс
```

`chinese_clients`:

```text
id    snowflakeId
name  string, label "Название"
```

## Созданная история

Физическая таблица:

```text
process_history
```

Поля:

```text
id           snowflakeId, primary key
process_id   bigInt, required, FK на customs_processes.id
event_type   string/select: created, field_changed, parent_added, parent_removed
field_name   string
field_label  string
old_value    text
new_value    text
createdAt    системное поле NocoBase
createdBy    системная связь NocoBase через createdById
createdById  системный контекст пользователя
```

В runtime плагин регистрирует relation `process` к `customs_processes` через `process_id`. В persisted metadata оставлен обязательный `process_id`, потому что статическая persisted `belongsTo process` в NocoBase 2.0.60 на этом проекте ломала старт приложения ошибкой биндинга targetKey до готовности модели `customs_processes`. Это техническое ограничение текущей версии/порядка загрузки; серверная история и фильтрация по процессу работают через `process_id`.

## Автоматическое title

Формат:

```text
{process_number} - {car_number} с {chinese_clients.name}
```

Пример:

```text
1 - А123ВС125 с 833
```

Плагин пересчитывает `title`:

- при создании `customs_processes`;
- при изменении `car_number`;
- при изменении `chinese_client`;
- при изменении `chinese_clients.name` у клиента, который используется процессами.

`process_number` - компактный серверный порядковый номер среди существующих процессов. Он пересчитывается по порядку `createdAt ASC, id ASC`, поэтому при четырёх существующих процессах номера должны быть `1, 2, 3, 4`. Перед созданием нового процесса плагин нормализует текущие номера и выдаёт `count(*) + 1`; после удаления процесса оставшиеся записи перенумеровываются без пропусков.

Переданные пользователем значения `title` и `process_number` на create/update игнорируются и перезаписываются серверными значениями. `title` и `process_number` не фиксируются в истории как отдельные изменения, потому что это производные/служебные поля.

Если у старой записи нет номера машины или клиента, плагин не падает, а использует временные подписи:

```text
Без номера процесса
Без номера
Без клиента
```

Также в лог пишется диагностическое предупреждение.

## Валидация циклов

Граф направленный:

```text
parent_processes: родитель -> текущий процесс
```

Перед сохранением плагин:

1. получает ID текущего процесса;
2. получает итоговый список родителей;
3. запрещает самоссылку;
4. строит достижимость от текущего процесса по дочерним связям;
5. запрещает выбранного родителя, если он уже достижим из текущего процесса;
6. для PostgreSQL берет транзакционный advisory lock на граф родительских связей, чтобы снизить риск race condition при параллельных изменениях.

Ошибки возвращаются до сохранения:

```text
Нельзя выбрать текущий процесс как родительский.
Нельзя добавить родительский процесс: связь создаст цикл в истории процессов.
```

Проверка работает для UI, REST API, импорта, workflow и прямых операций через NocoBase resource/action, потому что реализована на серверном уровне: pre-action hooks, Sequelize hooks и hooks промежуточной таблицы.

## История изменений

Пишутся события:

```text
created         создание процесса
field_changed   изменение бизнес-поля customs_processes
parent_added    добавление родительского процесса
parent_removed  удаление родительского процесса
```

Исключены из истории:

```text
id
createdAt
updatedAt
createdBy
updatedBy
title
process_number
parent_processes
child_processes
comments
documents
```

`parent_processes` исключен из generic field history и пишется отдельными событиями `parent_added` / `parent_removed`.

Для подписей используются:

- `chinese_client`: `chinese_clients.name`;
- `parent_processes`: `customs_processes.title`;
- users: `nickname`, fallback `username`;
- select-поля: label вместо технического value;
- остальные поля: строковое представление значения.

Если подпись второстепенного значения получить не удалось, сохранение процесса не ломается; ошибка логируется, а история пишется с fallback-значением.

## Права на изменение статуса

Проверка применяется к полю `customs_processes.status` в UI, REST API и серверных ORM-хуках. Права определяются по
системным именам ролей, а не по изменяемым отображаемым названиям.

| Роли | Доступные статусы |
| --- | --- |
| `manager`, `r_fuxr3pxkc9o` (Менеджер, Менеджер(Стажер)) | `queue` («В очереди»), `in_work` («В работе»), `knr` («КНР»), `in_russia` («В РФ») |
| `declarant`, `r_mo7pqlgcet3` (Декларант, Декларант(Стажер)) | `in_russia` («В РФ») и все настроенные статусы, кроме `queue`, `in_work`, `knr` |
| Все остальные роли, включая административные | Только просмотр статуса |

Статус `in_russia` («В РФ») является общим для менеджерской и декларантской групп. Если NocoBase работает в режиме
объединения ролей, пользователь получает объединение прав назначенных ему менеджерских и декларантских ролей.

На клиенте недоступные варианты остаются в метаданных для корректного отображения их подписей, но блокируются в
выпадающем списке. Для ролей без права изменения блокируется всё поле. Очистка статуса через UI отключена.

Сервер сравнивает новое значение с сохранённым: неизменённый статус не мешает роли только для просмотра сохранять
другие доступные ей поля. Явно переданное недопустимое значение возвращает HTTP `422`, а попытка назначить известный,
но недоступный роли статус — HTTP `403`. Если при создании статус не передан клиентом, системное значение по умолчанию
назначается самой коллекцией и не считается ручной сменой статуса.

## Права на process_history

Плагин запрещает ручные `create`, `update`, `destroy` для `process_history` на сервере.

Для отображения истории в интерфейсе NocoBase:

1. Открыть Collection Manager.
2. Найти коллекцию `process_history`.
3. Создать страницу, блок таблицы или association-блок истории.
4. Фильтровать по `process_id` текущего процесса.
5. Добавить поля `event_type`, `field_label`, `old_value`, `new_value`, `createdAt`, `createdBy`.

Ролям можно дать только чтение:

- разрешить `list` / `get` для `process_history`;
- не разрешать `create`, `update`, `destroy`;
- даже при ошибочной выдаче таких прав плагин дополнительно блокирует ручную запись на сервере.

## Проверка

API/БД тестовый префикс:

```text
1782963292949
```

Title:

```text
create:            PG-A-1782963292949 с PG-833-1782963292949
car_number update: PG-A2-1782963292949 с PG-833-1782963292949
client change:     PG-A2-1782963292949 с PG-900-1782963292949
client rename:     PG-A2-1782963292949 с PG-900-RENAMED-1782963292949
manual title API:  пользовательское title не сохранилось, осталось вычисленное
```

Актуальный формат после добавления `process_number`:

```text
create:                 6 - PN-1783044685924-CAR-A с PN-1783044685924-CLIENT-A
car_number update:      6 - PN-1783044685924-CAR-B с PN-1783044685924-CLIENT-A
client change:          6 - PN-1783044685924-CAR-B с PN-1783044685924-CLIENT-B
client rename:          6 - PN-1783044685924-CAR-B с PN-1783044685924-CLIENT-B-RENAMED
manual title API:       пользовательское title не сохранилось
manual process_number:  пользовательские 9999/8888 не сохранились
```

Граф:

```text
A -> B                         OK
A -> B -> C                    OK
A + B -> C                     OK
удаление одного родителя       OK
полная очистка родителей       OK
A -> A                         HTTP 400, самоссылка запрещена
A -> B, B -> A                 HTTP 400, цикл запрещен
A -> B -> C, C -> A            HTTP 400, цикл глубиной три запрещен
```

История:

```text
created                         OK
status                          OK
car_number                      OK
chinese_client                  OK
parent_added                    OK
parent_removed                  OK
title без отдельной истории      OK
createdById                     OK, реальный пользователь
обычная роль update history      HTTP 403
обычная роль destroy history     HTTP 403 / No permissions
```

Браузерная проверка:

```text
http://localhost:13000/admin/50grjmakocx/view/8d20048a832/filterbytk/373165745242115
```

В интерфейсе открыта существующая запись `customs_processes`, изменено поле `Дополнительная информация`. После нажатия `Submit` сервер записал историю:

```text
event_type   = field_changed
field_name   = manager_comment
field_label  = Дополнительная информация
old_value    =
new_value    = UI governance check 1782963292949
createdById  = 1
```

Проверка после полного перезапуска:

```text
docker compose down
docker compose up -d
HTTP /admin = 200
applicationPlugins: enabled=true, installed=true, version=2.0.60
process_history rows после перезапуска = 77
логи app без ошибок process-governance / Unknown attribute / crash
```

Post-restart API smoke-test:

```text
POST /api/customs_processes:update?filterByTk=373165745242115
body: {"title":"POST-RESTART-MANUAL-TITLE-..."}

Результат в БД:
title = PG-A3-1782963292949 с PG-REN-1782963292949
process_history по field_name=title = 0
```

## Ограничения и риски

- В persisted metadata `process_history` использует `process_id`; relation `process` регистрируется плагином в runtime. Это сделано, чтобы приложение стабильно стартовало после `docker compose down/up` на NocoBase 2.0.60.
- Advisory lock снижает риск параллельного создания циклов в PostgreSQL, но не заменяет полноценную serializable-транзакцию на всю внешнюю бизнес-операцию, если сторонний код обходит NocoBase hooks и пишет напрямую в таблицу.
- История неизменяема на уровне NocoBase actions/hooks. Прямой доступ суперпользователя к PostgreSQL технически может изменить таблицу.

## Повторная проверка 2026-07-03

Проверено по фактическому runtime:

```text
Docker image app: nocobase/nocobase:2.0.60-full
PostgreSQL: postgres:16
plugin-process-governance: enabled=true, installed=true, version=2.0.60
plugin-process-discussion: enabled=true, installed=true, version=2.0.60
runtime plugin.js hash: cd40b12998318ca320b376b33f5f7dbfd3183ea319870f9ceebcbba95c5a9931
runtime ProcessGovernanceService.js hash: 65b4af3ab7a98bfc535d06136eacc3bb34f96861d30f28e8efb9f5bdf1f4fdff
tarball hash: 6dc080dd9743a8f2e3a92d22cbceca6386b4a22c883c5c13253fbfc4ebb26b5b
runtime node_modules inside plugin: отсутствуют
```

API-проверка:

```text
auth admin                                                   PASS
title on create + manual title ignored                       PASS
title after car_number update                                PASS
title after chinese_client change                            PASS
title after chinese client rename                            PASS
manual title update ignored                                  PASS
history created event exists                                 PASS
history car_number / chinese_client / status exists          PASS
history excludes title                                       PASS
history createdBy present                                    PASS
graph one parent A -> B                                      PASS
graph chain A -> B -> C                                      PASS
graph multiple parents A + B -> C                            PASS
self-cycle rejected                                          PASS
simple cycle rejected                                        PASS
depth-three cycle rejected                                   PASS
remove one parent from multi-parent process                  PASS
clear all parents                                            PASS
parent_added / parent_removed history exists                 PASS
process_history update / destroy denied                      PASS
customs_processes:update parent_processes set/replace/clear  PASS
customs_processes:update cycle rejection                     PASS
process_history appends[]=process API                        PASS
```

Браузерная проверка:

```text
URL: /admin/50grjmakocx/view/8d20048a832/filterbytk/373331438338049
Открыта существующая форма процесса                           PASS
Изменено поле "Дополнительная информация"                    PASS
Нажат основной Submit                                         PASS
customs_processes.manager_comment обновлен                   PASS
process_history записал field_changed manager_comment         PASS
createdById = 1                                               PASS
```

Проверка после полного перезапуска:

```text
docker compose down && docker compose up -d                   PASS
HTTP /admin = 200                                             PASS
process_history rows = 125                                    PASS
plugin enabled/installed сохранились                          PASS
ручной API update title после restart игнорируется            PASS
history по field_name=title отсутствует                       PASS
свежие логи без process-governance / Unknown attribute errors PASS
```

Единственное подтвержденное расхождение с исходной формулировкой:

```text
process_history persisted field "process" в metadata: FAIL, count=0
Фактически используется обязательный process_id и runtime relation process.
Причина описана выше в ограничениях: persisted belongsTo process ломал старт NocoBase 2.0.60 на этом проекте.
```

## Обновление title с порядковым номером 2026-07-03

Причина изменения: в таблице `Таможенное оформление` слева виден UI-порядковый номер строки. Этот UI-номер не хранится в записи и зависит от сортировки/фильтра/страницы, поэтому для названия добавлен стабильный серверный номер `process_number`.

Новая миграция:

```text
20260703030000-process-number-title/@log-company/plugin-process-governance
```

Создано:

```text
customs_processes.process_number integer
default: nextval('customs_processes_process_number_seq')
unique index: customs_processes_process_number_unique
metadata field: process_number, label "Порядковый номер"
```

Backfill:

```text
Старые процессы пронумерованы по ORDER BY createdAt ASC NULLS LAST, id ASC.
Текущие первые строки:
1 - CE6608 с КОЛЯ КИТ
2 - RELSET-1783042325392-A с RELSET-1783042325392-CLIENT
3 - RELSET-1783042325392-B с RELSET-1783042325392-CLIENT
4 - RELSET-1783042325392-C с RELSET-1783042325392-CLIENT
5 - RELSET-1783042325392-D с RELSET-1783042325392-CLIENT
```

Актуальные hashes после обновления:

```text
tarball: 6dc080dd9743a8f2e3a92d22cbceca6386b4a22c883c5c13253fbfc4ebb26b5b
service bundle: 65b4af3ab7a98bfc535d06136eacc3bb34f96861d30f28e8efb9f5bdf1f4fdff
```

Проверка API:

```text
create with process_number=9999 and title="BAD"       PASS
assigned process_number=6                              PASS
title = 6 - PN-1783044685924-CAR-A с ...               PASS
manual process_number update=8888 ignored              PASS
car_number update recalculates title                   PASS
chinese_client change recalculates title               PASS
chinese_clients.name rename recalculates title         PASS
history excludes process_number                        PASS
history excludes title                                 PASS
```

Браузерная проверка:

```text
URL: /admin/50grjmakocx/view/8d20048a832/filterbytk/373336439193602
Название в форме:
6 - PN-1783044685924-CAR-B с PN-1783044685924-CLIENT-B-RENAMED
```

Проверка после полного перезапуска:

```text
docker compose down && docker compose up -d             PASS
HTTP /admin = 200                                       PASS
plugin enabled/installed сохранились                    PASS
migration process-number-title присутствует             PASS
process_number=6/title процесса сохранились             PASS
post-restart create assigned process_number=7           PASS
post-restart manual process_number=7777 ignored         PASS
post-restart title="BAD" ignored                        PASS
свежие логи без ошибок загрузки                         PASS
```

## Компактная нумерация существующих процессов 2026-07-14

Причина изменения: после создания и удаления тестовых процессов в рабочей базе осталось 4 процесса, но названия продолжались с `21`, `22`, `23`. Это происходило потому, что runtime-код брал следующий `process_number` из PostgreSQL sequence `customs_processes_process_number_seq`, а sequence не уменьшается после удаления записей.

Новая миграция:

```text
20260714070000-compact-process-numbers/@log-company/plugin-process-governance
```

Изменения:

```text
customs_processes.process_number остается integer
default nextval(...) удален
unique index customs_processes_process_number_unique удален, если существовал
sequence больше не используется runtime-кодом
```

Новая логика:

```text
перед create: advisory lock -> компактная перенумерация существующих процессов -> новый номер count(*) + 1
после destroy: компактная перенумерация оставшихся процессов
title пересчитывается вместе с process_number
пользовательские title/process_number по-прежнему игнорируются
title/process_number по-прежнему не пишутся отдельными событиями в process_history
```

Фактическое состояние после миграции:

```text
1 - CE6608 с КОЛЯ КИТ
2 - 333 с ЮРА
3 - 222 с ЮРА
4 - Ann с ЮРА
```

Проверка API 2026-07-14:

```text
до исправления: существовали process_number 1, 21, 22, 23
после миграции: существующие процессы получили process_number 1, 2, 3, 4
create с process_number=999 и title="BAD TITLE"          PASS
созданный процесс получил process_number=5               PASS
title = 5 - NUMBERING-CHECK-1784008801 с ЮРА             PASS
после destroy тестового процесса осталось 1, 2, 3, 4      PASS
тестовый process_history удален вручную из БД             PASS
HTTP /api/app:getInfo = 200                               PASS
```

Backup перед исправлением:

```text
/Users/daniil/log_company/backups/process-governance-numbering-20260714-155656/docker-compose.yml.bak
/Users/daniil/log_company/backups/process-governance-numbering-20260714-155656/nocobase-before-numbering.dump
```
