# Uberlang — пайплайн, дистрибуция, первые пользователи

Статус: черновик · Версия 0.1 · Обновлено 2026-10-01

---

## 1. Архитектура: одно ядро — много поверхностей

Ключ к эффективности: **вся логика в `src/core/`** (platform-agnostic, только
веб-API: `fetch`, `URLSearchParams`, `AbortController`). Поверхности — тонкие:

```
src/core/                ← этимология, перевод, оркестрация (общее ядро)
├── wiktionary.ts        (wikitext + ety-tree, троттлинг, кэш)
├── providers.ts         (DeepL / LibreTranslate / MyMemory)
├── wordTranslate.ts     (глоссы слов)
└── analyze.ts           (токенизация + сборка разбора)

src/main/  + src/preload/  → Electron (десктоп)
src/renderer/              → UI (React + MUI) — переиспользуется в вебе
extension/                 → Chrome MV3 (popup + context menu)
web/ (план)                → тот же renderer + браузерный адаптер (без сервера!)
```

Следствие: **новая поверхность почти бесплатна**. Веб-версия — это тот же
renderer, где `window.lingua` реализуется не через IPC, а напрямую вызовом ядра.
Сервер не нужен: Wiktionary отдаёт CORS (`origin=*`), MyMemory — тоже.

---

## 2. Локальный цикл разработки

| Команда | Что делает |
|---|---|
| `npm run dev` | Electron + HMR |
| `npm run typecheck` | типы для node и web контекстов |
| `npm run build` | прод-сборка десктопа |
| `npm run build:ext` | сборка расширения → `extension/dist` |
| `npm run dist:mac` / `dist:win` / `dist:linux` | инсталляторы |

Правило: **зелёный `typecheck` перед коммитом**. Дешёвая страховка от
расхождения IPC-контракта между ядром, main и UI.

### Docker

Обвязка воспроизводимости: один `Dockerfile` с таргетами.

| Команда | Что делает |
|---|---|
| `docker build -t lingua-web .` | собирает статический веб из общего ядра и раздаёт через nginx |
| `docker run --rm -p 8080:80 lingua-web` | открывает приложение на `http://localhost:8080` |
| `docker compose up --build web` | то же через compose |
| `docker build --target ci -t lingua-ci .` | прогоняет `typecheck` + сборку десктопа/расширения/веба (проверка пайплайна) |
| `docker compose --profile ci run --rm ci` | то же одной командой |

Слои: `build` (node) → `ci` (проверки) → `web` (nginx-alpine). Electron-бинарник
не скачивается (`ELECTRON_SKIP_BINARY_DOWNLOAD=1`) — веб-сборке он не нужен.
В CI задача `docker` из `.github/workflows/ci.yml` собирает оба таргета, ловя
регрессии Dockerfile.

---

## 3. CI (GitHub Actions)

`.github/workflows/ci.yml` — на каждый push/PR:

1. `npm ci`
2. `npm run typecheck`
3. `npm run build` (десктоп)
4. `npm run build:ext` (расширение)
5. загрузка `out/` и `extension/dist` как артефактов

Релиз `.github/workflows/release.yml` — на тег `v*`:

- матрица: `macos-latest` (dmg/zip), `windows-latest` (exe), `ubuntu-latest` (AppImage);
- `dist:mac/win/linux` (без подписи), загрузка в GitHub Release;
- веб: деплой на Cloudflare Pages / Netlify (бесплатно) — когда появится `web/`.

Практики экономии:
- кэш npm (`actions/setup-node` с `cache: npm`);
- `electron-builder` кэширует electron/nsis между запусками;
- сборка инсталляторов **только на теге**, не на каждый коммит;
- Linux AppImage собирается на ubuntu дешевле и без подписи.

---

## 4. Дистрибуция без бюджета на подпись

Проблема: macOS без Apple Developer ($99/год) — Gatekeeper блокирует;
Windows без сертификата — SmartScreen предупреждает. Решение — **не начинать
с подписанного десктопа**, а идти бесплатными путями.

| Канал | Стоимость | Ограничения | Приоритет |
|---|---|---|---|
| **Веб-приложение (PWA)** | 0 | ничего не подписываем, работает везде, шарится ссылкой | ★★★ первый |
| **Chrome Web Store** | $5 разово | ревью, но это ~цена кофе | ★★★ |
| **Firefox Add-ons** | 0 | свободно | ★★ |
| **Edge Add-ons** | 0 | тот же MV3-билд | ★★ |
| **Linux AppImage** | 0 | подпись не нужна | ★★ |
| **Windows `.exe`** | 0 | «Unknown publisher / More info → Run anyway» | ★★ |
| **macOS (неподписанный)** | 0 | инструкция «правый клик → Open» или `xattr -dr com.apple.quarantine` | ★ |
| **macOS нотаризованный** | $99/год | отложить до первых денег/аудитории | позже |

**Стратегия:** веб + расширение как основные каналы (нулевое трение, бесплатно),
десктоп — как «power»-вариант через GitHub Releases (Linux/Windows/mac unsigned).
Подпись macOS добавить, когда продукт подтвердит спрос.

Как ставить неподписанный macOS-билд (напишем в README):
```
xattr -dr com.apple.quarantine /Applications/Lingua.app
```
Плюс `brew install --cask ./Lingua.dmg` умеет ставить cask локально.

---

## 5. Go-to-market: как получить первых пользователей

Аудитория маленькая, но лояльная и «делимая». Каналы по важности:

1. **Веб + расширение** → минимальный порог. Открыл ссылку — уже пользуешься.
2. **Контент «одно слово — одно открытие»** (TikTok / Shorts / Reels):
   `water и вода — одно слово`, `night и noche — родня`, `father и отец — НЕ родня`.
   Этимология виральна; это главный органический канал.
3. **Reddit:** r/etymology, r/linguistics, r/languagelearning, r/IndoEuropean,
   r/Anki, r/InternetIsBeautiful. Заходить как «я сделал», с ценностью и скриншотом.
4. **Hacker News `Show HN`** и **Product Hunt** — разово, когда есть веб.
5. **Discord/Telegram** сообщества полиглотов и конлангеров.
6. **Wikimedia/Wiktionary-сообщество** — приложение честно атрибутирует и
   использует их данные; можно получить тёплый отклик и упоминание.
7. **SEO (S22):** программные страницы `etymology of X`, `X vs Y`, `cognates of Z`.
   Долгий, но бесплатный и накопительный трафик.

### Плейбук первых 100 пользователей (4 недели)

- **Нед. 1:** веб-версия + пермалинки + share-as-image + атрибуция. 15 «вау»-примеров.
- **Нед. 2:** 2–3 поста на Reddit с примерами; выложить расширение в Chrome ($5) и Firefox (0).
- **Нед. 3:** серия шортсов с примерами; ссылка в био на веб. Собрать фидбэк.
- **Нед. 4:** `Show HN` / Product Hunt; добавить 1 язык/фичу по просьбам; email/отзывы.

### Виральные петли
- **Share-as-image** древа — каждая картинка = реклама.
- **Пермалинк** результата — встраивается в тред/пост.
- **Программное SEO** — из данных Wiktionary, без ручного контента.

### Метрики роста
North Star — «открытия»/неделю (сессии с найденным общим корнем).
Доп.: install→first-open, доля сессий с разбором, возврат D7, установки расширения.

---

## 6. Бэклог пайплайна

- [x] `web/` — тот же renderer + браузерный адаптер ядра (без сервера).
- [x] `build:web` (деплой: любой статик-хостинг, напр. Cloudflare Pages).
- [x] GitHub Actions: `ci.yml`, `release.yml`.
- [x] Экспорт древа в PNG (canvas) + пермалинк (S15).
- [x] README с инструкциями запуска, сборки и обхода Gatekeeper.
- [x] ADR на веб-адаптер и на отказ от подписи на старте (ADR-005, ADR-006).
- [ ] CI: добавить `build:web` в `ci.yml`.
- [ ] Деплой веб-превью (Cloudflare Pages / Netlify) по push.
- [ ] SEO-страницы `/word/:w`, `/pair/:a/:b` (S22).
