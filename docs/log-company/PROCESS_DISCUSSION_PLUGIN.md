# Обсуждение поставки

Плагин `@log-company/plugin-process-discussion` версии `2.0.63` предоставляет самостоятельный блок
`Обсуждение поставки` для конструктора NocoBase. Блок добавляется пользователем в popup или detail-форму записи
коллекции `shipments`; готовую страницу и фиксированную компоновку плагин не создаёт.

Исходники в `packages/plugins/@log-company/plugin-process-discussion` являются единственным источником истины.
Установленную копию в `storage/plugins` вручную не редактируют.

## Данные и связь

Сообщения хранятся в скрытой коллекции `shipment_comments`, которая принадлежит плагину управления рейсами и
поставками:

- `shipment_id` — обязательная ссылка на `shipments.id`;
- `text` — текст сообщения;
- `attachment` — необязательное стандартное вложение NocoBase;
- `createdAt` и `createdBy` — дата и автор.

Связь `shipments.comments -> shipment_comments.shipment_id` имеет `ON DELETE CASCADE` в PostgreSQL и `onDelete:
CASCADE` в метаданных NocoBase. Поэтому при разрешённом удалении поставки её обсуждение удаляется автоматически.

Клиент читает и создаёт сообщения через association resource `shipments.comments`. Привязки к
`customs_processes` и обязательного номера машины в этом сценарии нет.

## Определение текущей поставки

Блок получает ID поставки из ближайшего контекста записи NocoBase: edit/detail popup, record context или
`filterByTk` маршрута. Маршрут используется только тогда, когда контекст действительно относится к `shipments`,
поэтому блок нельзя случайно привязать к ID рейса или другой записи.

В форме создания сообщение нельзя отправить до первого сохранения поставки. Интерфейс показывает понятное сообщение
на русском языке.

## Поведение

- последние сообщения показываются от старых к новым;
- более ранние страницы загружаются отдельно;
- видимый блок обновляет ленту polling-запросом;
- можно отправить текст, вложение или оба значения;
- сообщение сохраняется сразу и не зависит от основной кнопки сохранения поставки;
- при переключении записи старая лента очищается;
- загруженное, но не отправленное вложение можно безопасно удалить отдельным серверным action.

Вложения загружаются через поле `shipment_comments.attachment`. Сервер разрешает удалить только pending-вложение
текущего пользователя, созданное для обсуждения и ещё не связанное с сообщением.

## Архитектура и ACL

Серверная часть разделена по Onion Architecture:

- `domain` — ошибки удаления pending-вложения;
- `application` — сценарий удаления и порты;
- `infrastructure` — адаптеры NocoBase и настройка каскада;
- `interfaces` — action `processDiscussionAttachments:discard`;
- `composition` — сборка зависимостей.

Плагин не обходит ACL. Доступ к ленте определяется разрешениями на `shipments.comments`, `shipment_comments` и
`attachments`. Все подписи нового интерфейса заданы непосредственно на русском языке, без i18n.

## Сборка и обновление

```bash
yarn eslint --fix packages/plugins/@log-company/plugin-process-discussion/src
yarn build @log-company/plugin-process-discussion
yarn tar @log-company/plugin-process-discussion
docker compose exec -T app yarn pm update /app/nocobase/storage/tar/@log-company/plugin-process-discussion-2.0.63.tgz
docker compose exec -T app yarn nocobase upgrade
docker compose restart app
```

После обновления проверяют отображение блока внутри существующей поставки, отправку текста и вложения, а также
удаление поставки без связей с рейсами.
