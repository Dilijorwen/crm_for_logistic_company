# Архитектура CRM Log Company

## Решение

CRM развивается как модульный монолит в существующем монорепозитории. Плагин остаётся единицей интеграции
и установки NocoBase. Внутри плагина frontend и backend разделены импортами, контрактами и проверками типов.
Отдельные приложения, контейнеры и репозитории для клиента и сервера этим изменением не вводятся.

Frontend использует FSD. Backend использует Onion: `domain` и `application` не зависят от HTTP, NocoBase,
Sequelize, MinIO и Node.js API. Реализации портов находятся в `infrastructure`, транспорт — в `interfaces`,
сборка зависимостей — в `composition` и `plugin.ts`.

Правила FSD основаны на [направлении зависимостей](https://feature-sliced.design/docs/concepts/app-splitting)
и [публичных интерфейсах slices](https://feature-sliced.design/docs/concepts/low-coupling).
Структура адаптирована к блокам конструктора: самостоятельно встраиваемый блок относится к `widgets`.

## Карта frontend

| Плагин                          | Обязанности                                                                                                                                                                                   |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `plugin-chats`                  | `entities/chat`: API, модели и состояние переписки; `features/create-chat` и `features/manage-chat-members`: действия; `widgets/chats`: встраиваемый интерфейс                                |
| `plugin-process-documents`      | `entities/process-document`: DTO, API, draft и загрузка списка; `widgets/process-documents`: блок и контекст текущей поставки                                                                 |
| `plugin-process-discussion`     | `widgets/process-discussion`: существующий блок обсуждения поставки                                                                                                                           |
| `plugin-process-governance`     | `pages/logistics`: существующая страница; `widgets/run-tree`: дерево рейсов; `features/change-process-status` и `features/synchronize-shipment-form`: действия; `shared/lib`: контекст записи |
| `plugin-organization-structure` | `pages/organization`: структура организации; `pages/reset-password`: восстановление доступа; `app`: регистрация и маршруты                                                                    |
| `plugin-permit-documents`       | `features/permit-document-sync` и `features/permit-document-numbering`: существующие действия                                                                                                 |
| `plugin-collection-search`      | `features/collection-search`: поисковое действие                                                                                                                                              |
| `plugin-table-personalization`  | `features/table-personalization`: настройка таблиц                                                                                                                                            |
| `plugin-file-storage`           | `app`: интеграция файлового хранилища с клиентом NocoBase                                                                                                                                     |

Все реализации регистрации находятся в `app`. Публичные `src/client/index.ts(x)` сохраняются: имена плагинов,
зарегистрированных FlowModel, маршрутов и существующих экспортов не меняются. Модули используют существующий
runtime `@nocobase/client`; наличие FlowModel само по себе не делает модуль чистым `client-v2`.

Слои создаются только при наличии кода. `pages` хранит текущие страницы; новые фиксированные страницы
по-прежнему требуют отдельной задачи. Перенос локальной логики страницы в `features` или `entities`
выполняется при её повторном использовании или появлении отдельного сценария.

## Контракты и документы поставки

`plugin-process-documents/src/contracts/processDocuments.ts` задаёт DTO списка, область запроса и имя поля draft.
Контракт не импортирует клиентские или серверные реализации. HTTP-контроллер проверяется на совместимость
с DTO; сериализация дат даёт тот же JSON, что и ранее.

`ProcessDocumentsApi` инкапсулирует запросы и multipart-загрузку дерева папок, распаковывает ответ NocoBase
и проверяет структуру списка. `useDocumentsList` владеет загрузкой, ошибкой, выбранной папкой и правами,
игнорирует устаревшие ответы и сбрасывает папку при смене поставки/draft. UI использует публичный интерфейс сущности.
Контекст текущей записи вынесен в `useProcessTarget`, стили и таблица документов — в отдельные UI-модули.

На backend сохранены существующие use cases и границы транзакций. В персонализации таблиц
`TablePersonalizationModule` создаёт репозиторий и фабрику сценария с контекстом запроса;
HTTP-контроллер больше не создаёт infrastructure adapters. Порт чтения вложений использует
`AsyncIterable<Uint8Array>`; Node.js stream остаётся реализацией адаптера. Декодирование имени файла multipart
с помощью `Buffer` перенесено на HTTP-границу; нормализация путей и имён остаётся в domain.

Существующие HTTP/ORM-подписчики других плагинов пока взаимодействуют с техническими адаптерами внешнего
кольца. Проверка Onion гарантирует независимость внутренних слоёв, а не отсутствие всех зависимостей
между интеграционными компонентами внешнего кольца.

## Автоматические границы

`ArchitectureBoundaries.test.ts` проверяет все собственные production `.ts` и `.tsx`:

- изоляцию frontend/backend и независимость общих контрактов;
- зависимости domain/application и запрет обратных импортов infrastructure;
- направление слоёв FSD, отсутствие импортов соседних slices и обходов публичного API;
- наличие публичных интерфейсов и существование относительных импортов;
- запрет импорта legacy клиента из чистого `client-v2`.

Импорты читаются AST-парсером TypeScript, включая `import type`, re-export, `require`, `import()` и import types.
Пакеты Log Company разрешаются к `packages/plugins/@log-company`, а не к установленным копиям.
Проверки самих правил находятся в `ArchitectureRules.test.ts`. Вычисляемые динамические пути не являются
поддерживаемым способом межмодульных зависимостей.

Обновлены правила ESLint, Prettier и Vitest для каталогов `src/**/lib`: это исходники FSD,
которые должны форматироваться и тестироваться, в отличие от выходного каталога `lib` пакета.

## Проверка изменений

Из корня репозитория:

```bash
corepack yarn test:architecture
corepack yarn typecheck:log-company:client
corepack yarn typecheck:log-company:server
corepack yarn typecheck:log-company:domain
corepack yarn test:client packages/plugins/@log-company --run --maxWorkers=1 --minWorkers=1
corepack yarn test:server packages/plugins/@log-company --run --maxWorkers=1 --minWorkers=1
```

Проверка domain/application выполняется с `types: []` и `lib: ["ES2021"]`: внутренние слои не могут неявно
использовать глобальные API Node.js или браузера. Проверки client/server используют настоящие исходные типы
зависимостей, но выводят диагностику собственного кода; upstream NocoBase проверяется своим tsconfig.

Серверные тесты запускаются последовательно. PostgreSQL integration suites с явными environment-флагами
требуют отдельной тестовой БД и заданного ими префикса; рабочую БД использовать нельзя.

Сборка и упаковка выполняются штатными `yarn build <имена-плагинов>` и `yarn tar <имена-плагинов>`.
При сборке должен быть задан `PLUGIN_PACKAGE_PREFIX` из `.env.example`, включающий `@log-company/plugin-`.
Иначе NocoBase встраивает соседние плагины в `dist/node_modules` и кеширует их по версии пакета.
После смены этой настройки пересоберите из чистых **выходных** каталогов `packages/plugins/@log-company/*/dist`;
это не относится к рабочему `storage/`.
Установка собранных архивов в рабочую среду выполняется plugin manager; ручное копирование в `storage/plugins`
не допускается. Перестройка структуры исходников не требует миграций БД.

## Границы выполненного перехода

Архитектурные правила применяются ко всем собственным плагинам. Полная декомпозиция каждого большого
исторического компонента не является условием FSD: обсуждение поставки и дерево рейсов остаются самостоятельными
widgets со своей внутренней реализацией. Их дальнейшее дробление имеет смысл по конкретным сценариям.

Полное отделение приложения от NocoBase потребует самостоятельной реализации регистрации блоков,
маршрутов, авторизации и метаданных конструктора. Текущий переход создаёт проверяемые границы внутри NocoBase.
