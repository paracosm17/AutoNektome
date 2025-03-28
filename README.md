# AutoNektome 🚀

![Версия](https://img.shields.io/badge/версия-3.0-brightgreen) ![Лицензия](https://img.shields.io/badge/лицензия-MIT-blue) ![Совместимость](https://img.shields.io/badge/сайт-nekto.me/audiochat-orange)

**[AutoNektome](https://greasyfork.org/ru/scripts/498724-autonektome)** — это мощный и стильный пользовательский скрипт для [nekto.me/audiochat](https://nekto.me/audiochat), который превращает общение в удовольствие! Автоматизация, голосовое управление, улучшенная автогромкость и даже изменение голоса — всё это в одном удобном интерфейсе. Готовы к новому уровню чата? 🎤✨

## ✨ Возможности

- 🔄 **Авторежим:** автоматический переход к новому собеседнику с приятным звуковым сигналом.
- 🎙️ **Голосовое управление:** управляйте чатом голосом, даже если браузер свёрнут! Подсказки команд доступны в меню.
```javascript
const VOICE_COMMANDS = {
    skip: ['скип', 'skip', 'скиф', 'скипнуть', 'кофе', 'кефир', 'дальше'],
    stop: ['завершить', 'остановить', 'закончить', 'кумыс'],
    start: ['разговор', 'диалог', 'чат']
};
```

Хотите свои команды? Откройте скрипт, найдите `VOICE_COMMANDS` (строка 19) и настройте под себя — добавьте или уберите слова в массивах. Легко и просто! ✂️

- 🔊 **Настройки звука:**
  - 🎤 **Самопрослушивание:** слушайте себя в реальном времени с регулировкой громкости (0.1–3.0).
  - 📢 **Улучшенная автогромкость:** автоматически подстраивает громкость собеседника для комфортного общения.
  - 🎵 **Изменение голоса:** делайте голос ниже с плавной настройкой (от 0 до 0.40).
  - 🔇 **Шумоподавление:** чистый звук без лишнего фона.
  - 🔁 **Эхоподавление:** никаких эхо-эффектов.
  - 🎚️ **Автоусиление микрофона:** оптимальная громкость вашего голоса.
- 🌌 **Интерфейс:** стильное меню с переключателями и ползунками.
- 💾 **Сохранение настроек:** все параметры хранятся в `localStorage`.

**Важно:** После изменения настроек в меню перезагрузите страницу (F5 или Ctrl+R), чтобы применить некоторые параметры, такие как шумоподавление, эхоподавление или автоусиление микрофона. Это необходимо для корректной работы! 🔄

## 🛠 Установка

1. Установите менеджер скриптов:
   - [Tampermonkey](https://www.tampermonkey.net/) для Chrome, Firefox, Edge и других браузеров.
2. Включите "режим разработчика" в настройках расширений браузера (например, `chrome://extensions/`).
3. Установите скрипт, нажав [сюда](https://update.greasyfork.org/scripts/498724/AutoNektome.user.js).
4. Перейдите на [nekto.me/audiochat](https://nekto.me/audiochat) — меню настроек появится автоматически! ✅

## 📖 Как использовать

1. Зайдите на [nekto.me/audiochat](https://nekto.me/audiochat).
2. В правом верхнем углу откроется меню настроек:
   - Включите **Авторежим** для автоматического поиска собеседников.
   - Активируйте **Голосовое управление** и используйте команды (наведите на "Подсказка" в меню для списка):
     - "Скип" — следующий собеседник.
     - "Завершить" — выключить авторежим и остановить диалог.
     - "Чат" — включить авторежим и начать поиск.
   - Настройте звук: включите самопрослушивание, автогромкость, изменение голоса и другие опции.
3. После изменений в меню перезагрузите страницу для применения некоторых настроек! ⚡

## 📸 Демонстрация

### Скриншот

[![Интерфейс AutoNektome](https://s.iimg.su/s/28/IlzLzUIMtqcOUqqtq4MLabUx9IgJxZCeFVEx5yae.png)](https://iimg.su/i/vCqviG)

## 🔧 Технические детали

- Совместимость: только [https://nekto.me/audiochat](https://nekto.me/audiochat).
- Технологии: чистый JavaScript, AudioWorklet для изменения голоса.
- Хранение: настройки в `localStorage`.
- Лицензия: [MIT License](LICENSE).

## 🌟 Преимущества

- 🖱️ Лёгкая установка и интуитивный интерфейс.
- 🎙️ Полная автоматизация с голосовыми командами.
- 🔊 Профессиональные настройки звука и изменение голоса.

## 📋 Требования

- Современный браузер (Chrome, Firefox, Edge и т.д.).
- Замечались проблемы в работе голосового режима в браузере Arc. Лучше использовать браузеры на движке Chromium (Google Chrome, Yandex Browser).
- Разрешённый доступ к микрофону на сайте.

## 🙏 Благодарности

Этот проект стал лучше благодаря вкладу замечательных людей! Вот кто помогал в создании и развитии скрипта:

- **[@t3ry4git](https://greasyfork.org/ru/users/1432889-t3ry4git)** — за идеи функций самопрослушивания, эхоподавления, шумоподавления и автогромкости собеседника. Спасибо за вдохновение и креативность! 🎤🔊

Хотите внести свой вклад? Оставляйте идеи и пожелания — ваше имя может появиться здесь! ✉️

## 👨‍💻 Автор

Скрипт разработан **[@paracosm17](https://greasyfork.org/ru/users/1322915-paracosm17)**. Есть вопросы или идеи? Пишите в Telegram: [@paracosm17](https://t.me/paracosm17)! 💬

## 📜 Лицензия

Проект распространяется под [MIT License](LICENSE). Используйте, модифицируйте и делитесь свободно!

**AutoNektome** — ваш идеальный спутник для общения на nekto.me. Установите и наслаждайтесь автоматизацией и комфортом уже сегодня! 🎉
