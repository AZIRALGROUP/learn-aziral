# Netcup: Aziral Learn Telegram

Размещено 21 октября 2026 на существующем VPS `89.58.7.87`. Новый VPS, платные API и домены не покупались; биллинг Gemini не подключался.

## Текущая схема

`@Learn_Aziral_bot` → webhook `https://learn-bot.aziral.com/api/telegram/webhook` → Cloudflare Worker `learn-telegram-gateway` → защищённый HTTPS origin Caddy → контейнер `learn-telegram:3002`.

Mini App: **https://learn-bot.aziral.com/telegram**. Меню бота «Учиться» указывает на этот адрес. Polling на Mac и временный Quick Tunnel остановлены. Telegram доставляет обновления последовательно (`max_connections=1`); webhook проверяет отдельный секрет. Контейнер автоматически поднимается после перезапуска Docker/VPS (`unless-stopped`); Docker на сервере включён в автозагрузку.

Обновление удобства: прямые кнопки бота, `/newtest`, `/progress`, автоматическое сохранение и продолжение тренировок, история, повтор ошибок, карта вопросов, фильтр предмета и порционная выдача каталога. Перед обновлением сохраняется консистентная копия SQLite; таблица `attempt_details` создаётся автоматически. API сайта и общий прокси этим обновлением не меняются.

Основные пути:

| Назначение | Путь / имя |
| --- | --- |
| Код бота и Mini App | `/opt/learn-telegram` |
| Compose | `/opt/learn-telegram/compose.telegram.netcup.yml` |
| Секреты | `/opt/learn-telegram/.env.production`, права 600 |
| Постоянная база бота | `/opt/learn-telegram/data/learn.sqlite` и WAL/SHM |
| Сеть прокси | `learn-edge` |
| Существующий API сайта | `/opt/aziral-api`, контейнер `aziral-api`, сеть `deploy_internal` |
| Общий Caddy | `/opt/fenix/deploy/Caddyfile`, контейнер `deploy-caddy-1` |
| Origin | `learn-bot-origin.89-58-7-87.sslip.io` |

Публичных портов у контейнера нет. Root filesystem доступен только для чтения, процесс работает от UID 1000, сброшены capabilities, установлен `no-new-privileges`. Память ограничена 384 МБ, CPU — 0.5, PID — 80; логи ротируются. База и secret-файлы исключены из Docker build context. Образ собирается из проверенного локального `dist` через `Dockerfile.telegram.runtime` и отдельный `.dockerignore`.

Worker использует отдельный `ORIGIN_TOKEN`; Caddy проверяет его и удаляет перед передачей в приложение. Прямой origin без секрета возвращает 404. Worker удаляет поддельные служебные заголовки, Authorization и cookie; Telegram initData и секрет webhook передаются без изменений. API и Mini App имеют `private, no-store`, CDN-кеш отключён. Workers.dev, preview URL и observability выключены.

## Подключение сайта

В существующий API добавлены только `server/routes/learnBridge.js` и одна строка регистрации `/api/learn-bridge` в `server/index.js`. Каноническая копия модуля в этом репозитории — `telegram/site-bridge.cjs`. Секрет `LEARN_BRIDGE_SECRET` совпадает у двух сервисов и никогда не передаётся браузеру.

Бот проверяет подпись Telegram, затем обращается к API по внутренней сети. API сопоставляет числовой Telegram ID с `users.telegram_id`, проверяет блокировку, публикацию и права на платный курс. Используется существующее подключение libSQL/Turso. Новых ключей Turso, копий учебного каталога и прямых записей в файл реплики нет. Прогресс и XP записываются через действующий API в Turso; операции повторной отметки идемпотентны.

Публично подключены 50 тестов / 3017 вопросов, все успешно нормализованы; 16 черновиков остались закрыты. Все 17 курсов доступны в каталоге, из них 11 бесплатных и 6 с сохранёнными ограничениями оплаты. Материалы сайта редактируются на сайте; новые материалы бота и результаты дуэлей пока хранятся отдельно.

## Проверка состояния

SSH: пользователь `deploy`, ключ `/Users/naz/.ssh/id_ed25519_fenix_netcup`, `IdentitiesOnly=yes`. Приватный ключ не копировать на сервер.

```sh
docker ps --filter name=learn-telegram
docker inspect --format '{{.State.Health.Status}}' learn-telegram
docker logs --tail 50 learn-telegram
curl -fsS https://learn-bot.aziral.com/api/telegram/health
```

Ожидается HTTP 200 для health и `/telegram`, HTTP 401 для `/api/telegram/me` без подписи и POST webhook без секрета. Текущий API сайта проверяется по `/health`, **не** `/api/health`.

Не печатать полный `docker inspect`, `docker compose config` или `.env`: они содержат секреты. Для проверки Compose использовать `config -q`.

## Обновление

1. Сделать и проверить backup базы бота; для обновления API сайта дополнительно сохранить его базу, исходники, env и образ. Забрать копию вне VPS.
2. Выполнить локально `npm test`, `npm run telegram:test`, ESLint затронутого интерфейса и `npm run build`. При изменении bridge — тесты действующего API сайта. Не трогать незавершённые изменения других задач в `aziral.com`.
3. Передать только код и `dist`; не перезаписывать `.env.production`, `data/` и `backups/` архивом исходников. Обновить `LEARN_TELEGRAM_IMAGE` на новый тег в защищённом env.
4. На VPS:

```sh
cd /opt/learn-telegram
docker compose --env-file .env.production -f compose.telegram.netcup.yml build learn-telegram
docker compose --env-file .env.production -f compose.telegram.netcup.yml up -d --no-deps --no-build learn-telegram
```

5. Если изменён bridge, скопировать только его и согласованную строку mount в API, сохранить прежний образ, собрать и пересоздать только `api` в `/opt/aziral-api`. Не загружать весь локальный репозиторий сайта поверх работающего сервера.
6. Повторить public health/auth probes, проверить webhook и доступ к каталогу. Не запускать polling при настроенном webhook.

Worker обновляется штатным Wrangler с `infrastructure/cloudflare/wrangler.json`. Для смены `ORIGIN_TOKEN` обновить соответствующий секрет Worker и собственный блок Caddy согласованно. Общий Caddy не пересоздавать: менять только блок между `BEGIN LEARN TELEGRAM` / `END LEARN TELEGRAM`, сохранять inode bind-mounted файла, сначала validate, затем reload. Файл Caddy и часть API принадлежат root; для записи нужен `sudo`.

## Backup и откат

Перед размещением сохранены источник API, его env, Compose, Caddy и консистентная SQLite-копия (`VACUUM INTO`, integrity_check=ok):

- VPS: `/opt/learn-telegram/backups/pre-migration-20261020T201139Z/` (метка UTC).
- Mac: `telegram/data/backups/pre-migration-20261020T201139Z/` в текущем проекте, исключено из Git/Docker.
- Старый образ API: `aziral-api:before-learn-20261020t201139z`.
- Исходная база бота на Mac: `telegram/data/migration.sqlite`, integrity_check=ok; перенесена без тестовых пользователей.

Рабочую базу бота копировать через SQLite backup API или после остановки **только** `learn-telegram`; простое копирование одного файла при активном WAL недопустимо. Проверять копию открытием в отдельном месте и `PRAGMA integrity_check`; сохранять её вне VPS. Автоматический off-site backup этим размещением не настраивался.

Для отката бота сохранить текущую базу и переключить Compose на предыдущий проверенный образ. Не применять `down -v`, не удалять `data/`. Для отката API сначала проверить, не было ли последующих обновлений других задач: восстановление старого образа/исходников/env целиком может затереть их. Удаление блока Caddy выполнять с сохранением inode и validate/reload. Секреты никогда не переносить в Git или Obsidian.

## Доказательства проверки

- 72 frontend-теста, 28 тестов backend/интеграции/шлюза и 44 теста API сайта; сборка и ESLint прошли локально.
- Установленный Docker-образ стартует без Mac; public HTTPS-сценарий проверил подпись, каталог, тренировку, победителя дуэли, запрет повторного ответа и закрытие платного курса.
- В VPS-контейнере прочитаны и нормализованы все опубликованные тесты; выполнена одна успешная реальная генерация Gemini без личных данных.
- Webhook настроен на постоянный домен, `pending_update_count=0`, ошибок Telegram на проверке нет.
- Синтетические пользователи, тест, попытки и дуэль удалены из базы бота; настоящие пользователи и учебные материалы не менялись проверочным сценарием.
- Контейнер перезапущен после cutover: данные сохранились, health вернулся в healthy. После размещения создана новая SQLite-копия, проверена integrity_check=ok и забрана на Mac в `telegram/data/backups/post-deployment-20261021.sqlite`. Точные ID образов и результаты сохранены в закрытом runtime-отчёте `telegram/data/runtime.json`.
- GitHub workflow использует Node 24, frontend/backend-проверки и сборку. Его отдельный этап `deploy` относится к прежнему SSH-размещению сайта и не обновляет этот контейнер Netcup; последняя проверенная ошибка старого размещения — таймаут SSH-подключения. Порядок обновления бота приведён выше.
