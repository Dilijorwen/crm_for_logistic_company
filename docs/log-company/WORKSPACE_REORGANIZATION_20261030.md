# Обновление рабочего списка, 30.10.2026 — 2.0.105

## Выполнено

- Главное действие создаёт только рейс. Новую поставку создают внутри рейса с автоматической привязкой.
- Тип перевозки обязателен: Автомобильная, Железнодорожная, Авиационная, Морская. Существующие рейсы получают `road`.
- Строки одного рейса имеют одинаковую полосу. Соседние группы чередуются; типы отличаются оттенком и границей. Цвета вычисляются из токенов активной темы Ant Design/NocoBase через `theme.useToken()`, без отдельной фиксированной палитры.
- Основные вкладки: Рейс / Поставки / Дерево / История. На вкладке Поставки есть Список и номера №…; редактор всегда привязан к выбранному номеру.
- Внутри номера: Основное / Оформление / НТМ / Документы / Обсуждение / История.
- Поля рейса и привязанные поставки сохраняются одной нативной формой и одной кнопкой «Сохранить рейс».
- Удалена генерация составного названия поставки. Номер, клиент, инвойс, ЗВ и ДТ остаются самостоятельными полями.
- Popup входит в настоящее дерево маршрута. Это восстанавливает авторизацию «Моих колонок» во вложенной таблице без ослабления ACL.
- Повторный клик по номеру выполняется без кеша события. Внутренние вкладки не содержат второй кнопки назад.

## Архитектурные решения

Основная таблица остаётся стандартным `TableBlockModel`: настройки полей, действия, персонализация, фильтры и дизайнер сохраняются. Внешний блок добавляет оформление групп. Общая сборка использует обычные FlowModels и доступна для дальнейшей настройки в дизайнере.

Номерные редакторы создают отдельные `createBlockScopedEngine` с общей сохранённой конфигурацией. Экземпляры форм, текущая запись и кеш событий разделены между номерами. Переключение с несохранёнными изменениями требует явного подтверждения.

Поставка по-прежнему связана с несколькими рейсами через существующую M:N-связь. Правила удаления поставок и опустевших рейсов предыдущей версии сохраняются.

## База данных

- `20261030001000-add-transport-type.ts`: beforeLoad-переход на `transport_runs.transport_type`, заполнение NULL значением `road`, NOT NULL, CHECK четырёх вариантов и индекс `(transport_type, run_number)`.
- `20261030002000-reorganize-logistics-workspace.ts`: атомарная перестройка SQL-представления, метаданных, прав и дерева интерфейса; удаление вычисляемого `shipments.display_name`.
- Новых таблиц и новых связей нет. Основные данные поставок и рейсов, документы и история сохраняются. Старые записи истории не переписываются.
- Уже применённые миграции сохранены без изменения. Новые миграции выдерживают повторный вызов.

## Изменённые файлы

Все пути ниже относительно корня проекта.

| Путь | Назначение |
| --- | --- |
| `packages/plugins/@log-company/plugin-process-governance/package.json` | Версия сборки 2.0.105. |
| `packages/plugins/@log-company/plugin-process-governance/src/client/app/plugin.ts` | Регистрация новых моделей рабочего окна. |
| `packages/plugins/@log-company/plugin-process-governance/src/client/features/synchronize-shipment-form/model/ShipmentSynchronizedEditFormModel.ts` | Событие обновления номерных вкладок после сохранения; дедупликация отправителей. |
| `packages/plugins/@log-company/plugin-process-governance/src/client/features/synchronize-shipment-form/model/__tests__/ShipmentSynchronizedEditFormModel.test.ts` | Регрессионные проверки связанного сценария. |
| `packages/plugins/@log-company/plugin-process-governance/src/client/features/workspace-actions/model/WorkspaceActionModels.tsx` | Повторное открытие карточки без кеширования события; правильная вкладка по номеру. |
| `packages/plugins/@log-company/plugin-process-governance/src/client/features/workspace-actions/model/__tests__/WorkspaceActionModels.test.ts` | Регрессионные проверки связанного сценария. |
| `packages/plugins/@log-company/plugin-process-governance/src/client/features/workspace-actions/ui/WorkspaceAddActionModel.tsx` | Единственное действие главного списка: добавить рейс. |
| `packages/plugins/@log-company/plugin-process-governance/src/client/features/workspace-actions/ui/__tests__/WorkspaceAddActionModel.test.tsx` | Регрессионные проверки связанного сценария. |
| `packages/plugins/@log-company/plugin-process-governance/src/client/pages/logistics/api/LogisticsService.ts` | Тип перевозки и числовая идентификация поставок в существующем API-клиенте. |
| `packages/plugins/@log-company/plugin-process-governance/src/client/pages/logistics/model/types.ts` | Тип перевозки и удаление составного имени из контрактов данных. |
| `packages/plugins/@log-company/plugin-process-governance/src/client/pages/logistics/model/workspace.ts` | Поиск по самостоятельным полям без составного имени. |
| `packages/plugins/@log-company/plugin-process-governance/src/client/pages/logistics/ui/RunModal.tsx` | Обязательный выбор типа в существующей форме рейса. |
| `packages/plugins/@log-company/plugin-process-governance/src/client/pages/logistics/ui/RunShipmentsPanel.tsx` | Номер поставки в таблице и выборе связи. |
| `packages/plugins/@log-company/plugin-process-governance/src/client/pages/logistics/ui/ShipmentFormModal.tsx` | Номер поставки в заголовке существующей формы. |
| `packages/plugins/@log-company/plugin-process-governance/src/client/shared/lib/workspace-record/events.ts` | Общее событие изменения исходных записей. |
| `packages/plugins/@log-company/plugin-process-governance/src/client/shared/lib/workspace-record/index.ts` | Публичный экспорт компонентов и событий своего слоя. |
| `packages/plugins/@log-company/plugin-process-governance/src/client/widgets/workspace-context/index.ts` | Публичный экспорт компонентов и событий своего слоя. |
| `packages/plugins/@log-company/plugin-process-governance/src/client/widgets/workspace-context/ui/WorkspaceContextModels.tsx` | Изоляция контекста выбранной поставки и реальных ключей исходных записей. |
| `packages/plugins/@log-company/plugin-process-governance/src/client/widgets/workspace-context/ui/WorkspaceRecordHeader.tsx` | Заголовок поставки по номеру. |
| `packages/plugins/@log-company/plugin-process-governance/src/client/widgets/workspace-context/ui/WorkspaceSectionPageModel.tsx` | Нативные внутренние вкладки без повторного заголовка и кнопки назад. |
| `packages/plugins/@log-company/plugin-process-governance/src/client/widgets/workspace-context/ui/__tests__/WorkspaceContextModels.test.ts` | Регрессионные проверки связанного сценария. |
| `packages/plugins/@log-company/plugin-process-governance/src/client/widgets/workspace-shipments/index.ts` | Публичный экспорт компонентов и событий своего слоя. |
| `packages/plugins/@log-company/plugin-process-governance/src/client/widgets/workspace-shipments/ui/ScopedShipmentEditor.tsx` | Отдельный FlowEngine и контекст для каждого выбранного номера поставки. |
| `packages/plugins/@log-company/plugin-process-governance/src/client/widgets/workspace-shipments/ui/WorkspaceShipmentsBlockModel.tsx` | Список и номерные вкладки поставок; обновление, ошибки, защита несохранённых изменений. |
| `packages/plugins/@log-company/plugin-process-governance/src/client/widgets/workspace-table/index.ts` | Публичный экспорт компонентов и событий своего слоя. |
| `packages/plugins/@log-company/plugin-process-governance/src/client/widgets/workspace-table/model/__tests__/runBands.test.ts` | Регрессионные проверки связанного сценария. |
| `packages/plugins/@log-company/plugin-process-governance/src/client/widgets/workspace-table/model/runBands.ts` | Расчёт одинаковой полосы для строк одного рейса и границ групп. |
| `packages/plugins/@log-company/plugin-process-governance/src/client/widgets/workspace-table/ui/WorkspaceTableBlockModel.tsx` | Оформление групп рейсов и типов перевозки через актуальные токены темы. |
| `packages/plugins/@log-company/plugin-process-governance/src/server/application/logistics/ports/LogisticsRepository.ts` | Удалены порты расчёта составного имени. |
| `packages/plugins/@log-company/plugin-process-governance/src/server/collections/__tests__/logisticsCollections.test.ts` | Регрессионные проверки связанного сценария. |
| `packages/plugins/@log-company/plugin-process-governance/src/server/collections/logisticsWorkItems.ts` | Новое поле типа; номер как titleField. |
| `packages/plugins/@log-company/plugin-process-governance/src/server/collections/shipmentComments.ts` | Подпись связанной поставки через номер. |
| `packages/plugins/@log-company/plugin-process-governance/src/server/collections/shipments.ts` | Номер как titleField; удалено составное поле. |
| `packages/plugins/@log-company/plugin-process-governance/src/server/collections/transportRuns.ts` | Обязательное поле типа, единые русские варианты и индекс. |
| `packages/plugins/@log-company/plugin-process-governance/src/server/composition/LogisticsModule.ts` | Обновлена композиция серверных обработчиков. |
| `packages/plugins/@log-company/plugin-process-governance/src/server/domain/logistics/LogisticsError.ts` | Доменный код ошибки неверного типа перевозки. |
| `packages/plugins/@log-company/plugin-process-governance/src/server/domain/logistics/TransportType.ts` | Независимая от NocoBase проверка обязательного типа перевозки. |
| `packages/plugins/@log-company/plugin-process-governance/src/server/domain/logistics/__tests__/TransportType.test.ts` | Регрессионные проверки связанного сценария. |
| `packages/plugins/@log-company/plugin-process-governance/src/server/infrastructure/metadata/LogisticsAssociationFields.ts` | Подписи связей поставок через shipment_number. |
| `packages/plugins/@log-company/plugin-process-governance/src/server/infrastructure/metadata/LogisticsWorkspaceNativeModels.ts` | Нативные формы и вкладки, одна кнопка сохранения рейса, номера поставок, документы и история. |
| `packages/plugins/@log-company/plugin-process-governance/src/server/infrastructure/metadata/LogisticsWorkspacePage.ts` | Номер поставки в начальной конфигурации вместо составного названия. |
| `packages/plugins/@log-company/plugin-process-governance/src/server/infrastructure/metadata/RetireShipmentNames.ts` | Удаление составного названия, обновление связей, прав, подписей и сохранённых форм. |
| `packages/plugins/@log-company/plugin-process-governance/src/server/infrastructure/metadata/UpgradeLogisticsWorkspace.ts` | Перестройка нативного дерева, восстановление путей popup, обёртка таблицы и новая сортировка. |
| `packages/plugins/@log-company/plugin-process-governance/src/server/infrastructure/metadata/__tests__/LogisticsWorkspacePage.test.ts` | Регрессионные проверки связанного сценария. |
| `packages/plugins/@log-company/plugin-process-governance/src/server/infrastructure/persistence/nocobase/NocoBaseLogisticsRepository.ts` | Удалены запросы генерации составного имени. |
| `packages/plugins/@log-company/plugin-process-governance/src/server/infrastructure/persistence/nocobase/TransportTypeSchema.ts` | Переход существующих рейсов на обязательный тип, CHECK и индекс; повторный запуск безопасен. |
| `packages/plugins/@log-company/plugin-process-governance/src/server/infrastructure/read-model/LogisticsWorkspaceFields.ts` | Сопоставление полей рабочего списка исходным сущностям и их правам. |
| `packages/plugins/@log-company/plugin-process-governance/src/server/infrastructure/read-model/LogisticsWorkspaceViewSql.ts` | Проекция обязательного типа перевозки без составного названия. |
| `packages/plugins/@log-company/plugin-process-governance/src/server/interfaces/hooks/LogisticsHooks.ts` | Валидация типа перевозки и удаление генерации составного имени. |
| `packages/plugins/@log-company/plugin-process-governance/src/server/interfaces/hooks/__tests__/LogisticsHistory.integration.test.ts` | Регрессионные проверки связанного сценария. |
| `packages/plugins/@log-company/plugin-process-governance/src/server/interfaces/hooks/__tests__/LogisticsHooks.test.ts` | Регрессионные проверки связанного сценария. |
| `packages/plugins/@log-company/plugin-process-governance/src/server/interfaces/http/LogisticsWorkspaceActions.ts` | Поиск по русским названиям типов с соблюдением прав на поля. |
| `packages/plugins/@log-company/plugin-process-governance/src/server/interfaces/http/__tests__/LogisticsWorkspaceActions.test.ts` | Регрессионные проверки связанного сценария. |
| `packages/plugins/@log-company/plugin-process-governance/src/server/interfaces/logistics/LogisticsHttpError.ts` | Понятная ошибка 422 для неверного типа перевозки. |
| `packages/plugins/@log-company/plugin-process-governance/src/server/migrations/20261030001000-add-transport-type.ts` | Запуск соответствующего этапа миграции. |
| `packages/plugins/@log-company/plugin-process-governance/src/server/migrations/20261030002000-reorganize-logistics-workspace.ts` | Запуск соответствующего этапа миграции. |
| `packages/plugins/@log-company/plugin-process-governance/src/shared/transport.ts` | Общие коды, типы и русские названия четырёх перевозок. |
| `packages/plugins/@log-company/plugin-process-governance/src/server/domain/logistics/ShipmentDisplayName.ts` | Удалён расчёт составного имени или относящийся к нему тест. |
| `packages/plugins/@log-company/plugin-process-governance/src/server/application/logistics/RefreshShipmentDisplayName.ts` | Удалён расчёт составного имени или относящийся к нему тест. |
| `packages/plugins/@log-company/plugin-process-governance/src/server/domain/logistics/__tests__/ShipmentDisplayName.test.ts` | Удалён расчёт составного имени или относящийся к нему тест. |
| `packages/plugins/@log-company/plugin-process-governance/src/server/application/logistics/__tests__/RefreshShipmentDisplayName.test.ts` | Удалён расчёт составного имени или относящийся к нему тест. |
| `docs/log-company/PROCESS_GOVERNANCE_PLUGIN.md` | Актуальная модель данных без составного имени и с типом перевозки. |
| `docs/log-company/WORKSPACE_REORGANIZATION_20261030.md` | Этот отчёт, решения и результаты проверок. |

## Проверки

Фактически выполнены:

```sh
corepack yarn eslint --fix packages/plugins/@log-company/plugin-process-governance/src --ext .ts,.tsx
corepack yarn typecheck:log-company:server
corepack yarn typecheck:log-company:client
corepack yarn test:server packages/plugins/@log-company/plugin-process-governance --run --maxWorkers=1 --minWorkers=1
corepack yarn test:client packages/plugins/@log-company/plugin-process-governance --run --maxWorkers=1 --minWorkers=1
corepack yarn test:architecture
corepack yarn build @log-company/plugin-process-governance
corepack yarn tar @log-company/plugin-process-governance
```

ESLint: 0 ошибок и предупреждений. Типы: 0 ошибок. Сервер: 146 тестов. Клиент: 74 теста. Архитектура: 24 теста. Сборка и архив 2.0.105 созданы. Сборщик выводит предупреждение о недоступной проверке собственного обновления; сборка завершается с кодом 0.

На отдельной PostgreSQL-базе `lc_workspace105_validation`, восстановленной через pg_dump/pg_restore из рабочей базы, выполнены beforeLoad-миграция, полная штатная синхронизация схемы, afterLoad-миграция и повторный вызов. Сохранены 5 рейсов, 10 поставок, 8 связей. Проверены backfill `road`, NOT NULL, удаление составного столбца, четыре верхних вкладки и одна кнопка сохранения рейса.

Временная сборка загружена отдельным тестовым процессом без установки в рабочий сервис. Проверены создание четырёх типов, отказ для отсутствующего/неверного типа, автоматическая привязка новой поставки, отсутствие составного поля, «Мои колонки» для root/manager/declarant и отказ для anonymous. Все созданные тестовые записи откатываются транзакцией.

Визуальная проверка не выполнялась по указанию пользователя.

## Установка

После проверки свежего снимка автоматическая проверка разрешила штатную установку. Выполнены:

```sh
docker compose exec -T app yarn pm update /app/nocobase/storage/tar/@log-company/plugin-process-governance-2.0.105.tgz
docker compose exec -T app yarn nocobase upgrade
docker compose restart app
```

Версия 2.0.105 установлена; обе миграции применены штатно. Приложение пишет `app has been started` и отвечает HTTP 200.
Рабочая база после обновления: 5 рейсов, 10 поставок, 8 связей; все существующие рейсы `road`, старые поля удалены из метаданных, путь вложенной таблицы к маршруту присутствует.

Отдельный сценарий чтения опубликованного дерева и реальных данных подтвердил четыре вкладки, одну кнопку сохранения рейса, обязательные поля и правильный источник создания. Чтение и поиск рабочего списка прошли для root/manager/declarant/financier.

Первоначальный отказ автоматической проверки преодолён проверкой полного обновления и сохранности данных на отдельной базе; дополнительных разрешений пользователя не потребовалось.

## Неустранённые ограничения

Визуальная проверка не выполнялась по указанию пользователя. Геометрию и восприятие оттенков в браузере необходимо оценить при обычной работе; код использует токены активной темы. Других известных блокирующих ограничений по выполненным проверкам нет.
