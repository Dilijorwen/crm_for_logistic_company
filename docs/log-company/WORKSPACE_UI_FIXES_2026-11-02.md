# Исправление семи ошибок «Рейсы и поставки» — 2.0.108

## Выполнено

Исправления относятся к существующей странице «Информация» → «Таможенное оформление».
Используются стандартные FlowRoute, ViewNavigation, PopupActionModel, формы и действия NocoBase 2.0.60.

| № | Проблема | Первопричина | Исправление | Изменённые файлы / участки | Результат проверки |
| --- | --- | --- | --- | --- | --- |
| 1 | Пустая вкладка «Рейс» | `InstallWorkspacePresentation` прикреплял `lcwsrunform` к `lcwsruncontext.items`. `LogisticsWorkspaceContextBlockModel.renderComponent()` отображает `subModels.grid`, поэтому форма оказывалась вне отображаемой сетки. Заголовок при этом загружался независимо. | Форма перенесена в `lcwsruncontextgrid.items` без пересоздания полей. Для новых установок исправлен сборщик; для существующих добавлена транзакционная миграция. | `InstallWorkspacePresentation.ts`, `repairWorkspacePresentation()` в `RepairWorkspacePresentation.ts` | Регрессия воспроизводит неправильного родителя версии 107, проверяет отображаемую ветвь и сохранность UID полей после повторного исправления. Проверена конфигурация PostgreSQL. |
| 2 | Не открывается создание поставки; после этого зависает рейс | **Общая причина с №5:** `openWorkspaceView()` отключал маршрутизацию, вручную скрывал диалог и направлял embed в глобальный контейнер боковых настроек вместо рабочей области страницы. Дополнительно `lcwscreateship` был прикреплён к контексту, а не его сетке. | Переход выполняет штатный `ViewNavigation`. Контекст рейса передаётся сериализуемым `sourceId`, затем преобразуется в `workspaceRunId` и начальное `formData.runs`. Форма возвращена в `lcwsnewshipcontextgrid.items`. Внешняя страница создания использует `ChildPageModel` со штатным возвратом. | `openWorkspaceView.ts`, `WorkspacePopupActionModel.ts`, `RepairWorkspacePresentation.ts`, `InstallWorkspacePresentation.ts` | Настоящие контроллеры NocoBase дважды открывают и отменяют создание. Отдельный тест штатной CreateForm подтверждает запрос создания с `runs` и обновление списка после сохранения. |
| 3 | Избыточные отступы и удалённые/обрезанные элементы заголовка группы | Прозрачный по назначению блок списка добавлял ещё одну карточку и отступы вложенной BlockGrid. Ширина заголовка измерялась по внешней обёртке вместе с отступами карточки; `flex: 1` растягивал название и отодвигал счётчик/кнопку. | Для `pageOnly` блок отображает вложенную штатную таблицу без дополнительной карточки; отключены повторные отступы его сетки. Измеряется именно `.ant-table-container`; заголовок не растягивает название на всё свободное место. | `LogisticsWorkspaceShipmentsBlockModel.render()/onInit()`, `WorkspaceTableBlockModel.tsx` | Клиентские регрессии таблицы проходят. Правильность пиксельных расстояний и адаптивности в живом браузере визуально не проверялась. |
| 4 | Иконка пункта «Таможенное оформление» | Сборщик явно сохранял `CarOutlined` в `desktopRoutes` для `lclogworkspace`. | Только у этого маршрута `icon` установлен в `null`; остальные свойства и пункты не изменяются. | `placeWorkspaceInInformation()` в `InstallWorkspacePresentation.ts`, `repairWorkspacePresentation()` | Метаданные проверены тестом и запросом PostgreSQL. |
| 5 | Не открывается подробная страница поставки | **Та же причина, что у №2:** параллельное ручное управление embed и диалогом вне штатного стека маршрутов. | Номер поставки добавляет отдельную embed-страницу в FlowRoute. Native view stack отвечает за скрытие, закрытие и возврат. ID поставки и рейса разрешаются до штатного `openView` в рамках одного flow. Кнопка возврата показывает номер рейса; вспомогательная загрузка номера не блокирует открытие страницы. | `openWorkspaceShipment()`, `WorkspacePopupActionModel.ts`, `WorkspaceReturnButton.tsx`, `WorkspaceShipmentEditFormModel.tsx` | Три перехода к конкретной поставке и обратно с настоящими FlowRoute, viewer, scoped engines и beforeClose; сохраняются вкладка, DOM исходного рейса, введённый текст и прокрутка. |
| 6 | Вместо «Отвязать» показано троеточие | Троеточие было явно заданной кнопкой пользовательского Dropdown в `LogisticsWorkspaceDisassociateActionModel.render()`, а не штатным сокращением текста. | Кнопка заменена на иконку отвязки с tooltip и accessible name «Отвязать». Сохраняются штатные подтверждение, ACL и DisassociateActionModel. Для неё выделена компактная колонка. | `WorkspaceShipmentActions.tsx`, `WorkspaceAssociatedShipmentsTree.ts`, `RepairWorkspacePresentation.ts` | Компонентный тест нажимает иконку и подтверждает запрос `transport_runs/10/shipments:remove` для поставки 101; запросов `:destroy` нет. |
| 7 | Неактивное действие в боковом списке | Боковая панель дублировала обработчик удаления связи и проверяла права через `useACLRoleContext` старого интерфейса, вместо ACL FlowEngine и метаданных источника. Поэтому действие могло оставаться заблокированным при работающей штатной кнопке. | Боковая панель отображает ту же `LogisticsWorkspaceDisassociateActionModel` в локальном контексте настоящей association-таблицы. Модель не сохраняется в общую схему и удаляется из памяти при размонтировании. Добавление использует `ctx.aclCheck` FlowEngine с правами на источник и поле связи. | `WorkspaceShipmentDetachButton.tsx`, `useWorkspaceRunPermissions.ts`, `WorkspaceShipmentAddButton.tsx`, `WorkspaceRunSidebar.tsx` | Проверены разрешение администратора без legacy ACL Provider, раздельные права создания/привязки, запрет операций и рабочая отвязка с очисткой временных моделей. |

## Архитектурные решения

Ручная подмена `view`, поиск глобального DOM-контейнера и изменение `hidden.value` удалены из механизма открытия карточек.
`openWorkspaceView()` использует существующий `ViewNavigation`: новое окно добавляется в стек, а смена рейса
в уже открытом окне заменяет текущую запись вместо вложения того же общего popup в самого себя.

`LogisticsWorkspacePopupActionModel` расширяет штатный `openViewFlow`, не заменяя его реализации.
Подготовка контекста выполняется шагом **того же** flow перед штатным `openView`.
Параметр маршрута `sourceId` используется для восстановления текущего рейса при переходе или обновлении страницы;
перед открытием самостоятельной формы её `sourceId` и `associationName` очищаются.
Создание получает `runs` через начальные значения формы. Исходные записи и связь M:N не дублируются.

Возврат из поставки вызывает стандартный `view.close()` с его проверкой несохранённых изменений.
FlowRoute сохраняет исходную страницу, окно рейса и положение его таблицы. Отдельный запрос номера для
подписи возврата не находится на критическом пути открытия карточки.

Отвязка в двух местах использует один класс штатного действия. В боковой панели создаются только локальные
модели TableBlockModel и действия, привязанные к реальному association resource. Они не записываются в FlowModelRepository.
Проверки на сервере не отключаются и права ролей не расширяются.

## Изменённые файлы

Пути указаны от `packages/plugins/@log-company/plugin-process-governance/`.

| Файл | Назначение |
| --- | --- |
| `src/client/features/workspace-actions/model/openWorkspaceView.ts` | Штатная навигация вместо ручного управления окнами |
| `src/client/features/workspace-actions/model/WorkspacePopupActionModel.ts` | Подготовка исходных ID и контекста в штатном popup flow |
| `src/client/features/workspace-actions/model/useWorkspaceRunPermissions.ts` | ACL FlowEngine для создания и привязки |
| `src/client/features/workspace-actions/ui/WorkspaceReturnButton.tsx` | Возврат с номером исходного рейса |
| `src/client/features/workspace-actions/ui/WorkspaceShipmentDetachButton.tsx` | Повторное использование штатной отвязки в боковой панели |
| `src/client/features/workspace-actions/ui/WorkspaceShipmentActions.tsx` | Иконка отвязки с tooltip вместо Dropdown |
| `src/client/features/workspace-actions/ui/WorkspaceShipmentAddButton.tsx` | Подключение правильной проверки прав |
| `src/client/features/workspace-actions/ui/WorkspaceSharedShipmentBadge.tsx` | Доступ к метаданным общей поставки из штатного стека окон |
| `src/client/features/workspace-actions/index.ts` | Публичные экспорты новых компонентов и модели |
| `src/client/app/plugin.ts` | Регистрация модели popup |
| `src/client/widgets/workspace-table/ui/WorkspaceRunSidebar.tsx` | Общая native-отвязка вместо собственного API-обработчика |
| `src/client/widgets/workspace-table/ui/WorkspaceTableBlockModel.tsx` | Ширина по viewport таблицы и компактный заголовок |
| `src/client/widgets/workspace-shipments/ui/WorkspaceShipmentsBlockModel.tsx` | Устранение лишней карточки и повторных отступов |
| `src/client/widgets/workspace-shipment-page/ui/WorkspaceShipmentEditFormModel.tsx` | Подключение кнопки возврата |
| `src/server/infrastructure/metadata/InstallWorkspacePresentation.ts` | Правильные родители форм при сборке новой страницы |
| `src/server/infrastructure/metadata/WorkspaceAssociatedShipmentsTree.ts` | Ширина колонки отвязки |
| `src/server/infrastructure/metadata/RepairWorkspacePresentation.ts` | Узкое транзакционное исправление существующей конфигурации |
| `src/server/migrations/20261102030000-repair-workspace-views.ts` | Применение исправления на существующей установке |
| `src/server/infrastructure/metadata/__tests__/LogisticsWorkspacePage.test.ts` | Регрессия неправильного родителя форм и идемпотентности |
| `src/client/features/workspace-actions/model/__tests__/WorkspacePopupLifecycle.test.ts` | Контракт штатных параметров маршрута и разрешения контекста |
| `src/client/features/workspace-actions/model/__tests__/WorkspaceNativeNavigation.test.tsx` | Настоящий жизненный цикл окон NocoBase без браузера |
| `src/client/features/workspace-actions/ui/__tests__/WorkspaceSourceActions.test.tsx` | Права, native-отвязка и отправка формы создания со связью |
| `package.json` | Версия 2.0.108 |

Документация: этот отчёт и ссылки из `WORKSPACE_GROUPED_INTERFACE.md` и `PROCESS_GOVERNANCE_PLUGIN.md`.

## База данных

Новых бизнес-таблиц, колонок, индексов и связей нет. Миграция изменяет только родительские связи моделей форм,
классы трёх popup, режим штатной навигации, внешний контейнер страницы создания, ширину колонки действия и одну иконку меню.
Полевая конфигурация и личные настройки таблиц не пересоздаются. Исправление идемпотентно и выполняется транзакционно.
Проверка с откатом на настоящем PostgreSQL подтвердила сохранность 7 рейсов, 10 поставок и 9 связей.

## Проверки

Фактически выполнены:

```bash
corepack yarn test:client packages/plugins/@log-company/plugin-process-governance/src/client --run --maxWorkers=1 --minWorkers=1
corepack yarn test:server packages/plugins/@log-company/plugin-process-governance/src/server --run --maxWorkers=1 --minWorkers=1
corepack yarn test:architecture
corepack yarn typecheck:log-company:client
corepack yarn typecheck:log-company:server
corepack yarn eslint --fix <перечисленные выше затронутые файлы>
corepack yarn build @log-company/plugin-process-governance --no-dts
corepack yarn tar @log-company/plugin-process-governance
```

Результаты: **97 клиентских**, **155 серверных**, **24 архитектурных** теста прошли;
проверки типов клиента и сервера — без ошибок; ESLint и сборка — успешно.

Для проверки навигации замещено только хранилище моделей и ответы API тестовыми fixtures.
Исполняются настоящие FlowRoute, openView, ViewNavigation, view holders, scoped engines и beforeClose.
Тесты проверяют конкретные ID, повторные открытия, отмену, возврат, сохранение DOM/значений/прокрутки,
payload штатной формы и endpoint штатной отвязки. Рабочие записи для этих тестов не создавались.

На PostgreSQL отдельно проверены восстановление нужной ветви моделей, повторное исправление,
откат, контрольная сумма бизнес-данных и доступ рабочих ролей к списку и поиску.

## Неустранённые ограничения проверки

Браузер и визуальная проверка не использовались по ранее данному указанию пользователя.
Ручные сценарии A–E в живом интерфейсе не заявляются выполненными.
Автотесты подтверждают описанные контроллеры и контракты; пиксельные отступы, адаптивность и
отображение полной рабочей формы с реальными данными требуют просмотра в браузере.

## Установка и проверка после обновления

Выполнены штатные команды, все завершились с кодом 0:

```bash
docker compose exec -T app yarn pm update /app/nocobase/storage/tar/@log-company/plugin-process-governance-2.0.108.tgz
docker compose exec -T app yarn nocobase upgrade
docker compose restart app
```

Миграция `20261102030000-repair-workspace-views` применена. Приложение сообщило
`app has been started`. Повторная проверка установленным кодом подтвердила правильные
родители форм, классы окон, штатный возврат страницы создания и отсутствие иконки меню.
Контрольная сумма исходных бизнес-строк совпала с состоянием до обновления:
**7 рейсов, 10 поставок, 9 связей**. Проверены доступ рабочих ролей и поиск;
закрытые поля финансовой роли остаются закрытыми.

HTTP: версия плагина 2.0.108, приложение — 200, новый JavaScript с зарегистрированной
моделью routed popup — 200. Запрос рабочего списка без авторизации — 401.
