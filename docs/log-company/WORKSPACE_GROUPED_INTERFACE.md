# Рейсы и поставки: общее рабочее окно

## Сверка колонок и ролей 04.11.2026

В представлении есть все 35 бизнес-полей исходных рейсов и поставок. Права менеджера приведены
к исходным разрешениям: доступны 28 полей, включая ранее пропущенные срок ответа по дополнительной
проверке, сумму таможенных платежей и сумму КТС. После настройки создана копия роли «Декларант».
[Полная сверка и проверки](WORKSPACE_PERMISSIONS_AUDIT_2026-11-04.md).

## Обновление 2.0.118

По отдельному требованию «Номер доставки», «Дата ДТ» и «Дата ЗВ» теперь удалены физически из БД, метаданных
и SQL-представления. Предыдущее скрытие полей заменено окончательным удалением новой миграцией.
[Изменения и проверки](SHIPMENT_FIELD_REMOVAL_2026-11-04.md).

## Обновление 2.0.114

Из подписей полей и колонок убрано «НТМ», сама вкладка сохранена. «Номер доставки»,
«Дата выпуска декларации» и «Дата выпуска заявления» убраны из форм, таблиц и каталогов
колонок/фильтров. Сохранённые значения остаются в базе. Миграция обновляет существующие
формы и шаблоны, сохраняя настройки остальных элементов.
[Изменения и проверки](SHIPMENT_FIELDS_2026-11-03.md).

## Обновление 2.0.113

По окончательному уточнению заголовки групп прокручиваются вместе с колонками. Информация
о рейсе находится в начале полной таблицы, количество поставок и добавление — в её правом конце.
Элементы скрываются за границами видимой области при прокрутке, одинаково до и после выбора.
Привязка к viewport удалена. [Изменение и проверки](WORKSPACE_TABLE_SCROLL_2026-11-03.md).

## Обновление 2.0.112

Проверено закрепление содержимого заголовка относительно viewport: слева информация, справа
количество поставок и добавление; фон занимает всю ширину таблицы. Вкладка общей формы создания
задаётся одним обработчиком для всех точек входа. Первая инициализация сохранённой страницы
ожидает активации её собственного маршрута: поздно созданная страница документов больше
не получает UID рабочего списка. Завершён аудит сборки и миграций после прерывания.
[Изменения и фактические проверки](WORKSPACE_COMPLETION_AUDIT_2026-11-03.md).

## Обновление 2.0.110

Создание поставки использует общий большой Modal с разделами «Основное», «Таможенное оформление»,
«НТМ» и «Документы». Ширина содержимого заголовка измеряется при появлении самой таблицы.
Окна получают текущий view до создания вложенных моделей, а конфигурация загружается по штатным
async-границам. Загрузка карточки и селектора использует общий механизм с обработкой ошибок.
[Первопричины, изменения и фактические проверки](WORKSPACE_LIFECYCLE_FIXES_2026-11-03.md).

## Обновление 2.0.109

Раздел в меню называется «Рейсы и поставки», повторный заголовок над таблицей убран.
Исправлены метаданные чисел и вариантов выбора, полоса заголовка рейса и действия справа.
Чередование строк поставок удалено. Создание рейса открывается большим диалогом с категориями,
привязка поставки открывается напрямую и поддерживает повтор после ошибки.
[Причины, файлы и фактические проверки](WORKSPACE_DISPLAY_FIXES_2026-11-03.md).

## Обновление 2.0.108

Исправлены формы, навигация и действия. Текущий механизм использует штатный FlowRoute.
Причины семи ошибок, исправления и фактические проверки: [технический отчёт](WORKSPACE_UI_FIXES_2026-11-02.md).
Проверки исходной сборки 2.0.107 ниже сохранены как история.


Версии: `plugin-process-governance` 2.0.107 и `plugin-table-personalization` 2.0.73.

## Расположение и поведение

Верхняя навигация сохраняется. Страница находится в группе «Информация», в левом меню
«Рейсы и поставки», без повторного заголовка над таблицей. Миграция переносит существующий
маршрут либо восстанавливает отсутствующий. Справочники в группе не изменяются.

На основной странице используются штатные TableBlockModel, модели колонок, действий и персонализация.
Панель слева начинается с «Колонки», затем «Шаблоны», затем обычный фильтр без подписи.
Справа остаются поиск, «Добавить рейс» и «Удалить». Шаблон сохраняет фильтр, порядок, ширину и
видимость колонок. Дополнительной панели быстрых фильтров и кнопки «Обновить» нет.

Каждый рейс представлен раскрывающимся заголовком: номер, номер транспорта, тип перевозки,
город, менеджеры, декларанты, число поставок и меню добавления новой или существующей поставки.
Заголовок занимает полную ширину таблицы и прокручивается вместе с её содержимым.
Под ним находятся обычные строки поставок. Основные колонки: номер, статус, клиент, инвойс,
ЗВ, ДТ, схема, «СС/ДС», «СКК». Остальные поля доступны через настройку колонок.
Цвета и размеры используют токены темы NocoBase/Ant Design. На узком экране панель рейса
перемещается под список; широкая таблица сохраняет горизонтальную прокрутку.

Страницы считаются по рейсам: один рейс не разрывается между страницами. Сортировка полей
поставки действует внутри рейсов, сортировка полей рейса определяет порядок групп.
Поиск и фильтр отбирают подходящие поставки, при этом заголовок показывает общее доступное
число поставок рейса. Для пустого рейса показывается приглашение добавить поставку.

Поставка, связанная с несколькими рейсами, отображается в каждой группе с единым номером и
значком количества связей. Выбор одной её строки синхронизирует остальные видимые строки.
Общий счётчик и удаление учитывают такую поставку один раз. Нажатие на значок показывает
доступные связанные рейсы; скрытые правами записи и поля не раскрываются.

Правая панель появляется при выборе заголовка рейса и содержит вкладки «Обзор», «Дерево»,
«История». Обзор показывает данные рейса, ответственных, поставки и связи рейсов. Полная
карточка открывается по номеру рейса, номеру транспорта либо кнопке разворачивания панели.
Отвязка поставки сохраняет саму поставку и остальные связи.

## Карточки

Полная карточка рейса открывается штатным большим диалогом. Вкладки: «Рейс», «Поставки»,
«Дерево», «История». В форме рейса одна кнопка сохранения. Дублирующее поле привязки поставок
удалено: операции находятся во вкладке «Поставки».

Вкладка «Поставки» содержит настраиваемую таблицу, поиск, меню добавления/привязки и удаление.
Фильтра здесь нет. Для привязки существующей поставки настроен штатный диалог выбора с
таблицей, колонками, поиском и подтверждением. Создание новой поставки передаёт текущий рейс
через исходные значения формы. Документы доступны и при создании через существующую draft-загрузку.

Номер поставки открывает отдельную встроенную страницу CRM. Верхняя и левая навигация
сохраняются. Если переход выполнен из диалога рейса, диалог временно скрывается и
восстанавливается при возврате. Модели общих карточек не переподчиняются строке-инициатору:
это предотвращает циклы контекста, переполнение стека и исчезновение списка после переходов.

На странице поставки находятся номер, статус, инвойс, возврат и одна кнопка «Сохранить».
Вкладки: «Основное», «Таможенное оформление», «НТМ», «Документы», «Обсуждение», «История».
Три вкладки данных используют одну штатную форму: изменения и валидация не разделены на
несколько независимых сохранений. Документы, обсуждение и история работают с ID исходной
поставки. Блок связанных рейсов и служебные сведения о создании/изменении здесь не добавляются.
СС/ДС остаётся текстовым полем с ручным вводом номеров через запятую.

## Архитектурные решения

- Связь рейсов и поставок остаётся M:N. Новых бизнес-таблиц, полей или копий поставок нет.
- SQL-представление `logistics_work_items` остаётся только для чтения. Формы и ассоциации
  используют исходные коллекции и штатные API.
- Порт `WorkspaceReadModel` отделяет HTTP от адаптера NocoBase/Sequelize. Группировка и
  пагинация выполняются на сервере в пределах прав исходных коллекций.
- Минимальные расширения персонализации позволяют внешнему блоку настроить ресурс и
  представить строки группами, сохраняя идентичность TableBlockModel и личные шаблоны.
- Дерево и история в правой панели получают отдельный scoped engine/context, не меняя
  глобальный контекст страницы.
- Сохранение, привязка, отвязка и удаление уведомляют открытые блоки об изменениях.
- Удаление поставок транзакционно удаляет только затронутые опустевшие рейсы. Проверки
  прав и блокировки существующего сценария сохранены; ответ дополнен ID удалённых записей,
  чтобы закрыть диалог удалённого рейса.

## База данных и миграция

Миграция `20261102020000-group-workspace-under-information.ts` изменяет только конфигурацию
меню и FlowModel. Она транзакционна и идемпотентна. Номера, поля, документы, история,
рейсы, поставки и связи не переносятся и не удаляются. Новых индексов не требуется.

## Основные изменённые файлы

Пути ниже указаны относительно `packages/plugins/@log-company/`.

| Файл или каталог | Назначение |
| --- | --- |
| `plugin-process-governance/src/shared/workspace.ts` | Общие идентификаторы карточек и контракт метаданных групп |
| `plugin-process-governance/src/server/application/logistics/ports/WorkspaceReadModel.ts` | Порт группового чтения |
| `plugin-process-governance/src/server/infrastructure/read-model/NocoBaseWorkspaceReadModel.ts` | Пагинация рейсов, счётчики, связи с учётом ACL |
| `plugin-process-governance/src/server/interfaces/http/LogisticsWorkspaceActions.ts` | Групповой список и поиск по текущим данным |
| `plugin-process-governance/src/server/composition/LogisticsModule.ts` | Подключение адаптера к HTTP |
| `plugin-process-governance/src/server/application/logistics/DeleteWorkspaceShipments.ts` | ID удалённых записей в результате операции |
| `plugin-process-governance/src/server/infrastructure/metadata/InstallWorkspacePresentation.ts` | Транзакционная установка меню и моделей |
| `plugin-process-governance/src/server/infrastructure/metadata/WorkspaceAssociatedShipmentsTree.ts` | Таблица поставок рейса и заполненный выбор привязки |
| `plugin-process-governance/src/server/infrastructure/metadata/WorkspaceShipmentPageTree.ts` | Отдельная страница поставки с одной формой |
| `plugin-process-governance/src/server/infrastructure/metadata/LogisticsWorkspacePage.ts` | Поддержка общей транзакции |
| `plugin-process-governance/src/server/infrastructure/metadata/UpgradeLogisticsWorkspace.ts` | Поддержка общей транзакции |
| `plugin-process-governance/src/server/infrastructure/metadata/LogisticsWorkspaceNativeModels.ts` | Повторное использование штатных схем форм, колонок, истории |
| `plugin-process-governance/src/server/migrations/20261102020000-group-workspace-under-information.ts` | Применение новой конфигурации |
| `plugin-process-governance/src/client/widgets/workspace-table/api/WorkspaceSummaryApi.ts` | Группы, строки, выбор, панель рейса, загрузка данных |
| `plugin-process-governance/src/client/widgets/workspace-table/model/WorkspaceTableContext.ts` | Группы, строки, выбор, панель рейса, загрузка данных |
| `plugin-process-governance/src/client/widgets/workspace-table/model/__tests__/workspaceGroups.test.ts` | Регрессионная проверка: группы, строки, выбор, панель рейса, загрузка данных |
| `plugin-process-governance/src/client/widgets/workspace-table/model/useRunSummary.ts` | Группы, строки, выбор, панель рейса, загрузка данных |
| `plugin-process-governance/src/client/widgets/workspace-table/model/workspaceGroups.ts` | Группы, строки, выбор, панель рейса, загрузка данных |
| `plugin-process-governance/src/client/widgets/workspace-table/ui/WorkspaceRunHeader.tsx` | Группы, строки, выбор, панель рейса, загрузка данных |
| `plugin-process-governance/src/client/widgets/workspace-table/ui/WorkspaceRunSidebar.tsx` | Группы, строки, выбор, панель рейса, загрузка данных |
| `plugin-process-governance/src/client/widgets/workspace-table/ui/WorkspaceTableBlockModel.tsx` | Группы, строки, выбор, панель рейса, загрузка данных |
| `plugin-process-governance/src/client/widgets/workspace-table/ui/WorkspaceTableProjection.tsx` | Группы, строки, выбор, панель рейса, загрузка данных |
| `plugin-process-governance/src/client/widgets/workspace-table/ui/__tests__/WorkspaceTableBlockModel.test.ts` | Регрессионная проверка: группы, строки, выбор, панель рейса, загрузка данных |
| `plugin-process-governance/src/client/widgets/workspace-table/ui/__tests__/WorkspaceTableProjection.test.tsx` | Регрессионная проверка: группы, строки, выбор, панель рейса, загрузка данных |
| `plugin-process-governance/src/client/widgets/workspace-shipment-page/index.ts` | Публичные экспорты модуля |
| `plugin-process-governance/src/client/widgets/workspace-shipment-page/ui/WorkspaceShipmentEditFormModel.tsx` | Шапка и вкладки единой формы поставки |
| `plugin-process-governance/src/client/widgets/workspace-shipment-page/ui/WorkspaceShipmentSectionsGridModel.tsx` | Шапка и вкладки единой формы поставки |
| `plugin-process-governance/src/client/features/workspace-actions/index.ts` | Публичные экспорты модуля |
| `plugin-process-governance/src/client/features/workspace-actions/model/WorkspaceActionModels.tsx` | Переходы, создание, привязка, отвязка и удаление |
| `plugin-process-governance/src/client/features/workspace-actions/model/__tests__/WorkspaceActionModels.test.ts` | Регрессионная проверка: переходы, создание, привязка, отвязка и удаление |
| `plugin-process-governance/src/client/features/workspace-actions/model/__tests__/WorkspacePopupLifecycle.test.ts` | Регрессионная проверка: переходы, создание, привязка, отвязка и удаление |
| `plugin-process-governance/src/client/features/workspace-actions/model/openWorkspaceView.ts` | Переходы, создание, привязка, отвязка и удаление |
| `plugin-process-governance/src/client/features/workspace-actions/ui/WorkspaceSharedShipmentBadge.tsx` | Переходы, создание, привязка, отвязка и удаление |
| `plugin-process-governance/src/client/features/workspace-actions/ui/WorkspaceShipmentActions.tsx` | Переходы, создание, привязка, отвязка и удаление |
| `plugin-process-governance/src/client/features/workspace-actions/ui/WorkspaceShipmentAddButton.tsx` | Переходы, создание, привязка, отвязка и удаление |
| `plugin-process-governance/src/client/features/scoped-native-block/index.ts` | Публичные экспорты модуля |
| `plugin-process-governance/src/client/features/scoped-native-block/ui/ScopedNativeBlock.tsx` | Изолированный контекст дерева и истории |
| `plugin-process-governance/src/client/features/workspace-record-header/index.ts` | Публичные экспорты модуля |
| `plugin-process-governance/src/client/features/workspace-record-header/ui/WorkspaceRecordHeader.tsx` | Переиспользуемый заголовок исходной записи |
| `plugin-process-governance/src/client/shared/lib/workspace-record/events.ts` | События обновления и тип контекста карточек |
| `plugin-process-governance/src/client/shared/lib/workspace-record/index.ts` | Публичные экспорты модуля |
| `plugin-process-governance/src/client/shared/lib/workspace-record/viewHost.ts` | События обновления и тип контекста карточек |
| `plugin-process-governance/src/client/features/synchronize-shipment-form/model/WorkspaceCreateFormModel.ts` | Сообщение об ошибке обновления без ссылки на удалённую кнопку |
| `plugin-process-governance/src/client/widgets/workspace-context/ui/WorkspaceContextModels.tsx` | Общий заголовок и актуальное сообщение обновления |
| `plugin-process-governance/src/client/widgets/workspace-shipments/ui/WorkspaceShipmentsBlockModel.tsx` | Переход к отдельной странице поставки |
| `plugin-process-governance/src/client/app/plugin.ts` | Регистрация новых моделей |
| `plugin-table-personalization/src/client/features/table-personalization/model/PersonalizedTableBlockModel.tsx` | Подключение внешнего группового представления |
| `plugin-table-personalization/src/client/features/table-personalization/ui/ColumnSettingsButton.tsx` | Подпись «Колонки» |
| `plugin-table-personalization/src/client/features/filter-templates/model/SavedFilterActionModel.tsx` | Иконка фильтра без подписи |
| `plugin-table-personalization/src/client/widgets/table-templates/model/TableTemplatesBlockModel.tsx` | «Шаблоны» после «Колонки» |
| `plugin-process-governance/package.json`, `plugin-table-personalization/package.json` | Версии поставки |

Дополнительно изменены следующие тесты:

| Файл | Назначение |
| --- | --- |
| `plugin-process-governance/src/client/features/workspace-actions/model/__tests__/WorkspaceActionModels.test.ts` | Проверка изменённого сценария |
| `plugin-process-governance/src/client/features/workspace-actions/model/__tests__/WorkspacePopupLifecycle.test.ts` | Проверка изменённого сценария |
| `plugin-process-governance/src/server/interfaces/http/__tests__/LogisticsWorkspaceActions.test.ts` | Проверка изменённого сценария |
| `plugin-process-governance/src/server/infrastructure/metadata/__tests__/LogisticsWorkspacePage.test.ts` | Проверка изменённого сценария |
| `plugin-process-governance/src/server/application/logistics/__tests__/DeleteWorkspaceShipments.test.ts` | Проверка изменённого сценария |
| `plugin-process-governance/src/server/infrastructure/persistence/nocobase/__tests__/NocoBaseWorkspaceDeletion.integration.test.ts` | Проверка изменённого сценария |
| `plugin-table-personalization/src/client/widgets/table-templates/model/__tests__/TableTemplatesBlockModel.test.tsx` | Проверка изменённого сценария |
| `plugin-table-personalization/src/client/features/table-personalization/ui/__tests__/ColumnSettingsButton.test.tsx` | Проверка изменённого сценария |

Связанные тесты проверяют группировку, выбор общей поставки, сохранение штатных ячеек,
права, поиск, пагинацию, транзакционный откат конфигурации, структуру форм и жизненный
цикл карточек. Визуальная проверка намеренно не выполняется по указанию пользователя.

## Выполненные проверки и установка

- `corepack yarn test:client packages/plugins/@log-company/plugin-process-governance/src/client --run --maxWorkers=1 --minWorkers=1`: 92 теста, 21 файл, успешно.
- `corepack yarn test:client packages/plugins/@log-company/plugin-table-personalization/src/client --run --maxWorkers=1 --minWorkers=1`: 94 теста, 13 файлов, успешно.
- `corepack yarn test:server packages/plugins/@log-company/plugin-process-governance/src/server --run --maxWorkers=1 --minWorkers=1`: 154 теста, 41 файл, успешно. После окончательного исправления запроса PostgreSQL повторно выполнены 12 связанных тестов `LogisticsWorkspaceActions.test.ts`, включая проверку SQL на отсутствие негруппированного ID в сортировке.
- `corepack yarn test:server packages/plugins/@log-company/plugin-table-personalization/src/server --run --maxWorkers=1 --minWorkers=1`: 109 тестов успешно; 24 существующих PostgreSQL-теста пропущены, поскольку отдельная тестовая БД не настроена.
- `corepack yarn test:architecture`: 24 теста успешно.
- `corepack yarn typecheck:log-company:client`, `corepack yarn typecheck:log-company:server`, `corepack yarn typecheck:log-company:domain`: успешно, без ошибок типов.
- `corepack yarn eslint --fix` для затронутых файлов и `git diff --check`: успешно.
- `corepack yarn prettier --write docs/log-company/WORKSPACE_GROUPED_INTERFACE.md docs/log-company/PROCESS_GOVERNANCE_PLUGIN.md`: успешно.
- `corepack yarn build @log-company/plugin-process-governance` и `corepack yarn build @log-company/plugin-table-personalization`: успешно. После исправления SQL повторена сборка governance с `--no-dts`; проверка типов сервера выполнена отдельно.
- `corepack yarn tar` для обоих плагинов: успешно.

На настоящем PostgreSQL проверено пробное применение и повторное применение конфигурации
в одной транзакции с обязательным откатом. Проверены меню, FlowRoute, девять колонок,
единственность дочерних моделей полей, форма создания рейса с обязательным типом перевозки,
заполненный выбор привязки, одна форма поставки с шестью разделами и пути владения моделей.
Проверены группировка, пагинация, число уникальных поставок и поиск с правами root, manager,
declarant и financier. Закрытый для финансиста статус не используется для поиска.

Обнаруженная несовместимость PostgreSQL устранена: парсер сортировки NocoBase изменяет
переданный массив и добавляет первичный ключ. Адаптер теперь передаёт копию сортировки и
явную группировку, а агрегатный запрос сортирует только по ключам группы.

Штатные команды установки выполнены успешно:

```bash
docker compose exec -T app yarn pm update /app/nocobase/storage/tar/@log-company/plugin-table-personalization-2.0.73.tgz
docker compose exec -T app yarn pm update /app/nocobase/storage/tar/@log-company/plugin-process-governance-2.0.107.tgz
docker compose exec -T app yarn nocobase upgrade
docker compose restart app
```

После установки повторена проверка установленным кодом. Контрольная сумма рабочих строк
совпала с состоянием до установки: 5 рейсов, 10 поставок, 8 связей. В текущем списке
показываются 8 уникальных поставок, привязанных к рейсам; остальные исходные записи сохранены.
Приложение сообщило `app has been started`. HTTP-проверка подтвердила версии 2.0.107/2.0.73,
ответ 200 приложения и обоих JavaScript-файлов. Запрос списка без авторизации вернул 401.
Визуальный просмотр не выполнялся по указанию пользователя.
