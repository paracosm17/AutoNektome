// ==UserScript==
// @name         AutoNektome
// @namespace    http://tampermonkey.net/
// @version      5.0.0
// @description  Автоматический переход с настройками звука, голосовым управлением и выбором тем для nekto.me audiochat.
// @author       @paracosm17
// @match        *://*nekto.me/audiochat*
// @run-at       document-start
// @grant        none
// @license      MIT
// @downloadURL https://update.greasyfork.org/scripts/498724/AutoNektome.user.js
// @updateURL https://update.greasyfork.org/scripts/498724/AutoNektome.meta.js
// @supportURL https://github.com/paracosm17/AutoNektome/issues
// @homepageURL https://github.com/paracosm17/AutoNektome
// ==/UserScript==

(function() {
    'use strict';

    const SCRIPT_VERSION = '5.0.0';

    // ### Настройка звуков уведомлений
    const START_CONVERSATION_SOUND_URL = 'https://zvukogram.com/mp3/22/skype-sound-message-received-message-received.mp3';
    const END_CONVERSATION_SOUND_URL = 'https://www.myinstants.com/media/sounds/teleport1_Cw1ot9l.mp3';
    const START_SOUND_VOLUME = 0.4;
    const END_SOUND_VOLUME = 0.3;

    // ### Настройка голосовых команд
    const DEFAULT_VOICE_COMMANDS = {
        skip: ['скип', 'skip', 'скиф', 'скипнуть', 'кефир', 'далее', 'next'],
        stop: ['завершить', 'остановить', 'закончить', 'кумыс', 'стоп', 'stop'],
        start: ['чат', 'старт', 'поиск', 'начать', 'start']
    };

    const VOICE_ACTION_LABELS = {
        skip: 'Пропустить собеседника',
        stop: 'Остановить авторежим',
        start: 'Начать поиск'
    };

    const VOICE_COMMANDS = DEFAULT_VOICE_COMMANDS;

    // ### Настройки автогромкости собеседника
    const TARGET_VOLUME = 50;
    const MIN_VOLUME = 10;
    const MAX_VOLUME = 90;
    const TRANSITION_DURATION = 1000;
    const VOLUME_CHECK_INTERVAL = 200;
    const HOLD_DURATION = 5000;
    const SILENCE_THRESHOLD = 5;
    const HISTORY_SIZE = 15;

    // ### Темы
    // Все оформления сайта теперь стандартизированы: CSS лежит в репозитории проекта.
    // Чтобы темы работали после обновления, положи папку /themes из архива в корень репозитория AutoNektome.
    const THEME_REPO_BASE = 'https://raw.githubusercontent.com/paracosm17/AutoNektome/refs/heads/main/themes/';
    const THEMES = {
        'Original': null,
        'GitHub Dark': `${THEME_REPO_BASE}github-dark.css`,
        'GitHub Dark High Contrast': `${THEME_REPO_BASE}github-dark-high-contrast.css`,
        'Catppuccin Mocha': `${THEME_REPO_BASE}catppuccin-mocha.css`,
        'Ayu Dark': `${THEME_REPO_BASE}ayu-dark.css`,
        'Gotham': `${THEME_REPO_BASE}gotham.css`,
        'Rose Pine Moon': `${THEME_REPO_BASE}rose-pine-moon.css`,
        'Gruvbox Dark': `${THEME_REPO_BASE}gruvbox-dark.css`,
        'Dracula': `${THEME_REPO_BASE}dracula.css`,
        'One Dark': `${THEME_REPO_BASE}onedark.css`,
        'Monokai': `${THEME_REPO_BASE}monokai.css`,
        'Nord': `${THEME_REPO_BASE}nord.css`
    };


    // Основные цвета окна скрипта под выбранное оформление сайта.
    const SITE_THEME_PALETTES = {
        'Original': {
            primary: '#143a66',
            primaryLight: '#93c5fd',
            primaryContainer: '#d7e3ff',
            primaryContainerDark: '#17375f',
            onPrimary: '#ffffff',
            onPrimaryDark: '#08213f',
            accent: '#2563eb'
        },
        'GitHub Dark': {
            primary: '#388bfd',
            primaryLight: '#58a6ff',
            primaryContainer: '#d8eaff',
            primaryContainerDark: '#0f315c',
            onPrimary: '#ffffff',
            onPrimaryDark: '#061b32',
            accent: '#58a6ff'
        },
        'GitHub Dark High Contrast': {
            primary: '#58a6ff',
            primaryLight: '#79c0ff',
            primaryContainer: '#d8efff',
            primaryContainerDark: '#092744',
            onPrimary: '#ffffff',
            onPrimaryDark: '#010409',
            accent: '#79c0ff'
        },
        'Catppuccin Mocha': {
            primary: '#89b4fa',
            primaryLight: '#b4befe',
            primaryContainer: '#dbe5ff',
            primaryContainerDark: '#273457',
            onPrimary: '#11111b',
            onPrimaryDark: '#11111b',
            accent: '#cba6f7'
        },
        'Ayu Dark': {
            primary: '#ffcc66',
            primaryLight: '#ffd580',
            primaryContainer: '#fff0c7',
            primaryContainerDark: '#4a3514',
            onPrimary: '#0b0e14',
            onPrimaryDark: '#0b0e14',
            accent: '#39bae6'
        },
        'Gotham': {
            primary: '#26a69a',
            primaryLight: '#4dd0e1',
            primaryContainer: '#d2fbf7',
            primaryContainerDark: '#123b3a',
            onPrimary: '#ffffff',
            onPrimaryDark: '#071415',
            accent: '#4dd0e1'
        },
        'Rose Pine Moon': {
            primary: '#c4a7e7',
            primaryLight: '#ebbcba',
            primaryContainer: '#f1e4ff',
            primaryContainerDark: '#3a2c52',
            onPrimary: '#191724',
            onPrimaryDark: '#191724',
            accent: '#9ccfd8'
        },
        'Gruvbox Dark': {
            primary: '#fabd2f',
            primaryLight: '#fe8019',
            primaryContainer: '#ffefbd',
            primaryContainerDark: '#4d3710',
            onPrimary: '#1d2021',
            onPrimaryDark: '#1d2021',
            accent: '#83a598'
        },
        'Dracula': {
            primary: '#bd93f9',
            primaryLight: '#ff79c6',
            primaryContainer: '#ead7ff',
            primaryContainerDark: '#44305f',
            onPrimary: '#1f102f',
            onPrimaryDark: '#1b1028',
            accent: '#ff79c6'
        },
        'One Dark': {
            primary: '#61afef',
            primaryLight: '#98c379',
            primaryContainer: '#d8ecff',
            primaryContainerDark: '#1d3a52',
            onPrimary: '#071722',
            onPrimaryDark: '#071722',
            accent: '#c678dd'
        },
        'Monokai': {
            primary: '#f92672',
            primaryLight: '#a6e22e',
            primaryContainer: '#ffd8e8',
            primaryContainerDark: '#55213a',
            onPrimary: '#ffffff',
            onPrimaryDark: '#172005',
            accent: '#fd971f'
        },
        'Nord': {
            primary: '#5e81ac',
            primaryLight: '#88c0d0',
            primaryContainer: '#d8e9f2',
            primaryContainerDark: '#24384f',
            onPrimary: '#ffffff',
            onPrimaryDark: '#0b1c26',
            accent: '#81a1c1'
        }
    };

    // ### Настройки из localStorage
    const settings = {
        enableLoopback: loadSetting('enableLoopback', false),
        autoGainControl: loadSetting('autoGainControl', false),
        noiseSuppression: loadSetting('noiseSuppression', true),
        echoCancellation: loadSetting('echoCancellation', false),
        gainValue: loadSetting('gainValue', 1.5, parseFloat),
        voiceControl: loadSetting('voiceControl', false),
        autoVolume: loadSetting('autoVolume', true),
        voicePitch: loadSetting('voicePitch', false),
        pitchLevel: loadSetting('pitchLevel', 0, parseFloat),
        conversationCount: loadSetting('conversationCount', 0, parseInt),
        conversationStats: loadSetting('conversationStats', {
            over5min: 0,
            over15min: 0,
            over30min: 0,
            over1hour: 0,
            over2hours: 0,
            over3hours: 0,
            over5hours: 0
        }),
        selectedTheme: loadSetting('selectedTheme', 'Catppuccin Mocha'),
        totalConversationDuration: loadSetting('totalConversationDuration', 0, parseInt),
        voiceCommands: normalizeVoiceCommands(loadSetting('voiceCommands', DEFAULT_VOICE_COMMANDS)),
        diagnosticLogs: loadSetting('diagnosticLogs', false),
        adBlock: loadSetting('adBlock', true),
        adBlockHideElements: loadSetting('adBlockHideElements', true),
        adBlockBlockNetwork: loadSetting('adBlockBlockNetwork', true),
        metricBlock: loadSetting('metricBlock', true),
        metricGlobalStubs: loadSetting('metricGlobalStubs', true),
        adBlockDetailsExpanded: loadSetting('adBlockDetailsExpanded', false),
        advancedSettingsExpanded: loadSetting('advancedSettingsExpanded', false),
        panelTheme: loadSetting('panelTheme', 'dark'),
        panelCollapsed: loadSetting('panelCollapsed', false),
        panelMiniMode: loadSetting('panelMiniMode', false),
        panelPosition: loadSetting('panelPosition', { top: 12, left: Math.max(8, window.innerWidth - 320) }),
        panelSize: loadSetting('panelSize', { width: 300, height: 0 })
    };

    // Миграция анти-рекламы v5.5: блокировка рекламы/метрик включена по умолчанию,
    // но в безопасном режиме: не блокируем script/link/fetch/XHR, чтобы не ломать Service Worker,
    // глушим beacon/img/iframe/клики и заглушаем счётчики после загрузки интерфейса.
    if (!loadSetting('adBlockSafeDefaultsMigrated_v55', false)) {
        settings.adBlock = true;
        settings.adBlockHideElements = true;
        settings.adBlockBlockNetwork = true;
        settings.metricBlock = true;
        settings.metricGlobalStubs = true;
        saveSetting('adBlock', true);
        saveSetting('adBlockHideElements', true);
        saveSetting('adBlockBlockNetwork', true);
        saveSetting('metricBlock', true);
        saveSetting('metricGlobalStubs', true);
        saveSetting('adBlockSafeDefaultsMigrated_v55', true);
    }

    // v5.5.1: сетевую часть анти-рекламы выключаем один раз по умолчанию.
    // Причина: NektoMe регистрирует service worker, который сам fetch-ит внешние рекламные/метрические скрипты.
    // Любой failed/empty response на этапе загрузки может оставлять приложение в полуинициализированном состоянии.
    // Скрытие рекламных блоков и мягкие заглушки счётчиков остаются включены.
    if (!loadSetting('adBlockNetworkSafeMigrated_v551', false)) {
        settings.adBlockBlockNetwork = false;
        saveSetting('adBlockBlockNetwork', false);
        saveSetting('adBlockNetworkSafeMigrated_v551', true);
    }

    // Миграция размера: после Material-версии 4.7 окно по умолчанию выше,
    // чтобы больше настроек было видно сразу. Существующий ручной размер меняем один раз.
    if (!loadSetting('panelLongSizeMigrated_v47', false)) {
        const migratedWidth = Math.max(340, Number(settings.panelSize?.width) || 340);
        const migratedHeight = Math.max(700, Number(settings.panelSize?.height) || 700);
        settings.panelSize = {
            width: Math.min(migratedWidth, Math.max(280, window.innerWidth - 16)),
            height: Math.min(migratedHeight, Math.max(520, window.innerHeight - 24))
        };
        saveSetting('panelSize', settings.panelSize);
        saveSetting('panelLongSizeMigrated_v47', true);
    }

    // v5.5.4: новая дефолтная геометрия — максимально узкая панель и почти полная высота.
    if (!loadSetting('panelSlimDefaultMigrated_v554', false)) {
        settings.panelSize = {
            width: 300,
            height: Math.max(520, window.innerHeight - 24)
        };
        settings.panelPosition = {
            top: 12,
            left: Math.max(8, window.innerWidth - 320)
        };
        saveSetting('panelSize', settings.panelSize);
        saveSetting('panelPosition', settings.panelPosition);
        saveSetting('panelSlimDefaultMigrated_v554', true);
    }

    // v5.5.5: по умолчанию панель подстраивается по высоте под содержимое, без пустого низа.
    if (!loadSetting('panelAutoHeightMigrated_v555', false)) {
        settings.panelSize = {
            width: 300,
            height: 0
        };
        settings.panelMiniMode = false;
        saveSetting('panelSize', settings.panelSize);
        saveSetting('panelMiniMode', false);
        saveSetting('panelAutoHeightMigrated_v555', true);
    }

    // v5.5.6: ещё раз сбрасываем старую принудительную высоту из v5.5.4/v5.5.5,
    // чтобы панель заканчивалась по содержимому, а не тянулась до низа страницы.
    if (!loadSetting('panelAutoHeightMigrated_v556', false)) {
        settings.panelSize = {
            width: 300,
            height: 0
        };
        saveSetting('panelSize', settings.panelSize);
        saveSetting('panelAutoHeightMigrated_v556', true);
    }

    // v5.5.4: логи — только по ручному включению.
    if (!loadSetting('diagnosticLogsDefaultOffMigrated_v554', false)) {
        settings.diagnosticLogs = false;
        saveSetting('diagnosticLogs', false);
        saveSetting('diagnosticLogsDefaultOffMigrated_v554', true);
    }
    // v5.5.5: новая тема по умолчанию — Catppuccin Mocha.
    // Уже выбранную пользователем тему не трогаем. Единственное исключение — авто-выставленный
    // дефолт v5.5.4, чтобы обновившийся пользователь увидел новый дефолт без ручной чистки localStorage.
    if (!loadSetting('defaultThemeCatppuccinMigrated_v555', false)) {
        const storedTheme = localStorage.getItem('selectedTheme');
        const wasAutoHcDefault = loadSetting('defaultThemeHcMigrated_v554', false) && storedTheme === JSON.stringify('GitHub Dark High Contrast');
        if (storedTheme === null || wasAutoHcDefault) {
            settings.selectedTheme = 'Catppuccin Mocha';
            saveSetting('selectedTheme', settings.selectedTheme);
        }
        saveSetting('defaultThemeCatppuccinMigrated_v555', true);
    }

    // ### Переменные состояния
    let isAutoModeEnabled = true;
    let isVoiceControlEnabled = settings.voiceControl;
    let observer = null;
    let globalStream = null;
    let audioContext = null;
    let gainNode = null;
    let micStream = null;
    let recognition = null;
    let voiceHintElement = null;
    let remoteAudioContext = null;
    let volumeAnalyser = null;
    let volumeCheckIntervalId = null;
    let lastLoudTime = 0;
    let volumeHistory = [];
    let lastAdjustedVolume = TARGET_VOLUME;
    let pitchNode = null;
    let pitchAudioContext = null;
    let pitchSource = null;
    let pitchWorkletNode = null;
    let conversationTimer = null;
    let currentConversationStart = null;
    let isConversationActive = false;
    let isMicMuted = false;
    let isHeadphonesMuted = false;
    let currentThemeLink = null;
    let adBlockObserver = null;
    let isResourceBlockerPatched = false;
    let metricStubInstalled = false;
    let githubParticlesCanvas = null;
    let githubParticlesAnimationId = null;
    let micTestState = null;
    let micTestRecordingUrl = null;

    // Переменные для управления распознаванием
    let isRecognitionActive = false; // Флаг реальной активности процесса
    let isNetworkBlocked = false; // Флаг ошибки сети

    let currentAutoVolumeStream = null;
    let activeVolumeTransitionId = 0;
    let lastAutoClickAt = 0;
    let lastAutoClickSignature = '';
    let pendingDomMaintenance = false;
    let domMutationBurstCount = 0;
    let lastDomMaintenanceAt = 0;

    // ### Утилиты
    const endConversationAudio = new Audio(END_CONVERSATION_SOUND_URL);
    endConversationAudio.volume = END_SOUND_VOLUME;
    const startConversationAudio = new Audio(START_CONVERSATION_SOUND_URL);
    startConversationAudio.volume = START_SOUND_VOLUME;

    // Блокировка штатного звука connect.mp3. Работает безопасно даже при @run-at document-start.
    function muteConnectAudio(audio) {
        if (!audio || audio.dataset.custom) return;
        const src = audio.currentSrc || audio.src || '';
        if (src.includes('connect.mp3')) {
            audio.src = '';
            audio.muted = true;
            audio.pause();
            audio.removeAttribute('preload');
            audio.setAttribute('data-blocked', 'true');
        }
    }

    const blockConnectSound = () => {
        if (!document.body) {
            document.addEventListener('DOMContentLoaded', blockConnectSound, { once: true });
            return;
        }

        document.querySelectorAll('audio').forEach(muteConnectAudio);

        const connectSoundObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType !== Node.ELEMENT_NODE) return;
                    if (node.tagName === 'AUDIO') muteConnectAudio(node);
                    node.querySelectorAll?.('audio').forEach(muteConnectAudio);
                });
            });
        });
        connectSoundObserver.observe(document.body, { childList: true, subtree: true });
    };

    blockConnectSound();
    const originalPlay = HTMLAudioElement.prototype.play;
    HTMLAudioElement.prototype.play = function() {
        const src = this.currentSrc || this.src || '';
        if (src.includes('connect.mp3') && !this.dataset.custom) {
            return Promise.resolve();
        }
        return originalPlay.apply(this, arguments);
    };

    function loadSetting(key, defaultValue, transform = JSON.parse) {
        const value = localStorage.getItem(key);
        if (value === null) return defaultValue;
        try {
            return transform(value);
        } catch (error) {
            console.warn(`AutoNektome: повреждённая настройка ${key}, использую значение по умолчанию`, error);
            return defaultValue;
        }
    }

    function saveSetting(key, value) {
        localStorage.setItem(key, JSON.stringify(value));
    }

    const diagState = {
        startedAt: performance.now(),
        history: [],
        counters: Object.create(null),
        throttle: new Map(),
        maxHistory: 350
    };

    function diagEnabled() {
        return !!settings?.diagnosticLogs;
    }

    function diag(level, event, data = null, options = {}) {
        const now = performance.now();
        const throttleMs = Number(options.throttleMs || 0);
        const key = options.key || event;
        if (throttleMs > 0) {
            const last = diagState.throttle.get(key) || 0;
            if (now - last < throttleMs) return;
            diagState.throttle.set(key, now);
        }

        diagState.counters[event] = (diagState.counters[event] || 0) + 1;
        const item = {
            t: Math.round(now - diagState.startedAt),
            level,
            event,
            data
        };
        diagState.history.push(item);
        if (diagState.history.length > diagState.maxHistory) diagState.history.shift();

        if (!diagEnabled()) return;
        const method = console[level] ? level : 'log';
        try {
            if (data === null || typeof data === 'undefined') console[method](`AutoNektome[${item.t}ms] ${event}`);
            else console[method](`AutoNektome[${item.t}ms] ${event}`, data);
        } catch (error) {}
    }

    function installDiagnostics() {
        if (window.AutoNektomeDebug?.__installed) return;

        window.addEventListener('error', (event) => {
            diag('error', 'window.error', {
                message: event.message,
                source: event.filename,
                line: event.lineno,
                col: event.colno,
                target: event.target?.tagName || null,
                resource: event.target?.src || event.target?.href || null
            }, { throttleMs: 500, key: `error:${event.message}:${event.filename}:${event.lineno}` });
        }, true);

        window.addEventListener('unhandledrejection', (event) => {
            const reason = event.reason;
            diag('error', 'window.unhandledrejection', {
                message: reason?.message || String(reason || ''),
                stack: reason?.stack || null
            }, { throttleMs: 500, key: `rejection:${reason?.message || reason}` });
        });

        window.addEventListener('load', () => {
            const app = document.querySelector('#app, .callScreen, .chat_container, .wraps');
            diag('info', 'window.load', {
                readyState: document.readyState,
                bodyChildren: document.body?.children?.length || 0,
                appDetected: !!app,
                serviceWorkerController: !!navigator.serviceWorker?.controller
            });
            setTimeout(() => {
                navigator.serviceWorker?.getRegistration?.('/sw.js').then(reg => {
                    diag('info', 'serviceWorker.registration', {
                        hasRegistration: !!reg,
                        scope: reg?.scope || null,
                        active: reg?.active?.state || null,
                        installing: reg?.installing?.state || null,
                        waiting: reg?.waiting?.state || null,
                        controlled: !!navigator.serviceWorker?.controller
                    });
                }).catch(error => diag('warn', 'serviceWorker.registration.error', error?.message || String(error)));
            }, 1000);
        }, { once: true });

        window.AutoNektomeDebug = {
            __installed: true,
            version: SCRIPT_VERSION,
            dump() {
                return {
                    version: SCRIPT_VERSION,
                    settings: { ...settings },
                    counters: { ...diagState.counters },
                    lastEvents: diagState.history.slice(-120),
                    state: {
                        isAutoModeEnabled,
                        isConversationActive,
                        hasObserver: !!observer,
                        hasAdBlockObserver: !!adBlockObserver,
                        hasRemoteAudioContext: !!remoteAudioContext,
                        remoteAudioContextState: remoteAudioContext?.state || null,
                        currentAutoVolumeStreamActive: !!currentAutoVolumeStream?.active,
                        hasVolumeInterval: !!volumeCheckIntervalId,
                        lastAutoClickAt,
                        lastAutoClickSignature,
                        pendingDomMaintenance,
                        domMutationBurstCount
                    }
                };
            },
            logs() { return diagState.history.slice(); },
            counters() { return { ...diagState.counters }; },
            enableLogs() { settings.diagnosticLogs = true; saveSetting('diagnosticLogs', true); diag('info', 'diagnosticLogs.enabled'); },
            disableLogs() { settings.diagnosticLogs = false; saveSetting('diagnosticLogs', false); diag('info', 'diagnosticLogs.disabled'); }
        };

        diag('info', 'diagnostics.installed', {
            version: SCRIPT_VERSION,
            readyState: document.readyState,
            url: location.href,
            userAgent: navigator.userAgent,
            settings: {
                adBlock: settings.adBlock,
                adBlockHideElements: settings.adBlockHideElements,
                adBlockBlockNetwork: settings.adBlockBlockNetwork,
                metricBlock: settings.metricBlock,
                autoVolume: settings.autoVolume,
                voiceControl: settings.voiceControl,
                selectedTheme: settings.selectedTheme
            }
        });
    }

    installDiagnostics();


    function normalizeCommandList(value, fallback = []) {
        const list = Array.isArray(value) ? value : String(value || '').split(/[\n,;]+/);
        const normalized = list
            .map(item => String(item || '').trim().toLowerCase())
            .filter(Boolean)
            .filter((item, index, arr) => arr.indexOf(item) === index);
        return normalized.length ? normalized : [...fallback];
    }

    function normalizeVoiceCommands(value) {
        const source = value && typeof value === 'object' ? value : {};
        return {
            skip: normalizeCommandList(source.skip, DEFAULT_VOICE_COMMANDS.skip),
            stop: normalizeCommandList(source.stop, DEFAULT_VOICE_COMMANDS.stop),
            start: normalizeCommandList(source.start, DEFAULT_VOICE_COMMANDS.start)
        };
    }

    function getVoiceCommands() {
        settings.voiceCommands = normalizeVoiceCommands(settings.voiceCommands || DEFAULT_VOICE_COMMANDS);
        return settings.voiceCommands;
    }

    function normalizeSpeechText(text) {
        return String(text || '')
            .toLowerCase()
            .replace(/[.,!?;:()[\]{}"'`~@#$%^&*_+=<>\\/|-]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function commandMatches(transcript, command) {
        const haystack = normalizeSpeechText(transcript);
        const needle = normalizeSpeechText(command);
        if (!haystack || !needle) return false;
        if (haystack === needle) return true;
        return haystack.includes(` ${needle} `) || haystack.startsWith(`${needle} `) || haystack.endsWith(` ${needle}`);
    }

    function formatDuration(totalSeconds) {
        const seconds = Math.max(0, Math.floor(Number(totalSeconds) || 0));
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        return `${m}:${String(s).padStart(2, '0')}`;
    }

    function getSiteThemePalette(themeName = settings.selectedTheme) {
        return SITE_THEME_PALETTES[themeName] || SITE_THEME_PALETTES.Original;
    }

    function applyPanelAccent(container = document.getElementById('settings-container')) {
        if (!container) return;
        const palette = getSiteThemePalette(settings.selectedTheme);
        const isDark = settings.panelTheme !== 'light';
        container.style.setProperty('--an-primary', isDark ? palette.primaryLight : palette.primary);
        container.style.setProperty('--an-on-primary', isDark ? palette.onPrimaryDark : palette.onPrimary);
        container.style.setProperty('--an-primary-container', isDark ? palette.primaryContainerDark : palette.primaryContainer);
        container.style.setProperty('--an-on-primary-container', isDark ? palette.primaryLight : palette.primary);
        container.style.setProperty('--an-accent', palette.accent);
        container.dataset.siteThemeAccent = String(settings.selectedTheme || 'Original').replace(/\s+/g, '-').toLowerCase();
    }


    function stopGitHubDarkParticles() {
        if (githubParticlesCanvas || githubParticlesAnimationId) diag('info', 'theme.particles.stop');
        if (githubParticlesAnimationId) {
            cancelAnimationFrame(githubParticlesAnimationId);
            githubParticlesAnimationId = null;
        }
        if (githubParticlesCanvas) {
            githubParticlesCanvas.remove();
            githubParticlesCanvas = null;
        }
    }

    function getThemeParticleColors() {
        const root = getComputedStyle(document.documentElement);
        return {
            bg: root.getPropertyValue('--an-theme-canvas-bg').trim() || 'rgba(13, 17, 23, 0.96)',
            rgb: root.getPropertyValue('--an-theme-particle').trim() || '88,166,255',
            shadow: root.getPropertyValue('--an-theme-particle-shadow').trim() || root.getPropertyValue('--an-theme-particle').trim() || '88,166,255'
        };
    }

    function startGitHubDarkParticles() {
        if (githubParticlesCanvas || !document.body) return;
        diag('info', 'theme.particles.start', { theme: settings.selectedTheme });
        const canvas = document.createElement('canvas');
        canvas.id = 'particles-canvas';
        canvas.setAttribute('aria-hidden', 'true');
        document.body.prepend(canvas);
        githubParticlesCanvas = canvas;

        const ctx = canvas.getContext('2d');
        const particles = [];
        const particleCount = Math.min(76, Math.max(42, Math.floor((window.innerWidth * window.innerHeight) / 22000)));

        function resize() {
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            canvas.width = Math.floor(window.innerWidth * dpr);
            canvas.height = Math.floor(window.innerHeight * dpr);
            canvas.style.width = `${window.innerWidth}px`;
            canvas.style.height = `${window.innerHeight}px`;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }

        function seed() {
            particles.length = 0;
            for (let i = 0; i < particleCount; i++) {
                particles.push({
                    x: Math.random() * window.innerWidth,
                    y: Math.random() * window.innerHeight,
                    r: 0.75 + Math.random() * 1.75,
                    vx: -0.14 + Math.random() * 0.28,
                    vy: -0.10 + Math.random() * 0.20,
                    a: 0.14 + Math.random() * 0.44
                });
            }
        }

        function draw() {
            if (!githubParticlesCanvas) return;
            const colors = getThemeParticleColors();
            ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
            ctx.fillStyle = colors.bg;
            ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);

            for (const p of particles) {
                p.x += p.vx;
                p.y += p.vy;
                if (p.x < -10) p.x = window.innerWidth + 10;
                if (p.x > window.innerWidth + 10) p.x = -10;
                if (p.y < -10) p.y = window.innerHeight + 10;
                if (p.y > window.innerHeight + 10) p.y = -10;

                ctx.beginPath();
                ctx.fillStyle = `rgba(${colors.rgb}, ${p.a})`;
                ctx.shadowColor = `rgba(${colors.shadow}, 0.34)`;
                ctx.shadowBlur = 7;
                ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;
            }

            for (let i = 0; i < particles.length; i++) {
                for (let j = i + 1; j < particles.length; j++) {
                    const a = particles[i];
                    const b = particles[j];
                    const dx = a.x - b.x;
                    const dy = a.y - b.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < 118) {
                        ctx.strokeStyle = `rgba(${colors.rgb}, ${0.11 * (1 - dist / 118)})`;
                        ctx.lineWidth = 1;
                        ctx.beginPath();
                        ctx.moveTo(a.x, a.y);
                        ctx.lineTo(b.x, b.y);
                        ctx.stroke();
                    }
                }
            }
            githubParticlesAnimationId = requestAnimationFrame(draw);
        }

        resize();
        seed();
        window.addEventListener('resize', () => {
            if (!githubParticlesCanvas) return;
            resize();
            seed();
        }, { passive: true });
        draw();
    }

    function syncSiteThemeEffects() {
        if (settings.selectedTheme !== 'Original' && THEMES[settings.selectedTheme]) startGitHubDarkParticles();
        else stopGitHubDarkParticles();
    }

    const AD_BLOCK_SELECTORS = [
        '.advBox',
        '.adv-block',
        '.advMobileBlock',
        '.horizontal_adv_container',
        '.fs_wrapper_outer',
        '.minusheiheight',
        '[id^="yandex_rtb_"]',
        '[id^="ya_adv_"]',
        '[id^="adfox_"]',
        '[id*="yandex_rtb"]',
        '[id*="adfox"]',
        '[class*="yandex_rtb"]',
        '[data-ad-id]',
        '[data-name="adWrapper"]',
        'iframe[src*="yandex"]',
        'iframe[src*="adfox"]',
        'iframe[src*="ads"]',
        'a[href*="yandex.ru/an/count"]',
        'a[href*="yabs.yandex"]',
        'img[src*="get-yabs"]',
        'img[src*="yabs_performance"]'
    ];

    const AD_CONTAINER_SELECTORS = [
        '.advBox',
        '.adv-block',
        '.advMobileBlock',
        '.horizontal_adv_container',
        '.fs_wrapper_outer',
        '[id^="yandex_rtb_"]',
        '[id^="ya_adv_"]',
        '[id^="adfox_"]',
        '[data-ad-id]',
        '[data-name="adWrapper"]'
    ];

    const BLOCKED_AD_URL_PATTERNS = [
        /(^|\.)yandex\.ru\/ads\//i,
        /(^|\.)yandex\.ru\/an\/count/i,
        /(^|\.)an\.yandex\.ru/i,
        /(^|\.)ads\.adfox\.ru/i,
        /adfox/i,
        /header-bidding/i,
        /context\.js/i,
        /yabs/i,
        /get-yabs/i,
        /yastatic\.net\/safeframe/i,
        /safeframe-bundles/i,
        /mytarget/i,
        /doubleclick\.net/i,
        /googleadservices\.com/i
    ];

    const BLOCKED_METRIC_URL_PATTERNS = [
        /(^|\.)mc\.yandex\.ru/i,
        /metrika/i,
        /tag_phono\.js/i,
        /watch\.js/i,
        /\/watch\//i,
        /(^|\.)google-analytics\.com/i,
        /(^|\.)googletagmanager\.com\/(gtag\/js|gtm\.js)/i,
        /\/g\/collect/i,
        /\/collect\?/i,
        /counter\.yadro\.ru/i,
        /\/hit;/i,
        /top\.mail\.ru/i,
        /vk\.com\/rtrg/i
    ];

    function normalizeUrlForBlocker(input) {
        try {
            if (!input) return '';
            if (typeof input === 'string') return new URL(input, location.href).href;
            if (input instanceof URL) return input.href;
            if (input.url) return new URL(input.url, location.href).href;
            return new URL(String(input), location.href).href;
        } catch (error) {
            return String(input || '');
        }
    }

    function getBlockCategory(url) {
        if (!settings.adBlock || !url) return null;
        if (settings.adBlockBlockNetwork && BLOCKED_AD_URL_PATTERNS.some(pattern => pattern.test(url))) return 'ad';
        if (settings.metricBlock && BLOCKED_METRIC_URL_PATTERNS.some(pattern => pattern.test(url))) return 'metric';
        return null;
    }

    function isScriptOrStyleResource(url, tagName = '') {
        const tag = String(tagName || '').toUpperCase();
        if (tag === 'SCRIPT' || tag === 'LINK') return true;
        return /(gtag\/js|gtm\.js|watch\.js|tag_phono\.js|context\.js|header-bidding\.js)(?:[?#]|$)/i.test(url)
            || /\.(?:js|mjs|css)(?:[?#]|$)/i.test(url);
    }

    function isSameOriginCriticalResource(url) {
        try {
            const parsed = new URL(url, location.href);
            if (parsed.origin !== location.origin) return false;
            return /^\/audiochat\/(?:js|css|img|images|assets|sound)\//i.test(parsed.pathname)
                || /^\/sw\.js$/i.test(parsed.pathname)
                || /^\/audiochat(?:\/|$)/i.test(parsed.pathname);
        } catch (error) {
            return false;
        }
    }

    // Мягкая блокировка: не трогаем script/link/fetch/XHR, чтобы Service Worker NektoMe не падал на ERR_FAILED.
    // Вместо этого глушим beacon/img/iframe/рекламные ссылки и ставим безопасные заглушки после загрузки.
    function shouldBlockRequest(input, channel = 'runtime', tagName = '') {
        if (!settings.adBlock) return false;
        const url = normalizeUrlForBlocker(input);
        if (!url || isSameOriginCriticalResource(url)) return false;

        const category = getBlockCategory(url);
        if (!category) return false;

        const normalizedChannel = String(channel || 'runtime').toLowerCase();
        const tag = String(tagName || '').toUpperCase();

        if (normalizedChannel === 'element' || normalizedChannel === 'sanitize') {
            if (isScriptOrStyleResource(url, tag)) return false;
            return tag === 'IMG' || tag === 'IFRAME' || tag === 'A' || tag === '';
        }

        if (normalizedChannel === 'fetch' || normalizedChannel === 'xhr') {
            // В безопасном режиме не перехватываем fetch/XHR: NektoMe и его Service Worker
            // болезненно реагируют на failed/empty responses во время инициализации.
            return false;
        }

        if (normalizedChannel === 'beacon' || normalizedChannel === 'image') return true;

        return !isScriptOrStyleResource(url, tag);
    }

    function makeEmptyResponse() {
        try {
            return new Response('', {
                status: 204,
                statusText: 'AutoNektome blocked',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' }
            });
        } catch (error) {
            return null;
        }
    }

    function installMetricGlobalStubs() {
        if (!settings.adBlock || !settings.metricGlobalStubs || metricStubInstalled) return;
        metricStubInstalled = true;

        const noop = () => undefined;
        const counterStub = {
            reachGoal: noop,
            hit: noop,
            params: noop,
            userParams: noop,
            notBounce: noop,
            addFileExtension: noop,
            extLink: noop,
            file: noop
        };

        const replaceFunctionIfPossible = (name) => {
            try {
                const descriptor = Object.getOwnPropertyDescriptor(window, name);
                if (!descriptor || descriptor.configurable || descriptor.writable) {
                    window[name] = noop;
                }
            } catch (error) {}
        };

        const patchCounterObject = (counter) => {
            if (!counter || typeof counter !== 'object') return;
            Object.keys(counterStub).forEach(method => {
                try { counter[method] = noop; } catch (error) {}
            });
        };

        const applySafeMetricStubs = () => {
            if (!settings.adBlock || !settings.metricGlobalStubs) return;
            try {
                replaceFunctionIfPossible('ym');
                replaceFunctionIfPossible('gtag');

                if (window.yaCounter34274390) patchCounterObject(window.yaCounter34274390);

                const descriptor = Object.getOwnPropertyDescriptor(window, 'yaCounter34274390');
                if (!descriptor || descriptor.configurable) {
                    Object.defineProperty(window, 'yaCounter34274390', {
                        configurable: true,
                        get: () => counterStub,
                        set: value => {
                            patchCounterObject(value);
                            return true;
                        }
                    });
                }

                // Не создаём window.Ya заранее: это ломало рекламный стек NektoMe/Service Worker.
                // Если объект уже появился после загрузки рекламных библиотек — мягко глушим только методы рендера.
                if (window.Ya?.Context?.AdvManager) {
                    ['render', 'renderWidget', 'renderDirect', 'destroy', 'getLoadedBanners'].forEach(method => {
                        try { window.Ya.Context.AdvManager[method] = noop; } catch (error) {}
                    });
                }
            } catch (error) {
                console.warn('AutoNektome: не удалось мягко заглушить метрики', error);
            }
        };

        // Важно: не ставим тяжёлые заглушки на document-start.
        // Даём NektoMe спокойно загрузить основной интерфейс, потом глушим последующие события аналитики.
        if (document.readyState === 'complete') {
            setTimeout(applySafeMetricStubs, 250);
        } else {
            window.addEventListener('load', () => setTimeout(applySafeMetricStubs, 250), { once: true });
        }
        setTimeout(applySafeMetricStubs, 2500);
        setTimeout(applySafeMetricStubs, 7000);
    }

    function installResourceBlockers() {
        if (isResourceBlockerPatched) return;
        isResourceBlockerPatched = true;

        // Безопасный анти-трекинг: не патчим fetch/XHR и не подменяем script/link.
        // Иначе Service Worker сайта получает ERR_FAILED/пустые ответы и может подвесить загрузку.

        const nativeSendBeacon = navigator.sendBeacon?.bind(navigator);
        if (nativeSendBeacon && !navigator.sendBeacon.__autoNektomeResourcePatched) {
            const patchedSendBeacon = function(url, data) {
                if (shouldBlockRequest(url, 'beacon')) {
                    console.debug('AutoNektome: blocked beacon', normalizeUrlForBlocker(url));
                    return true;
                }
                return nativeSendBeacon(url, data);
            };
            patchedSendBeacon.__autoNektomeResourcePatched = true;
            navigator.sendBeacon = patchedSendBeacon;
        }

        const nativeSetAttribute = Element.prototype.setAttribute;
        if (!Element.prototype.__autoNektomeSetAttributePatched) {
            Element.prototype.setAttribute = function(name, value) {
                const attr = String(name || '').toLowerCase();
                const tag = String(this.tagName || '').toUpperCase();
                if ((attr === 'src' || attr === 'href') && shouldBlockRequest(value, 'element', tag)) {
                    console.debug('AutoNektome: blocked element resource', normalizeUrlForBlocker(value));
                    this.dataset.autonektomeBlockedResource = 'true';
                    if (tag === 'IMG') value = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
                    else if (tag === 'IFRAME') value = 'about:blank';
                    else if (tag === 'A') value = 'javascript:void(0)';
                }
                return nativeSetAttribute.call(this, name, value);
            };
            Element.prototype.__autoNektomeSetAttributePatched = true;
        }

        function patchUrlProperty(prototype, propertyName, tagName, replacementUrl, channelName) {
            if (!prototype || prototype[`__autoNektome_${propertyName}_Patched`]) return;
            const descriptor = Object.getOwnPropertyDescriptor(prototype, propertyName);
            if (!descriptor || typeof descriptor.set !== 'function' || typeof descriptor.get !== 'function') return;
            try {
                Object.defineProperty(prototype, propertyName, {
                    configurable: true,
                    enumerable: descriptor.enumerable,
                    get: descriptor.get,
                    set(value) {
                        if (shouldBlockRequest(value, channelName, tagName)) {
                            console.debug('AutoNektome: blocked resource property', normalizeUrlForBlocker(value));
                            try { this.dataset.autonektomeBlockedResource = 'true'; } catch (error) {}
                            return descriptor.set.call(this, replacementUrl);
                        }
                        return descriptor.set.call(this, value);
                    }
                });
                prototype[`__autoNektome_${propertyName}_Patched`] = true;
            } catch (error) {}
        }

        patchUrlProperty(window.HTMLImageElement?.prototype, 'src', 'IMG', 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==', 'image');
        patchUrlProperty(window.HTMLIFrameElement?.prototype, 'src', 'IFRAME', 'about:blank', 'element');
    }

    function ensureAdBlockStyles() {
        let style = document.getElementById('autonektome-adblock-styles');
        if (style) return style;
        style = document.createElement('style');
        style.id = 'autonektome-adblock-styles';
        style.textContent = `
            body.autonektome-adblock-enabled .advBox,
            body.autonektome-adblock-enabled .adv-block,
            body.autonektome-adblock-enabled .advMobileBlock,
            body.autonektome-adblock-enabled .horizontal_adv_container,
            body.autonektome-adblock-enabled .fs_wrapper_outer,
            body.autonektome-adblock-enabled .minusheiheight,
            body.autonektome-adblock-enabled [id^="yandex_rtb_"],
            body.autonektome-adblock-enabled [id^="ya_adv_"],
            body.autonektome-adblock-enabled [id^="adfox_"],
            body.autonektome-adblock-enabled [id*="yandex_rtb"],
            body.autonektome-adblock-enabled [id*="adfox"],
            body.autonektome-adblock-enabled [class*="yandex_rtb"],
            body.autonektome-adblock-enabled [data-ad-id],
            body.autonektome-adblock-enabled [data-name="adWrapper"],
            body.autonektome-adblock-enabled iframe[src*="yandex"],
            body.autonektome-adblock-enabled iframe[src*="adfox"],
            body.autonektome-adblock-enabled iframe[src*="ads"],
            body.autonektome-adblock-enabled a[href*="yandex.ru/an/count"],
            body.autonektome-adblock-enabled a[href*="yabs.yandex"],
            body.autonektome-adblock-enabled img[src*="get-yabs"],
            body.autonektome-adblock-enabled img[src*="yabs_performance"] {
                display: none !important;
                visibility: hidden !important;
                opacity: 0 !important;
                width: 0 !important;
                max-width: 0 !important;
                height: 0 !important;
                max-height: 0 !important;
                min-height: 0 !important;
                margin: 0 !important;
                padding: 0 !important;
                border: 0 !important;
                overflow: hidden !important;
                pointer-events: none !important;
            }

            body.autonektome-adblock-enabled .hidden-xs.hidden-sm.col-sm-1.col-md-4.col-lg-3:has(.adv-block),
            body.autonektome-adblock-enabled .hidden-xs.hidden-sm.col-sm-1.col-md-4.col-lg-3:has([id^="yandex_rtb_"]),
            body.autonektome-adblock-enabled .hidden-xs.hidden-sm.col-sm-1.col-md-4.col-lg-3:has([id^="adfox_"]) {
                display: none !important;
            }
        `;
        (document.head || document.documentElement).appendChild(style);
        return style;
    }

    function isCriticalLayoutElement(element) {
        if (!element || element.nodeType !== Node.ELEMENT_NODE) return true;
        if (element.matches?.('html, body, #app, #audio-chat-container, .wraps, .chat_container, .outer-container, .audio-chat, .main-panel, .centerToSearchBlock')) return true;
        if (element.closest?.('#settings-container')) return true;
        return false;
    }

    function hideAdElement(element) {
        if (!element || element.nodeType !== Node.ELEMENT_NODE) return;
        if (isCriticalLayoutElement(element)) {
            diag('warn', 'adBlock.skipCriticalHide', {
                tag: element.tagName,
                id: element.id || '',
                className: String(element.className || '').slice(0, 160)
            }, { throttleMs: 1000, key: `critical-hide:${element.tagName}:${element.id}:${element.className}` });
            return;
        }

        let target = element;
        if (element.matches?.('a[href*="yandex.ru/an/count"], a[href*="yabs.yandex"], img[src*="get-yabs"], img[src*="yabs_performance"]')) {
            target = element.closest('[data-ad-id], [data-name="adWrapper"], .advBox, .adv-block') || element;
        }
        if (isCriticalLayoutElement(target)) return;

        if (!target.dataset.autonektomeAdHidden) {
            target.dataset.autonektomeOriginalStyle = target.getAttribute('style') || '';
            target.dataset.autonektomeAdHidden = 'true';
            diag('debug', 'adBlock.hideElement', {
                tag: target.tagName,
                id: target.id || '',
                className: String(target.className || '').slice(0, 160)
            }, { throttleMs: 750, key: `hide:${target.tagName}:${target.id}:${target.className}` });
        }
        target.style.setProperty('display', 'none', 'important');
        target.style.setProperty('visibility', 'hidden', 'important');
        target.style.setProperty('height', '0', 'important');
        target.style.setProperty('min-height', '0', 'important');
        target.style.setProperty('max-height', '0', 'important');
        target.style.setProperty('margin', '0', 'important');
        target.style.setProperty('padding', '0', 'important');

        const adColumn = target.closest?.('.hidden-xs.hidden-sm.col-sm-1.col-md-4.col-lg-3');
        if (adColumn && !adColumn.querySelector('#settings-container') && !isCriticalLayoutElement(adColumn)) {
            if (!adColumn.dataset.autonektomeAdHidden) {
                adColumn.dataset.autonektomeOriginalStyle = adColumn.getAttribute('style') || '';
                adColumn.dataset.autonektomeAdHidden = 'true';
            }
            adColumn.style.setProperty('display', 'none', 'important');
        }
    }

    function hideAdElements(root = document) {
        if (!settings.adBlock || !settings.adBlockHideElements || !root?.querySelectorAll) return;
        const started = performance.now();
        let hiddenAttempts = 0;
        AD_BLOCK_SELECTORS.forEach(selector => {
            try {
                if (root.matches?.(selector)) {
                    hiddenAttempts++;
                    hideAdElement(root);
                }
                root.querySelectorAll(selector).forEach(element => {
                    hiddenAttempts++;
                    hideAdElement(element);
                });
            } catch (error) {
                diag('warn', 'adBlock.selectorError', { selector, message: error?.message || String(error) }, { throttleMs: 1000, key: `selector:${selector}` });
            }
        });
        const elapsed = performance.now() - started;
        if (elapsed > 20 || hiddenAttempts > 25) {
            diag('warn', 'adBlock.hideScan.slow', { elapsedMs: Math.round(elapsed), hiddenAttempts }, { throttleMs: 1000 });
        } else {
            diag('debug', 'adBlock.hideScan', { elapsedMs: Math.round(elapsed), hiddenAttempts }, { throttleMs: 1500 });
        }
    }

    function sanitizeBlockedResources(root = document) {
        if (!settings.adBlock || !root?.querySelectorAll) return;
        const started = performance.now();
        const candidates = [];
        if (root.matches?.('iframe[src], img[src], a[href]')) candidates.push(root);
        root.querySelectorAll?.('iframe[src], img[src], a[href]').forEach(node => candidates.push(node));

        let blocked = 0;
        candidates.forEach(node => {
            if (isCriticalLayoutElement(node)) return;
            const url = node.src || node.href || node.getAttribute('src') || node.getAttribute('href');
            if (!shouldBlockRequest(url, 'sanitize', node.tagName)) return;
            node.dataset.autonektomeBlockedResource = 'true';
            blocked++;
            diag('debug', 'adBlock.sanitizeResource', {
                tag: node.tagName,
                url: normalizeUrlForBlocker(url).slice(0, 220)
            }, { throttleMs: 500, key: `sanitize:${node.tagName}:${normalizeUrlForBlocker(url)}` });

            if (node.tagName === 'IMG') {
                node.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
                hideAdElement(node);
                return;
            }
            if (node.tagName === 'A') {
                hideAdElement(node);
                return;
            }
            node.remove();
        });
        const elapsed = performance.now() - started;
        if (elapsed > 20 || blocked > 10) {
            diag('warn', 'adBlock.sanitizeScan.slow', { elapsedMs: Math.round(elapsed), candidates: candidates.length, blocked }, { throttleMs: 1000 });
        }
    }

    function restoreHiddenAds() {
        document.querySelectorAll('[data-autonektome-ad-hidden="true"]').forEach(element => {
            const originalStyle = element.dataset.autonektomeOriginalStyle;
            if (originalStyle) element.setAttribute('style', originalStyle);
            else element.removeAttribute('style');
            delete element.dataset.autonektomeOriginalStyle;
            delete element.dataset.autonektomeAdHidden;
        });
    }

    function startAdBlockObserver() {
        if (adBlockObserver || !document.body) return;
        let scheduled = false;
        let pendingRoots = [];

        function flushAdBlockRoots() {
            scheduled = false;
            const roots = pendingRoots.splice(0, 80);
            if (!settings.adBlock) return;
            const started = performance.now();
            roots.forEach(node => {
                if (!node || node.nodeType !== Node.ELEMENT_NODE) return;
                if (settings.adBlockBlockNetwork || settings.metricBlock) sanitizeBlockedResources(node);
                hideAdElements(node);
            });
            const elapsed = performance.now() - started;
            diag(elapsed > 25 ? 'warn' : 'debug', 'adBlock.observer.flush', {
                roots: roots.length,
                dropped: pendingRoots.length,
                elapsedMs: Math.round(elapsed)
            }, { throttleMs: 1000 });
            pendingRoots.length = 0;
        }

        adBlockObserver = new MutationObserver(mutations => {
            if (!settings.adBlock) return;
            let added = 0;
            mutations.forEach(mutation => {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType !== Node.ELEMENT_NODE) return;
                    added++;
                    if (pendingRoots.length < 200) pendingRoots.push(node);
                });
            });
            if (!added) return;
            diag('debug', 'adBlock.observer.mutations', { mutations: mutations.length, added }, { throttleMs: 1000 });
            if (!scheduled) {
                scheduled = true;
                requestAnimationFrame(flushAdBlockRoots);
            }
        });
        adBlockObserver.observe(document.body, { childList: true, subtree: true });
        diag('info', 'adBlock.observer.started');
    }

    function applyAdBlock() {
        const started = performance.now();
        diag('info', 'adBlock.apply', {
            adBlock: settings.adBlock,
            hideElements: settings.adBlockHideElements,
            blockNetwork: settings.adBlockBlockNetwork,
            metricBlock: settings.metricBlock,
            metricGlobalStubs: settings.metricGlobalStubs,
            hasBody: !!document.body
        }, { throttleMs: 500 });

        if (settings.adBlock) {
            if (settings.adBlockBlockNetwork || settings.metricBlock) installResourceBlockers();
            if (settings.metricGlobalStubs) installMetricGlobalStubs();
        }

        if (!document.body) {
            document.addEventListener('DOMContentLoaded', applyAdBlock, { once: true });
            return;
        }

        document.body.classList.toggle('autonektome-adblock-enabled', !!(settings.adBlock && settings.adBlockHideElements));

        if (settings.adBlock) {
            if (settings.adBlockHideElements) {
                ensureAdBlockStyles();
                hideAdElements(document);
            } else {
                document.getElementById('autonektome-adblock-styles')?.remove();
                restoreHiddenAds();
            }
            if (settings.adBlockBlockNetwork || settings.metricBlock) sanitizeBlockedResources(document);
            startAdBlockObserver();
        } else {
            document.getElementById('autonektome-adblock-styles')?.remove();
            if (adBlockObserver) {
                adBlockObserver.disconnect();
                adBlockObserver = null;
                diag('info', 'adBlock.observer.stopped');
            }
            restoreHiddenAds();
        }

        const elapsed = performance.now() - started;
        diag(elapsed > 30 ? 'warn' : 'debug', 'adBlock.apply.done', { elapsedMs: Math.round(elapsed) }, { throttleMs: 500 });
    }

    // Ставим сетевые перехваты максимально рано. DOM-часть применится после появления body.
    applyAdBlock();

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    let nativeGetUserMedia = null;
    let isGetUserMediaPatched = false;

    function getAudioConstraints() {
        return {
            autoGainControl: !!settings.autoGainControl,
            noiseSuppression: !!settings.noiseSuppression,
            echoCancellation: !!settings.echoCancellation
        };
    }

    function normalizeMediaConstraints(constraints = {}) {
        if (!constraints || !constraints.audio) return constraints;

        const normalized = { ...constraints };
        if (normalized.audio === true || typeof normalized.audio !== 'object') {
            normalized.audio = {};
        } else {
            normalized.audio = { ...normalized.audio };
        }

        Object.assign(normalized.audio, getAudioConstraints());
        return normalized;
    }

    function syncMicMuteState() {
        const streams = [micStream, globalStream].filter(Boolean);
        const seenTracks = new Set();
        streams.forEach(stream => {
            stream.getAudioTracks().forEach(track => {
                if (seenTracks.has(track)) return;
                seenTracks.add(track);
                track.enabled = !isMicMuted;
            });
        });
    }


    function ensureSiteChromePolishStyles() {
        if (document.getElementById('autonektome-site-polish-styles')) return;
        const style = document.createElement('style');
        style.id = 'autonektome-site-polish-styles';
        style.textContent = `
            body.autonektome-site-themed > .navbar,
            body.autonektome-site-themed .navbar.navbar-inverse.navbar-fixed-top,
            body.autonektome-site-themed .navbar-fixed-top,
            body.autonektome-site-themed .container.swipes,
            body.autonektome-site-themed .tabs_type_chats,
            body.autonektome-site-themed .header.header_chat,
            body.autonektome-site-themed .chat-step.idle .description,
            body.autonektome-site-themed .audio-chat .description,
            body.autonektome-site-themed .autonektome-hide-site-chrome,
            body.autonektome-site-themed a[href*="play.google.com/store/apps/details"][href*="com.nektome"],
            body.autonektome-site-themed a[href*="nekto.me/ios-chat-ruletka"],
            body.autonektome-site-themed img[src*="gplaybtn"] {
                display: none !important;
                visibility: hidden !important;
                opacity: 0 !important;
                width: 0 !important;
                height: 0 !important;
                max-width: 0 !important;
                max-height: 0 !important;
                min-height: 0 !important;
                margin: 0 !important;
                padding: 0 !important;
                border: 0 !important;
                overflow: hidden !important;
                pointer-events: none !important;
                transform: none !important;
                backdrop-filter: none !important;
                box-shadow: none !important;
            }

            body.autonektome-site-themed .wraps,
            body.autonektome-site-themed .chat_container,
            body.autonektome-site-themed .outer-container,
            body.autonektome-site-themed #audio-chat-container,
            body.autonektome-site-themed .audio-chat {
                padding-top: 0 !important;
                margin-top: 0 !important;
            }

            body.autonektome-site-themed .chat-step.idle .main-panel {
                padding-top: 18px !important;
            }

            body.autonektome-site-themed .chat-step.idle .main-panel > .users-count-panel.autonektome-online-top {
                position: relative !important;
                inset: auto !important;
                z-index: 2 !important;
                width: 100% !important;
                min-width: 0 !important;
                max-width: 100% !important;
                height: auto !important;
                min-height: 76px !important;
                max-height: none !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                flex-direction: column !important;
                gap: 6px !important;
                margin: 0 0 18px 0 !important;
                padding: 16px 20px !important;
                border-radius: 18px !important;
                border: 1px solid color-mix(in srgb, var(--an-site-accent, #89b4fa) 30%, rgba(255,255,255,.10)) !important;
                background:
                    radial-gradient(circle at 50% 0%, color-mix(in srgb, var(--an-site-accent, #89b4fa) 16%, transparent), transparent 42%),
                    linear-gradient(180deg, color-mix(in srgb, var(--an-site-surface-2, #181825) 94%, transparent), color-mix(in srgb, var(--an-site-bg, #11111b) 92%, transparent)) !important;
                color: var(--an-site-text, #cdd6f4) !important;
                box-shadow: 0 14px 34px rgba(0,0,0,.28), inset 0 1px 0 rgba(255,255,255,.045) !important;
                backdrop-filter: blur(14px) saturate(1.05) !important;
                text-align: center !important;
                overflow: visible !important;
                box-sizing: border-box !important;
            }

            body.autonektome-site-themed .users-count-panel.autonektome-online-top .talking {
                margin: 0 !important;
                width: 100% !important;
                display: flex !important;
                align-items: baseline !important;
                justify-content: center !important;
                flex-wrap: wrap !important;
                gap: 8px !important;
                color: var(--an-site-muted, #a6adc8) !important;
                font-size: 12.5px !important;
                line-height: 1.2 !important;
                text-align: center !important;
            }

            body.autonektome-site-themed .users-count-panel.autonektome-online-top .talking-count {
                display: inline-block !important;
                margin: 0 !important;
                color: var(--an-site-accent, #89b4fa) !important;
                font-size: 19px !important;
                line-height: 1.1 !important;
                font-weight: 900 !important;
                letter-spacing: .01em !important;
                text-shadow: 0 0 20px color-mix(in srgb, var(--an-site-accent, #89b4fa) 24%, transparent) !important;
                white-space: nowrap !important;
            }

            body.autonektome-site-themed .users-count-panel.autonektome-online-top .join {
                display: inline-flex !important;
                align-items: center !important;
                justify-content: center !important;
                margin: 0 auto !important;
                padding: 4px 10px !important;
                border-radius: 999px !important;
                border: 1px solid color-mix(in srgb, var(--an-site-accent, #89b4fa) 20%, transparent) !important;
                background: color-mix(in srgb, var(--an-site-accent, #89b4fa) 8%, transparent) !important;
                color: color-mix(in srgb, var(--an-site-accent, #89b4fa) 74%, var(--an-site-text, #cdd6f4)) !important;
                font-size: 11.5px !important;
                line-height: 1.15 !important;
                font-weight: 750 !important;
                white-space: nowrap !important;
            }

            @media (max-width: 680px) {
                body.autonektome-site-themed .chat-step.idle .main-panel > .users-count-panel.autonektome-online-top {
                    min-height: 72px !important;
                    padding: 14px 12px !important;
                    gap: 5px !important;
                }
                body.autonektome-site-themed .users-count-panel.autonektome-online-top .talking {
                    font-size: 11.5px !important;
                }
                body.autonektome-site-themed .users-count-panel.autonektome-online-top .talking-count {
                    font-size: 17px !important;
                }
                body.autonektome-site-themed .users-count-panel.autonektome-online-top .join {
                    font-size: 11.5px !important;
                }
            }

            /* v5.5.9: final safety pass for online counter vertical clipping */
            body.autonektome-site-themed .chat-step.idle .main-panel > .users-count-panel.autonektome-online-top,
            body.autonektome-site-themed .audio-chat .chat-step.idle .main-panel > .users-count-panel.autonektome-online-top {
                height: auto !important;
                min-height: 76px !important;
                max-height: none !important;
                overflow: visible !important;
                box-sizing: border-box !important;
            }
            body.autonektome-site-themed .users-count-panel.autonektome-online-top *,
            body.autonektome-site-themed .audio-chat .users-count-panel.autonektome-online-top * {
                max-height: none !important;
                overflow: visible !important;
                box-sizing: border-box !important;
            }
        `;
        (document.head || document.documentElement).appendChild(style);
    }

    function forceImportantStyle(element, name, value) {
        try { element?.style?.setProperty(name, value, 'important'); } catch (error) {}
    }

    function clearImportantStyle(element, name) {
        try { element?.style?.removeProperty(name); } catch (error) {}
    }

    function setSiteChromeHidden(element, hidden) {
        if (!element || element.closest?.('#settings-container')) return;
        if (hidden) {
            element.classList.add('autonektome-hide-site-chrome');
            element.dataset.autonektomeHiddenSiteChrome = 'true';
            forceImportantStyle(element, 'display', 'none');
            forceImportantStyle(element, 'visibility', 'hidden');
            forceImportantStyle(element, 'opacity', '0');
        } else if (element.dataset.autonektomeHiddenSiteChrome === 'true') {
            element.classList.remove('autonektome-hide-site-chrome');
            delete element.dataset.autonektomeHiddenSiteChrome;
            ['display', 'visibility', 'opacity', 'width', 'height', 'max-width', 'max-height', 'margin', 'padding', 'overflow', 'pointer-events'].forEach(prop => clearImportantStyle(element, prop));
        }
    }

    function applySiteChromePolish() {
        ensureSiteChromePolishStyles();
        const themed = settings.selectedTheme !== 'Original';
        document.body?.classList.toggle('autonektome-site-themed', themed);

        if (!document.body) return;
        const staticSelectors = [
            'body > .navbar',
            '.navbar.navbar-inverse.navbar-fixed-top',
            '.navbar-fixed-top',
            '.container.swipes',
            '.tabs_type_chats',
            '.header.header_chat',
            '.chat-step.idle .description',
            '.audio-chat .description'
        ];
        staticSelectors.forEach(selector => document.querySelectorAll(selector).forEach(el => setSiteChromeHidden(el, themed)));

        const layoutSelectors = ['.wraps', '.chat_container', '.outer-container', '#audio-chat-container', '.audio-chat'];
        layoutSelectors.forEach(selector => document.querySelectorAll(selector).forEach(el => {
            if (themed) {
                forceImportantStyle(el, 'padding-top', '0');
                forceImportantStyle(el, 'margin-top', '0');
            } else {
                clearImportantStyle(el, 'padding-top');
                clearImportantStyle(el, 'margin-top');
            }
        }));

        const idleMainPanel = document.querySelector('.chat-step.idle .main-panel');
        if (idleMainPanel) {
            if (themed) forceImportantStyle(idleMainPanel, 'padding-top', '18px');
            else clearImportantStyle(idleMainPanel, 'padding-top');
        }

        document.querySelectorAll('a[href*="play.google.com/store/apps/details"][href*="com.nektome"], a[href*="nekto.me/ios-chat-ruletka"], img[src*="gplaybtn"]').forEach(el => {
            setSiteChromeHidden(el, themed);
            const parent = el.parentElement;
            if (parent && parent.children.length <= 2 && !parent.closest('#settings-container')) setSiteChromeHidden(parent, themed);
        });

        document.querySelectorAll('[data-autonektome-hidden-site-chrome="true"]').forEach(el => {
            if (!themed) setSiteChromeHidden(el, false);
        });

        const onlinePanel = Array.from(document.querySelectorAll('.users-count-panel')).find(panel => !panel.closest('#settings-container'));
        if (onlinePanel && !onlinePanel.closest('#settings-container')) {
            if (!onlinePanel.__autoNektomeOriginalParent) {
                onlinePanel.__autoNektomeOriginalParent = onlinePanel.parentElement;
                onlinePanel.__autoNektomeOriginalNext = onlinePanel.nextSibling;
            }

            const mainPanel = document.querySelector('.chat-step.idle .main-panel');
            const description = mainPanel ? Array.from(mainPanel.children).find(child => child.classList?.contains('description')) : null;

            if (themed) {
                onlinePanel.classList.add('autonektome-online-top');
                if (mainPanel && onlinePanel.parentElement !== mainPanel) {
                    mainPanel.insertBefore(onlinePanel, description || mainPanel.firstChild);
                } else if (mainPanel && description && onlinePanel.nextSibling !== description) {
                    mainPanel.insertBefore(onlinePanel, description);
                }

                forceImportantStyle(onlinePanel, 'position', 'relative');
                forceImportantStyle(onlinePanel, 'top', 'auto');
                forceImportantStyle(onlinePanel, 'left', 'auto');
                forceImportantStyle(onlinePanel, 'right', 'auto');
                forceImportantStyle(onlinePanel, 'bottom', 'auto');
                forceImportantStyle(onlinePanel, 'z-index', '2');
                forceImportantStyle(onlinePanel, 'display', 'flex');
                forceImportantStyle(onlinePanel, 'width', '100%');
                forceImportantStyle(onlinePanel, 'min-width', '0');
                forceImportantStyle(onlinePanel, 'max-width', '100%');
                forceImportantStyle(onlinePanel, 'margin', '0 0 18px 0');
                forceImportantStyle(onlinePanel, 'padding', '16px 18px');
            } else {
                onlinePanel.classList.remove('autonektome-online-top');
                const originalParent = onlinePanel.__autoNektomeOriginalParent;
                const originalNext = onlinePanel.__autoNektomeOriginalNext;
                if (originalParent && originalParent.isConnected && onlinePanel.parentElement !== originalParent) {
                    originalParent.insertBefore(onlinePanel, originalNext && originalNext.isConnected ? originalNext : null);
                }
                ['position', 'top', 'left', 'right', 'bottom', 'z-index', 'display', 'width', 'min-width', 'max-width', 'padding', 'margin', 'border-radius', 'border', 'background', 'box-shadow', 'backdrop-filter'].forEach(prop => clearImportantStyle(onlinePanel, prop));
            }
        }
    }

    // ### Управление темами
    function applyTheme(themeName) {
        diag('info', 'theme.apply', { themeName }, { throttleMs: 500 });
        settings.selectedTheme = themeName;
        saveSetting('selectedTheme', themeName);
        applySiteChromePolish();
        if (currentThemeLink) {
            currentThemeLink.remove();
            currentThemeLink = null;
        }

        const loadingIndicator = document.querySelector('#site-theme-loading');
        if (loadingIndicator) loadingIndicator.style.display = 'block';

        if (themeName !== 'Original' && THEMES[themeName]) {
            const styleElement = document.createElement('style');
            styleElement.id = 'custom-theme-style';

            fetch(THEMES[themeName])
                .then(response => {
                    if (!response.ok) throw new Error('Ошибка загрузки CSS');
                    return response.text();
                })
                .then(css => {
                    styleElement.textContent = css;
                    document.head.appendChild(styleElement);
                    currentThemeLink = styleElement;
                    if (loadingIndicator) loadingIndicator.style.display = 'none';
                })
                .catch(error => {
                    console.error('Ошибка при загрузке темы:', error);
                    if (loadingIndicator) loadingIndicator.style.display = 'none';
                });
        } else if (themeName === 'Original') {
            const existingStyles = document.querySelectorAll('style[id="custom-theme-style"]');
            existingStyles.forEach(style => style.remove());
            currentThemeLink = null;
            if (loadingIndicator) loadingIndicator.style.display = 'none';
        }

        applyPanelAccent();
        syncSiteThemeEffects();
        setTimeout(applySiteChromePolish, 50);
        setTimeout(applySiteChromePolish, 450);
    }

    function createThemeSelector() {
        const themeContainer = document.createElement('section');
        themeContainer.className = 'an-section an-site-theme-section';

        const header = document.createElement('div');
        header.className = 'an-section-header';

        const titleWrap = document.createElement('div');
        const themeLabel = document.createElement('div');
        themeLabel.className = 'an-section-title';
        themeLabel.textContent = 'Оформление сайта';

        const helper = document.createElement('div');
        helper.className = 'an-section-helper';
        helper.textContent = 'Меняет тему сайта';

        titleWrap.appendChild(themeLabel);
        titleWrap.appendChild(helper);

        const loadingIndicator = document.createElement('span');
        loadingIndicator.id = 'site-theme-loading';
        loadingIndicator.className = 'an-loading-chip';
        loadingIndicator.textContent = 'Загрузка…';
        loadingIndicator.style.display = 'none';

        header.appendChild(titleWrap);
        header.appendChild(loadingIndicator);

        const selectWrapper = document.createElement('label');
        selectWrapper.className = 'an-select-wrap';

        const select = document.createElement('select');
        select.className = 'an-select';
        select.setAttribute('aria-label', 'Оформление сайта');

        for (const themeName in THEMES) {
            const option = document.createElement('option');
            option.value = themeName;
            option.textContent = themeName;
            if (themeName === settings.selectedTheme) {
                option.selected = true;
            }
            select.appendChild(option);
        }

        const arrow = document.createElement('span');
        arrow.className = 'an-select-arrow';
        arrow.textContent = '▾';

        selectWrapper.appendChild(select);
        selectWrapper.appendChild(arrow);
        themeContainer.appendChild(header);
        themeContainer.appendChild(selectWrapper);

        select.addEventListener('change', (e) => {
            applyTheme(e.target.value);
        });

        return themeContainer;
    }

    // ### AudioWorklet процессор для pitch shifting
    const pitchShiftWorkletCode = `
        class PitchShiftProcessor extends AudioWorkletProcessor {
            constructor() {
                super();
                this.bufferSize = 4096;
                this.buffer = new Float32Array(this.bufferSize);
                this.writeIndex = 0;
                this.readIndex = 0;
                this.pitchFactor = 1.0;
                this.port.onmessage = (event) => {
                    this.pitchFactor = event.data;
                };
            }

            process(inputs, outputs, parameters) {
                const input = inputs[0][0];
                const output = outputs[0][0];

                if (!input || !output) return true;

                for (let i = 0; i < input.length; i++) {
                    this.buffer[this.writeIndex] = input[i];
                    this.writeIndex = (this.writeIndex + 1) % this.bufferSize;
                }

                for (let i = 0; i < output.length; i++) {
                    const intIndex = Math.floor(this.readIndex);
                    const frac = this.readIndex - intIndex;
                    const sample1 = this.buffer[intIndex % this.bufferSize];
                    const sample2 = this.buffer[(intIndex + 1) % this.bufferSize];
                    output[i] = sample1 + (sample2 - sample1) * frac;
                    this.readIndex = (this.readIndex + this.pitchFactor) % this.bufferSize;
                }

                return true;
            }
        }

        registerProcessor('pitch-shift-processor', PitchShiftProcessor);
    `;

    // ### Функции авторежима
    function isButtonUsable(button) {
        if (!button || button.disabled) return false;
        if (button.getAttribute('aria-disabled') === 'true') return false;
        if (button.classList?.contains('disabled')) return false;
        const style = window.getComputedStyle(button);
        if (style.display === 'none' || style.visibility === 'hidden' || style.pointerEvents === 'none') return false;
        const rect = button.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
    }

    function getButtonSignature(button) {
        return [
            button.id || '',
            button.className || '',
            normalizeSpeechText(button.textContent || '').slice(0, 80),
            button.closest?.('.callScreen')?.className || ''
        ].join('|');
    }

    function getFinishedSearchContainer() {
        return document.querySelector('.callScreen.callFinished, .chat-step.finished, .chat-step.finish, .chat-step.hangup, .callFinished, .hangup');
    }

    function checkAndClickButton(reason = 'manual') {
        if (!isAutoModeEnabled) {
            diag('debug', 'autoClick.skip.disabled', { reason }, { throttleMs: 1500 });
            return;
        }

        const finishedScreen = getFinishedSearchContainer();
        if (!finishedScreen) {
            // Важно: на стартовом экране idle не нажимаем #searchCompanyBtn автоматически.
            // Авторежим здесь только готовится; автопоиск срабатывает уже между диалогами.
            const idleStartButton = document.querySelector('.chat-step.idle button#searchCompanyBtn, button#searchCompanyBtn');
            diag('debug', 'autoClick.skip.notBetweenDialogs', { reason, idleStartButton: !!idleStartButton }, { throttleMs: 1800 });
            return;
        }

        const now = Date.now();
        if (now - lastAutoClickAt < 1500) {
            diag('debug', 'autoClick.skip.cooldown', { reason, agoMs: now - lastAutoClickAt }, { throttleMs: 1000 });
            return;
        }

        const stopButton = document.querySelector('button.callScreen__cancelCallBtn.btn.danger2.cancelCallBtnNoMess, button.btn.btn-lg.stop-talk-button, button.stop-talk-button, .stop-scan-button');
        if (stopButton && !finishedScreen.contains(stopButton)) {
            diag('debug', 'autoClick.skip.busy', { reason }, { throttleMs: 1500 });
            return;
        }

        const button = finishedScreen.querySelector('button.callScreen__findBtn.btn.green.filled, button.callScreen__findBtn, button.go-scan-button, .go-scan-button, .scan-button:not(#searchCompanyBtn)');
        if (!button || !isButtonUsable(button)) {
            diag('debug', 'autoClick.skip.noUsableButton', { reason, finished: !!finishedScreen, found: !!button }, { throttleMs: 1500 });
            return;
        }

        const signature = getButtonSignature(button);
        const lastButtonClickAt = Number(button.dataset.autonektomeLastClickAt || 0);
        if (signature === lastAutoClickSignature && now - lastButtonClickAt < 3500) {
            diag('debug', 'autoClick.skip.sameButton', { reason, signature, agoMs: now - lastButtonClickAt }, { throttleMs: 1200 });
            return;
        }

        lastAutoClickAt = now;
        lastAutoClickSignature = signature;
        button.dataset.autonektomeLastClickAt = String(now);
        diag('info', 'autoClick.clickBetweenDialogs', { reason, signature, text: button.textContent?.trim() || '', classes: button.className || '' });
        button.click();
    }

    function skipConversation() {
        let stopButton = document.querySelector('button.callScreen__cancelCallBtn.btn.danger2.cancelCallBtnNoMess');

        if (!stopButton) {
            stopButton = document.querySelector('button.btn.btn-lg.stop-talk-button');
        }

        if (stopButton) {
            stopButton.click();

            setTimeout(() => {
                const confirmButton = document.querySelector('button.swal2-confirm.swal2-styled');
                if (confirmButton) {
                    confirmButton.click();
                    playNotificationOnEnd();
                } else {
                    playNotificationOnEnd();
                }
            }, 500);
        }
    }

    function playNotificationOnEnd() {
        if (isConversationActive) {
            endConversationAudio.play().catch(e => {});
            isConversationActive = false;
            updateCurrentStatusUI();
        }
    }

    function playNotificationOnStart() {
        if (!isConversationActive) {
            startConversationAudio.dataset.custom = 'true';
            startConversationAudio.play().catch(e => {});
            isConversationActive = true;
            updateCurrentStatusUI('talking');
        }
    }

    function updateSliderStyles(enable) {
        const autoSwitch = document.querySelector('#auto-mode-switch');
        if (autoSwitch) autoSwitch.classList.toggle('is-enabled', !!enable);
    }

    function applyCustomStyles(enable) {
        updateSliderStyles(enable);
    }

    function toggleAutoMode(enable) {
        isAutoModeEnabled = !!enable;
        const toggleInput = document.querySelector('#auto-mode-input');
        const toggleLabel = document.querySelector('#auto-mode-label');
        const switchLabel = document.querySelector('#auto-mode-switch');
        const autoCard = document.querySelector('#auto-mode-card');
        const miniToggleInput = document.querySelector('#mini-auto-mode-input');
        const miniToggleLabel = document.querySelector('#mini-auto-mode-label');
        const miniSwitchLabel = document.querySelector('#mini-auto-mode-switch');
        const miniAutoCard = document.querySelector('#mini-auto-mode-card');
        if (toggleInput) toggleInput.checked = isAutoModeEnabled;
        if (miniToggleInput) miniToggleInput.checked = isAutoModeEnabled;
        if (switchLabel) switchLabel.classList.toggle('is-enabled', isAutoModeEnabled);
        if (miniSwitchLabel) miniSwitchLabel.classList.toggle('is-enabled', isAutoModeEnabled);
        if (autoCard) autoCard.classList.toggle('is-disabled', !isAutoModeEnabled);
        if (miniAutoCard) miniAutoCard.classList.toggle('is-disabled', !isAutoModeEnabled);
        if (toggleLabel) {
            toggleLabel.textContent = isAutoModeEnabled ? 'Вкл' : 'Выкл';
        }
        if (miniToggleLabel) {
            miniToggleLabel.textContent = isAutoModeEnabled ? 'Авто вкл' : 'Авто выкл';
        }
        updateSliderStyles(isAutoModeEnabled);
        applyCustomStyles(isAutoModeEnabled);
    }

    // ### Аудио функции
    async function requestRawMicStream(constraints = { audio: true }) {
        const getter = nativeGetUserMedia || navigator.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices);
        if (!getter) throw new Error('navigator.mediaDevices.getUserMedia недоступен');
        return getter(normalizeMediaConstraints(constraints));
    }

    async function getMicStream() {
        try {
            micStream = await requestRawMicStream({ audio: true });
            globalStream = micStream;
            syncMicMuteState();
            if (settings.enableLoopback) enableSelfListening(globalStream);
            return micStream;
        } catch (e) {
            console.error('Ошибка получения микрофона:', e);
            return null;
        }
    }

    function stopSelfListening() {
        if (audioContext) {
            audioContext.close().catch(() => {});
            audioContext = null;
        }
        gainNode = null;
        pitchNode = null;
    }

    function enableSelfListening(stream) {
        if (!stream || !stream.getAudioTracks().length || !AudioContextClass) return;

        stopSelfListening();

        audioContext = new AudioContextClass();
        const source = audioContext.createMediaStreamSource(stream);
        gainNode = audioContext.createGain();
        gainNode.gain.value = settings.gainValue;

        // Как во втором рабочем скрипте: mic -> gain -> speakers.
        // Дополнительный lowshelf оставлен только для локального мониторинга низкого голоса.
        if (settings.voicePitch && settings.pitchLevel > 0) {
            pitchNode = audioContext.createBiquadFilter();
            pitchNode.type = 'lowshelf';
            pitchNode.frequency.value = 300;
            pitchNode.gain.value = 10;
            source.connect(pitchNode);
            pitchNode.connect(gainNode);
        } else {
            source.connect(gainNode);
        }

        gainNode.connect(audioContext.destination);
        if (audioContext.state === 'suspended') audioContext.resume().catch(() => {});
    }

    async function createPitchShiftedStream(stream) {
        if (!stream || !stream.getAudioTracks().length) return stream;

        // Важный фикс: без включённого изменения голоса возвращаем оригинальный поток.
        // Раньше скрипт всегда возвращал MediaStream из AudioContext, из-за чего nekto.me мог не получить нормальный mic stream.
        if (!settings.voicePitch || settings.pitchLevel <= 0 || !AudioContextClass) {
            return stream;
        }

        if (pitchAudioContext) pitchAudioContext.close().catch(() => {});
        pitchAudioContext = new AudioContextClass();
        pitchSource = pitchAudioContext.createMediaStreamSource(stream);
        const outputNode = pitchAudioContext.createGain();

        try {
            if (!pitchAudioContext.audioWorklet) throw new Error('AudioWorklet не поддерживается');

            const blob = new Blob([pitchShiftWorkletCode], { type: 'application/javascript' });
            const url = URL.createObjectURL(blob);
            await pitchAudioContext.audioWorklet.addModule(url);
            URL.revokeObjectURL(url);

            pitchWorkletNode = new AudioWorkletNode(pitchAudioContext, 'pitch-shift-processor');
            const pitchShiftFactor = 1.0 - settings.pitchLevel;
            pitchWorkletNode.port.postMessage(pitchShiftFactor);

            pitchNode = pitchAudioContext.createBiquadFilter();
            pitchNode.type = 'lowshelf';
            pitchNode.frequency.value = 300;
            pitchNode.gain.value = 10;

            pitchSource.connect(pitchWorkletNode);
            pitchWorkletNode.connect(pitchNode);
            pitchNode.connect(outputNode);
        } catch (error) {
            console.warn('AutoNektome: не удалось включить изменение голоса, использую обычный микрофон', error);
            pitchSource.connect(outputNode);
        }

        const destination = pitchAudioContext.createMediaStreamDestination();
        outputNode.connect(destination);
        if (pitchAudioContext.state === 'suspended') pitchAudioContext.resume().catch(() => {});
        return destination.stream;
    }

    async function buildOutgoingMicStream(rawStream) {
        micStream = rawStream;
        const outgoingStream = await createPitchShiftedStream(rawStream);
        globalStream = outgoingStream || rawStream;
        syncMicMuteState();
        if (settings.enableLoopback) enableSelfListening(globalStream);
        return globalStream;
    }

    function updatePitchEffect(enable) {
        settings.voicePitch = enable;
        saveSetting('voicePitch', enable);

        // Изменение уже переданного сайту MediaStream невозможно надёжно заменить без нового getUserMedia.
        // Поэтому обновляем только самопрослушивание; для отправки изменённого голоса нужен новый поиск/перезагрузка страницы.
        if (settings.enableLoopback && globalStream) enableSelfListening(globalStream);
    }

    function updatePitchLevel(value) {
        settings.pitchLevel = value;
        saveSetting('pitchLevel', value);
        if (pitchWorkletNode) {
            const pitchShiftFactor = 1.0 - settings.pitchLevel;
            pitchWorkletNode.port.postMessage(pitchShiftFactor);
        }
        if (settings.enableLoopback && globalStream) enableSelfListening(globalStream);
    }

    // ### Улучшенная автогромкость
    function stopAutoVolume(reason = 'manual') {
        activeVolumeTransitionId++;
        if (volumeCheckIntervalId) {
            clearInterval(volumeCheckIntervalId);
            volumeCheckIntervalId = null;
        }
        if (remoteAudioContext) {
            remoteAudioContext.close().catch(() => {});
            remoteAudioContext = null;
        }
        volumeAnalyser = null;
        currentAutoVolumeStream = null;
        volumeHistory = [];
        diag('info', 'autoVolume.stopped', { reason }, { throttleMs: 1000 });
    }

    // ### Улучшенная автогромкость
    function setupAutoVolume(stream, reason = 'unknown') {
        if (!settings.autoVolume || !stream) return;
        if (!AudioContextClass) {
            diag('warn', 'autoVolume.noAudioContext', null, { throttleMs: 3000 });
            return;
        }
        if (stream.active === false || !stream.getAudioTracks?.().length) {
            diag('warn', 'autoVolume.skip.inactiveStream', { reason, active: stream.active }, { throttleMs: 1500 });
            return;
        }

        if (currentAutoVolumeStream === stream && volumeAnalyser && volumeCheckIntervalId) {
            diag('debug', 'autoVolume.skip.sameStream', { reason }, { throttleMs: 1500 });
            return;
        }

        stopAutoVolume(`reinit:${reason}`);
        currentAutoVolumeStream = stream;

        try {
            remoteAudioContext = new AudioContextClass();
            const source = remoteAudioContext.createMediaStreamSource(stream);
            volumeAnalyser = remoteAudioContext.createAnalyser();
            volumeAnalyser.fftSize = 256;
            source.connect(volumeAnalyser);
            if (remoteAudioContext.state === 'suspended') remoteAudioContext.resume().catch(() => {});
        } catch (error) {
            diag('error', 'autoVolume.setup.error', { reason, message: error?.message || String(error), stack: error?.stack || null });
            stopAutoVolume('setup-error');
            return;
        }

        const bufferLength = volumeAnalyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        volumeHistory = [];
        lastAdjustedVolume = TARGET_VOLUME;
        lastLoudTime = 0;

        function adjustVolume() {
            const audioElement = document.querySelector('audio#audioStream');
            if (!settings.autoVolume || !volumeAnalyser || !audioElement) return;
            if (currentAutoVolumeStream?.active === false) {
                stopAutoVolume('stream-ended');
                return;
            }

            volumeAnalyser.getByteTimeDomainData(dataArray);
            let sum = 0;
            for (let i = 0; i < bufferLength; i++) {
                const value = (dataArray[i] - 128) / 128;
                sum += value * value;
            }
            const rms = Math.sqrt(sum / bufferLength);
            const volumeLevel = Math.min(1, rms * 10) * 100;

            volumeHistory.push(volumeLevel);
            if (volumeHistory.length > HISTORY_SIZE) volumeHistory.shift();

            const avgVolume = volumeHistory.reduce((a, b) => a + b, 0) / volumeHistory.length;

            const volumeSlider = document.querySelector('.volume_slider input.slider-input');
            if (!volumeSlider) {
                diag('debug', 'autoVolume.noSlider', null, { throttleMs: 3000 });
                return;
            }

            let targetValue;
            const currentTime = Date.now();

            if (avgVolume > TARGET_VOLUME + 20) {
                targetValue = Math.max(MIN_VOLUME, TARGET_VOLUME - (avgVolume - TARGET_VOLUME));
                lastLoudTime = currentTime;
                lastAdjustedVolume = targetValue;
            } else if (currentTime - lastLoudTime < HOLD_DURATION || avgVolume < SILENCE_THRESHOLD) {
                targetValue = lastAdjustedVolume;
            } else if (avgVolume < TARGET_VOLUME - 20) {
                targetValue = Math.min(MAX_VOLUME, lastAdjustedVolume + (TARGET_VOLUME - avgVolume) / 2);
                lastAdjustedVolume = targetValue;
            } else {
                targetValue = lastAdjustedVolume;
            }

            const startValue = parseInt(volumeSlider.value) || TARGET_VOLUME;
            if (Math.abs(startValue - targetValue) > 5) {
                smoothTransition(volumeSlider, startValue, targetValue, audioElement);
            }

            diag('debug', 'autoVolume.tick', {
                avgVolume: Math.round(avgVolume),
                targetValue: Math.round(targetValue),
                sliderValue: startValue,
                contextState: remoteAudioContext?.state || null
            }, { throttleMs: 2500 });
        }

        function smoothTransition(slider, startValue, targetValue, audio) {
            const transitionId = ++activeVolumeTransitionId;
            const startTime = performance.now();
            function step(currentTime) {
                if (transitionId !== activeVolumeTransitionId || !settings.autoVolume) return;
                const elapsed = currentTime - startTime;
                const progress = Math.min(elapsed / TRANSITION_DURATION, 1);
                const newValue = startValue + (targetValue - startValue) * progress;

                slider.value = newValue;
                slider.dispatchEvent(new Event('input', { bubbles: true }));
                slider.dispatchEvent(new Event('change', { bubbles: true }));
                updateSliderVisuals(newValue);
                audio.volume = newValue / 100;

                if (progress < 1) requestAnimationFrame(step);
            }
            requestAnimationFrame(step);
        }

        function updateSliderVisuals(value) {
            const sliderDot = document.querySelector('.slider-dot');
            const sliderProcess = document.querySelector('.slider-process');
            const tooltip = document.querySelector('.slider-tooltip');
            if (sliderDot && sliderProcess && tooltip) {
                const maxTranslate = 48;
                const translateX = (value / 100) * maxTranslate;
                sliderDot.style.transform = `translateX(${translateX}px)`;
                sliderProcess.style.width = `${translateX + 4}px`;
                tooltip.textContent = Math.round(value);
            }
        }

        volumeCheckIntervalId = setInterval(adjustVolume, VOLUME_CHECK_INTERVAL);
        diag('info', 'autoVolume.started', {
            reason,
            tracks: stream.getAudioTracks?.().map(track => ({ id: track.id, label: track.label, readyState: track.readyState, enabled: track.enabled })) || [],
            contextState: remoteAudioContext?.state || null
        });
    }

    // ### Голосовое управление
    async function initSpeechRecognition() {
        if (!('webkitSpeechRecognition' in window)) {
            console.error('Speech Recognition API не поддерживается.');
            return;
        };

        if (!micStream) await getMicStream();

        recognition = new webkitSpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = false;
        recognition.lang = 'ru-RU';

        recognition.onstart = () => {
            isRecognitionActive = true;
            console.log('Голосовое управление: Слушаем...');
        };

        recognition.onresult = (event) => {
            if (!isVoiceControlEnabled) return;
            const transcript = event.results[event.results.length - 1][0].transcript.trim().toLowerCase();
            console.log('Распознано:', transcript);

            const commands = getVoiceCommands();
            if (commands.skip.some(cmd => commandMatches(transcript, cmd))) {
                skipConversation();
            } else if (commands.stop.some(cmd => commandMatches(transcript, cmd))) {
                toggleAutoMode(false);
                skipConversation();
            } else if (commands.start.some(cmd => commandMatches(transcript, cmd))) {
                toggleAutoMode(true);
                checkAndClickButton();
            }
        };

        recognition.onerror = (event) => {
            console.error('Ошибка SpeechRecognition:', event.error);

            if (event.error === 'network') {
                console.warn('!!! ВАЖНО: Ошибка "network". В Vivaldi проверьте настройки "Блокировщика рекламы и трекеров" (Shield icon in address bar) для этого сайта. Отключите блокировку для nekto.me. !!!');
                isNetworkBlocked = true;
                // Если сеть заблокирована, останавливаем распознавание, чтобы не спамить
                if (isVoiceControlEnabled) {
                    console.log("Голосовое управление отключено из-за ошибки сети. Разблокируйте сайт и включите заново.");
                    isVoiceControlEnabled = false;
                    // Обновляем UI чекбокса
                    const checkbox = document.querySelector('input[value="voiceControl"]');
                    if(checkbox) checkbox.checked = false; // предполагаемое значение, лучше найти чекбокс надежнее в UI логике
                }
            }
            // Считаем, что сессия прервана
            isRecognitionActive = false;
        };

        recognition.onend = () => {
            isRecognitionActive = false;

            // Если была ошибка сети, не пытаемся перезапустить автоматически
            if (isNetworkBlocked) return;

            // Перезапуск только если голосовое управление все еще включено
            if (isVoiceControlEnabled) {
                setTimeout(() => {
                    startRecognitionSafe();
                }, 1000);
            }
        };

        if (settings.voiceControl) {
            isVoiceControlEnabled = true;
            isNetworkBlocked = false; // Сброс флага при инициализации
            startRecognitionSafe();
        }
    }

    // Безопасный старт с проверкой флага
    function startRecognitionSafe() {
        if (isRecognitionActive) {
            console.log("Recognition already active, skip start.");
            return;
        }
        try {
            recognition.start();
        } catch (e) {
            console.warn("Ошибка при старте распознавания:", e);
            // Если ошибка "already started", сбрасываем флаг, но это странно
            if (e.message.includes("already started")) {
                isRecognitionActive = true;
            }
        }
    }

    // ### Счетчик разговоров
    function updateConversationStats(duration) {
        settings.conversationCount++;
        if (duration >= 300) settings.conversationStats.over5min++;
        if (duration >= 900) settings.conversationStats.over15min++;
        if (duration >= 1800) settings.conversationStats.over30min++;
        if (duration >= 3600) settings.conversationStats.over1hour++;
        if (duration >= 7200) settings.conversationStats.over2hours++;
        if (duration >= 10800) settings.conversationStats.over3hours++;
        if (duration >= 18000) settings.conversationStats.over5hours++;

        saveSetting('conversationCount', settings.conversationCount);
        saveSetting('conversationStats', settings.conversationStats);

        updateStatsUI();
    }

    function startConversationTimer() {
        if (conversationTimer) clearInterval(conversationTimer);
        currentConversationStart = Date.now();
        playNotificationOnStart();

        conversationTimer = setInterval(() => {
            updateStatsUI();
            updateCurrentStatusUI();
            const timerElement = document.querySelector('.callScreen__time, .timer-label');
            if (!timerElement || timerElement.textContent === '00:00') {
                stopConversationTimer();
            }
        }, 1000);
    }

    function stopConversationTimer() {
        if (conversationTimer && currentConversationStart) {
            clearInterval(conversationTimer);
            const duration = Math.floor((Date.now() - currentConversationStart) / 1000);
            updateConversationStats(duration);
            settings.totalConversationDuration = Math.max(0, (Number(settings.totalConversationDuration) || 0) + duration);
            saveSetting('totalConversationDuration', settings.totalConversationDuration);
            playNotificationOnEnd();
            conversationTimer = null;
            currentConversationStart = null;
            updateStatsUI();
            updateCurrentStatusUI();
        }
    }

    // ### Функции для управления микрофоном и наушниками
    function toggleMic() {
        isMicMuted = !isMicMuted;
        syncMicMuteState();
        updateButtonStyles();
    }

    function toggleHeadphones() {
        isHeadphonesMuted = !isHeadphonesMuted;
        const audio = document.querySelector('audio#audioStream');
        if (audio) {
            audio.muted = isHeadphonesMuted;
        }
        if (isHeadphonesMuted && !isMicMuted) {
            toggleMic();
        }
        updateButtonStyles();
    }

    function updateButtonStyles() {
        const micButtons = document.querySelectorAll('.an-mic-toggle-button, #mic-toggle');
        const headphoneButtons = document.querySelectorAll('.an-headphone-toggle-button, #headphone-toggle');

        const micState = globalStream && globalStream.getAudioTracks().length > 0 ? !globalStream.getAudioTracks()[0].enabled : isMicMuted;
        isMicMuted = micState;
        micButtons.forEach(micButton => {
            micButton.classList.toggle('is-muted', isMicMuted);
            micButton.setAttribute('aria-pressed', String(isMicMuted));
            micButton.title = isMicMuted ? 'Микрофон выключен' : 'Микрофон включён';
        });

        headphoneButtons.forEach(headphoneButton => {
            headphoneButton.classList.toggle('is-muted', isHeadphonesMuted);
            headphoneButton.setAttribute('aria-pressed', String(isHeadphonesMuted));
            headphoneButton.title = isHeadphonesMuted ? 'Наушники выключены' : 'Наушники включены';
        });
    }

    // ### UI элементы
    function ensureMaterialStyles() {
        if (document.getElementById('autonektome-material-styles')) return;

        const style = document.createElement('style');
        style.id = 'autonektome-material-styles';
        style.textContent = `
            #settings-container,
            #settings-container * {
                box-sizing: border-box;
                font-family: Roboto, "Google Sans", "Segoe UI", Arial, sans-serif !important;
            }

            #settings-container {
                --an-primary: #6750a4;
                --an-on-primary: #ffffff;
                --an-primary-container: #eaddff;
                --an-on-primary-container: #21005d;
                --an-secondary: #625b71;
                --an-surface: #fffbfe;
                --an-surface-container: #f3edf7;
                --an-surface-container-high: #ece6f0;
                --an-on-surface: #1c1b1f;
                --an-on-surface-variant: #49454f;
                --an-outline: #79747e;
                --an-outline-variant: #cac4d0;
                --an-success: #1b5e20;
                --an-danger: #b3261e;
                --an-shadow: rgba(0, 0, 0, 0.22);
                position: fixed;
                z-index: 2147483647;
                min-width: 300px;
                min-height: 360px;
                max-width: min(92vw, 760px);
                max-height: calc(100vh - 16px);
                resize: both;
                overflow: hidden;
                display: flex;
                flex-direction: column;
                border: 1px solid var(--an-outline-variant);
                border-radius: 28px;
                background: var(--an-surface);
                color: var(--an-on-surface);
                box-shadow: 0 8px 28px var(--an-shadow), 0 2px 8px rgba(0, 0, 0, 0.18);
                line-height: 1.35;
                isolation: isolate;
            }

            #settings-container[data-theme="dark"] {
                --an-primary: #d0bcff;
                --an-on-primary: #381e72;
                --an-primary-container: #4f378b;
                --an-on-primary-container: #eaddff;
                --an-secondary: #ccc2dc;
                --an-surface: #141218;
                --an-surface-container: #211f26;
                --an-surface-container-high: #2b2930;
                --an-on-surface: #e6e0e9;
                --an-on-surface-variant: #cac4d0;
                --an-outline: #938f99;
                --an-outline-variant: #49454f;
                --an-success: #7dff9d;
                --an-danger: #ffb4ab;
                --an-shadow: rgba(0, 0, 0, 0.55);
            }

            #settings-container.is-collapsed {
                width: 64px !important;
                height: 64px !important;
                min-width: 64px;
                min-height: 64px;
                max-width: 64px;
                max-height: 64px;
                resize: none;
                border-radius: 20px;
                cursor: pointer;
                overflow: visible;
            }

            #settings-container.is-dragging {
                user-select: none;
                box-shadow: 0 12px 36px var(--an-shadow), 0 4px 12px rgba(0, 0, 0, 0.22);
            }

            .an-panel-header {
                flex: 0 0 auto;
                min-height: 72px;
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 12px;
                padding: 14px 16px 12px 18px;
                background: linear-gradient(135deg, var(--an-primary-container), var(--an-surface-container));
                color: var(--an-on-primary-container);
                cursor: grab;
                touch-action: none;
            }

            #settings-container.is-dragging .an-panel-header {
                cursor: grabbing;
            }

            .an-title-group {
                min-width: 0;
                display: flex;
                flex-direction: column;
                gap: 2px;
            }

            .an-title {
                margin: 0;
                font-size: 20px;
                font-weight: 600;
                letter-spacing: 0.15px;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }

            .an-subtitle {
                font-size: 12px;
                font-weight: 500;
                color: var(--an-on-surface-variant);
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }

            .an-header-actions {
                display: flex;
                align-items: center;
                gap: 8px;
                flex: 0 0 auto;
            }

            .an-icon-button,
            .an-fab-button {
                border: none;
                outline: none;
                cursor: pointer;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                transition: background 160ms ease, box-shadow 160ms ease, transform 160ms ease, color 160ms ease;
                -webkit-tap-highlight-color: transparent;
            }

            .an-icon-button {
                width: 40px;
                height: 40px;
                border-radius: 20px;
                background: transparent;
                color: var(--an-on-surface);
                font-size: 19px;
            }

            .an-icon-button:hover {
                background: color-mix(in srgb, var(--an-primary) 14%, transparent);
            }

            .an-icon-button:active,
            .an-fab-button:active {
                transform: scale(0.94);
            }

            .an-collapsed-fab {
                display: none;
                width: 100%;
                height: 100%;
                align-items: center;
                justify-content: center;
                font-size: 26px;
                border-radius: 20px;
                background: var(--an-primary-container);
                color: var(--an-on-primary-container);
                box-shadow: inset 0 0 0 1px var(--an-outline-variant);
            }

            #settings-container.is-collapsed .an-panel-header {
                width: 100%;
                height: 100%;
                min-height: 64px;
                padding: 0;
                border-radius: 20px;
                justify-content: center;
                background: transparent;
            }

            #settings-container.is-collapsed .an-title-group,
            #settings-container.is-collapsed .an-header-actions,
            #settings-container.is-collapsed .an-panel-body {
                display: none;
            }

            #settings-container.is-collapsed .an-collapsed-fab {
                display: flex;
            }

            .an-panel-body {
                flex: 1 1 auto;
                min-height: 0;
                overflow: auto;
                padding: 16px;
                display: flex;
                flex-direction: column;
                gap: 14px;
                scrollbar-width: thin;
                scrollbar-color: var(--an-outline) transparent;
                scroll-padding-top: 210px;
            }

            .an-sticky-core {
                position: sticky;
                top: 0;
                z-index: 5;
                display: flex;
                flex-direction: column;
                gap: 12px;
                padding: 12px;
                margin: -4px -4px 2px;
                border: 1px solid color-mix(in srgb, var(--an-primary) 32%, var(--an-outline-variant));
                border-radius: 24px;
                background: linear-gradient(180deg, var(--an-surface) 0%, color-mix(in srgb, var(--an-primary-container) 38%, var(--an-surface)) 100%);
                box-shadow: 0 8px 22px color-mix(in srgb, var(--an-primary) 18%, transparent), 0 1px 0 color-mix(in srgb, var(--an-primary) 18%, transparent) inset;
                backdrop-filter: blur(14px);
            }

            .an-panel-body::-webkit-scrollbar {
                width: 9px;
                height: 9px;
            }

            .an-panel-body::-webkit-scrollbar-thumb {
                background: var(--an-outline);
                border-radius: 999px;
                border: 2px solid transparent;
                background-clip: content-box;
            }

            .an-card,
            .an-section,
            .an-setting-row {
                background: var(--an-surface-container);
                border: 1px solid var(--an-outline-variant);
                border-radius: 20px;
            }

            .an-card {
                padding: 14px;
            }

            .an-counter-card {
                position: relative;
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 12px;
            }

            .an-counter-value {
                font-size: 18px;
                font-weight: 700;
                color: var(--an-primary);
            }

            .an-counter-label {
                font-size: 12px;
                font-weight: 500;
                color: var(--an-on-surface-variant);
            }

            .an-tooltip {
                position: absolute;
                left: 12px;
                right: 12px;
                top: calc(100% + 8px);
                z-index: 3;
                display: none;
                padding: 12px;
                border-radius: 16px;
                background: var(--an-surface-container-high);
                color: var(--an-on-surface);
                border: 1px solid var(--an-outline-variant);
                box-shadow: 0 8px 20px var(--an-shadow);
                font-size: 12px;
                white-space: normal;
            }

            .an-counter-card:hover .an-tooltip,
            .voice-hint-wrapper:hover .an-tooltip {
                display: block;
            }

            .an-audio-actions {
                display: grid;
                grid-template-columns: repeat(2, minmax(0, 1fr));
                gap: 12px;
            }

            .an-fab-button {
                min-height: 48px;
                border-radius: 18px;
                background: var(--an-primary-container);
                color: var(--an-on-primary-container);
                font-size: 22px;
                font-weight: 600;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.18);
            }

            .an-fab-button:hover {
                box-shadow: 0 5px 14px rgba(0, 0, 0, 0.22);
                filter: brightness(1.03);
            }

            .an-fab-button.is-muted {
                background: color-mix(in srgb, var(--an-danger) 22%, var(--an-surface-container-high));
                color: var(--an-danger);
                text-decoration: line-through;
            }

            .an-auto-card {
                position: relative;
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 14px;
                overflow: hidden;
                padding: 16px;
                border: 0;
                background: radial-gradient(circle at 14% 20%, color-mix(in srgb, var(--an-accent, var(--an-primary)) 30%, transparent), transparent 34%), linear-gradient(135deg, var(--an-primary), color-mix(in srgb, var(--an-accent, var(--an-primary)) 70%, var(--an-primary)));
                color: var(--an-on-primary);
                box-shadow: 0 10px 24px color-mix(in srgb, var(--an-primary) 34%, transparent), inset 0 1px 0 rgba(255,255,255,0.18);
            }

            .an-auto-card::after {
                content: "";
                position: absolute;
                inset: auto -24px -40px auto;
                width: 130px;
                height: 130px;
                border-radius: 50%;
                background: rgba(255,255,255,0.12);
                pointer-events: none;
            }

            .an-auto-card.is-disabled {
                filter: saturate(0.55);
                opacity: 0.86;
                background: linear-gradient(135deg, var(--an-surface-container-high), color-mix(in srgb, var(--an-outline) 38%, var(--an-surface-container)));
                color: var(--an-on-surface);
                box-shadow: none;
            }

            .an-auto-text {
                min-width: 0;
                position: relative;
                z-index: 1;
            }

            .an-auto-title {
                font-size: 17px;
                font-weight: 800;
                color: currentColor;
                letter-spacing: 0.1px;
            }

            .an-auto-subtitle {
                margin-top: 4px;
                font-size: 12px;
                font-weight: 600;
                color: color-mix(in srgb, currentColor 84%, transparent);
            }

            #auto-mode-switch.an-auto-switch {
                width: 86px;
                height: 46px;
                z-index: 1;
            }

            #auto-mode-switch.an-auto-switch .an-switch-track {
                width: 86px;
                height: 46px;
                border-radius: 999px;
                border: 2px solid rgba(255,255,255,0.58);
                background: rgba(0,0,0,0.26);
                box-shadow: inset 0 2px 8px rgba(0,0,0,0.28), 0 0 0 4px rgba(255,255,255,0.10);
            }

            #auto-mode-switch.an-auto-switch .an-switch-thumb {
                left: 6px;
                width: 34px;
                height: 34px;
                background: #ffffff;
                box-shadow: 0 3px 10px rgba(0,0,0,0.34);
            }

            #auto-mode-switch.an-auto-switch .an-switch-thumb::before {
                content: "⏻";
                position: absolute;
                inset: 0;
                display: flex;
                align-items: center;
                justify-content: center;
                color: var(--an-primary);
                font-size: 16px;
                font-weight: 900;
            }

            #auto-mode-switch.an-auto-switch input:checked ~ .an-switch-thumb,
            #auto-mode-switch.an-auto-switch.is-enabled .an-switch-thumb {
                transform: translateX(40px);
                background: #ffffff;
            }

            #auto-mode-switch.an-auto-switch input:checked + .an-switch-track,
            #auto-mode-switch.an-auto-switch.is-enabled .an-switch-track {
                background: rgba(255,255,255,0.24);
                border-color: rgba(255,255,255,0.82);
            }

            .an-settings-list {
                display: flex;
                flex-direction: column;
                gap: 10px;
            }

            .an-setting-row {
                padding: 12px;
            }

            .an-setting-main {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 12px;
            }

            .an-setting-text {
                min-width: 0;
                display: flex;
                flex-direction: column;
                gap: 2px;
            }

            .an-setting-title {
                font-size: 14px;
                font-weight: 600;
                color: var(--an-on-surface);
            }

            .an-setting-helper {
                font-size: 12px;
                color: var(--an-on-surface-variant);
            }

            .an-switch {
                position: relative;
                display: inline-flex;
                align-items: center;
                width: 52px;
                height: 32px;
                flex: 0 0 auto;
                cursor: pointer;
            }

            .an-switch input {
                position: absolute;
                inset: 0;
                opacity: 0;
                cursor: pointer;
                margin: 0;
                width: 100%;
                height: 100%;
            }

            .an-switch-track {
                width: 52px;
                height: 32px;
                border-radius: 999px;
                background: var(--an-surface-container-high);
                border: 2px solid var(--an-outline);
                transition: background 180ms ease, border 180ms ease;
            }

            .an-switch-thumb {
                position: absolute;
                left: 6px;
                width: 20px;
                height: 20px;
                border-radius: 50%;
                background: var(--an-outline);
                transition: transform 180ms ease, width 180ms ease, background 180ms ease;
                box-shadow: 0 1px 3px rgba(0,0,0,0.3);
            }

            .an-switch input:checked + .an-switch-track,
            .an-switch.is-enabled .an-switch-track {
                background: var(--an-primary);
                border-color: var(--an-primary);
            }

            .an-switch input:checked ~ .an-switch-thumb,
            .an-switch.is-enabled .an-switch-thumb {
                transform: translateX(20px);
                background: var(--an-on-primary);
            }

            .an-switch input:focus-visible + .an-switch-track {
                outline: 3px solid color-mix(in srgb, var(--an-primary) 34%, transparent);
                outline-offset: 2px;
            }

            .an-nested {
                margin-top: 12px;
                padding: 12px;
                border-radius: 16px;
                background: var(--an-surface-container-high);
                border: 1px solid var(--an-outline-variant);
            }

            .an-nested[hidden] {
                display: none !important;
            }

            .an-nested-options {
                display: flex;
                flex-direction: column;
                gap: 10px;
            }

            .an-nested-option {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 12px;
                padding: 10px;
                border-radius: 14px;
                background: color-mix(in srgb, var(--an-surface-container) 64%, transparent);
                border: 1px solid color-mix(in srgb, var(--an-outline-variant) 72%, transparent);
            }

            .an-nested-option .an-setting-title {
                font-size: 13px;
            }

            .an-nested-option .an-setting-helper {
                font-size: 11px;
            }

            .an-range-row {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }

            .an-range-label {
                font-size: 12px;
                font-weight: 600;
                color: var(--an-on-surface-variant);
            }

            .an-range {
                width: 100%;
                accent-color: var(--an-primary);
                cursor: pointer;
            }

            .voice-hint-wrapper {
                position: relative;
                display: inline-flex;
                width: fit-content;
                margin-top: 8px;
            }

            .an-chip {
                display: inline-flex;
                align-items: center;
                min-height: 30px;
                padding: 0 12px;
                border-radius: 999px;
                border: 1px solid var(--an-outline-variant);
                background: var(--an-surface-container-high);
                color: var(--an-on-surface-variant);
                font-size: 12px;
                font-weight: 600;
                cursor: help;
            }

            .voice-hint-wrapper .an-tooltip {
                left: 0;
                right: auto;
                min-width: 230px;
                top: calc(100% + 8px);
            }

            .an-section {
                padding: 12px;
                display: flex;
                flex-direction: column;
                gap: 10px;
            }

            .an-section-header {
                display: flex;
                align-items: flex-start;
                justify-content: space-between;
                gap: 10px;
            }

            .an-section-title {
                font-size: 14px;
                font-weight: 700;
                color: var(--an-on-surface);
            }

            .an-section-helper {
                margin-top: 2px;
                font-size: 12px;
                color: var(--an-on-surface-variant);
            }

            .an-loading-chip {
                flex: 0 0 auto;
                padding: 4px 8px;
                border-radius: 999px;
                background: var(--an-primary-container);
                color: var(--an-on-primary-container);
                font-size: 11px;
                font-weight: 700;
            }

            .an-select-wrap {
                position: relative;
                display: block;
            }

            .an-select {
                width: 100%;
                min-height: 48px;
                padding: 0 42px 0 14px;
                border: 1px solid var(--an-outline);
                border-radius: 14px;
                background: var(--an-surface);
                color: var(--an-on-surface);
                font-size: 14px;
                outline: none;
                appearance: none;
                cursor: pointer;
            }

            .an-select:focus {
                border: 2px solid var(--an-primary);
                padding-left: 13px;
            }

            .an-select-arrow {
                position: absolute;
                right: 15px;
                top: 50%;
                transform: translateY(-50%);
                pointer-events: none;
                color: var(--an-primary);
                font-size: 18px;
            }

            .an-setting-row[data-setting="adBlock"] {
                border-color: color-mix(in srgb, var(--an-primary) 42%, var(--an-outline-variant));
                background: linear-gradient(135deg, color-mix(in srgb, var(--an-primary-container) 60%, var(--an-surface-container)), var(--an-surface-container));
            }

            .an-setting-row[data-setting="adBlock"] .an-setting-title::before {
                content: "🛡️ ";
            }


            /* Compact visual pass v5.0 */
            #settings-container {
                min-width: 300px;
                min-height: 320px;
                border-radius: 18px;
                box-shadow: 0 6px 20px var(--an-shadow), 0 1px 4px rgba(0, 0, 0, 0.14);
                line-height: 1.25;
            }

            .an-panel-header {
                min-height: 52px;
                padding: 10px 12px 8px 14px;
                gap: 8px;
                background: linear-gradient(180deg,
                    color-mix(in srgb, var(--an-primary-container) 88%, var(--an-surface)),
                    color-mix(in srgb, var(--an-primary-container) 42%, var(--an-surface))
                );
            }

            .an-title {
                font-size: 17px;
                font-weight: 650;
                letter-spacing: 0.1px;
            }

            .an-subtitle {
                display: none !important;
            }

            .an-header-actions {
                gap: 4px;
            }

            .an-icon-button {
                width: 32px;
                height: 32px;
                border-radius: 12px;
                font-size: 15px;
            }

            #settings-container.is-collapsed {
                width: 56px !important;
                height: 56px !important;
                min-width: 56px;
                min-height: 56px;
                max-width: 56px;
                max-height: 56px;
                border-radius: 16px;
            }

            #settings-container.is-collapsed .an-panel-header {
                min-height: 56px;
                border-radius: 16px;
            }

            .an-collapsed-fab {
                border-radius: 16px;
                font-size: 23px;
            }

            #settings-container.is-collapsed .an-sticky-core {
                display: none !important;
            }

            .an-sticky-core {
                position: relative;
                top: auto;
                z-index: 2;
                flex: 0 0 auto;
                display: grid;
                grid-template-columns: minmax(96px, 1fr) minmax(104px, 1fr) auto;
                align-items: center;
                gap: 7px;
                padding: 7px 10px 9px;
                margin: 0;
                border: 0;
                border-top: 1px solid color-mix(in srgb, var(--an-primary) 12%, transparent);
                border-bottom: 1px solid var(--an-outline-variant);
                border-radius: 0;
                background: linear-gradient(180deg,
                    color-mix(in srgb, var(--an-primary-container) 30%, var(--an-surface)),
                    var(--an-surface)
                );
                box-shadow: 0 2px 6px rgba(0,0,0,0.08);
                backdrop-filter: none;
            }

            .an-panel-body {
                padding: 10px;
                gap: 8px;
                scroll-padding-top: 0;
            }

            .an-panel-body::-webkit-scrollbar {
                width: 7px;
                height: 7px;
            }

            .an-card,
            .an-section,
            .an-setting-row {
                border-radius: 14px;
            }

            .an-card {
                padding: 8px;
            }

            .an-counter-card {
                min-height: 34px;
                padding: 6px 8px;
                gap: 6px;
            }

            .an-counter-value {
                font-size: 13px;
                font-weight: 700;
                white-space: nowrap;
            }

            .an-counter-label {
                display: none;
            }

            .an-tooltip {
                padding: 9px;
                border-radius: 12px;
                font-size: 11px;
            }

            .an-chip {
                min-height: 20px;
                padding: 0 7px;
                font-size: 11px;
                border-radius: 10px;
            }

            .an-audio-actions {
                display: grid;
                grid-template-columns: repeat(2, 32px);
                gap: 6px;
                justify-content: end;
            }

            .an-fab-button {
                width: 32px;
                min-height: 32px;
                border-radius: 12px;
                font-size: 15px;
                box-shadow: none;
            }

            .an-fab-button:hover {
                box-shadow: none;
                filter: brightness(1.04);
            }

            .an-auto-card {
                padding: 6px 8px;
                gap: 7px;
                border-radius: 13px;
                border: 1px solid color-mix(in srgb, var(--an-primary) 28%, var(--an-outline-variant));
                background: color-mix(in srgb, var(--an-primary-container) 48%, var(--an-surface-container));
                color: var(--an-on-surface);
                box-shadow: none;
            }

            .an-auto-card::after {
                display: none;
            }

            .an-auto-card.is-disabled {
                opacity: 0.68;
                filter: saturate(0.6);
                background: var(--an-surface-container);
                color: var(--an-on-surface-variant);
                box-shadow: none;
            }

            .an-auto-title {
                font-size: 13px;
                font-weight: 700;
                white-space: nowrap;
            }

            .an-auto-subtitle {
                margin-top: 0;
                font-size: 11px;
                font-weight: 500;
                color: var(--an-on-surface-variant);
            }

            #auto-mode-switch.an-auto-switch,
            #auto-mode-switch.an-auto-switch .an-switch-track {
                width: 48px;
                height: 26px;
            }

            #auto-mode-switch.an-auto-switch .an-switch-track {
                border-radius: 999px;
                border: 1px solid color-mix(in srgb, var(--an-primary) 50%, var(--an-outline));
                background: color-mix(in srgb, var(--an-primary) 16%, var(--an-surface-container-high));
                box-shadow: none;
            }

            #auto-mode-switch.an-auto-switch .an-switch-thumb {
                left: 4px;
                width: 18px;
                height: 18px;
                background: var(--an-primary);
                box-shadow: 0 1px 3px rgba(0,0,0,0.24);
            }

            #auto-mode-switch.an-auto-switch .an-switch-thumb::before {
                content: "";
            }

            #auto-mode-switch.an-auto-switch input:checked ~ .an-switch-thumb,
            #auto-mode-switch.an-auto-switch.is-enabled .an-switch-thumb {
                transform: translateX(22px);
                background: var(--an-primary);
            }

            #auto-mode-switch.an-auto-switch input:checked + .an-switch-track,
            #auto-mode-switch.an-auto-switch.is-enabled .an-switch-track {
                background: color-mix(in srgb, var(--an-primary) 24%, var(--an-surface-container));
                border-color: var(--an-primary);
            }

            .an-settings-list {
                gap: 7px;
            }

            .an-setting-row {
                padding: 8px;
            }

            .an-setting-main {
                gap: 8px;
            }

            .an-setting-title {
                font-size: 13px;
                font-weight: 600;
            }

            .an-setting-helper {
                font-size: 11px;
                line-height: 1.25;
            }

            .an-switch {
                width: 44px;
                height: 26px;
            }

            .an-switch-track {
                width: 44px;
                height: 26px;
                border-width: 1px;
            }

            .an-switch-thumb {
                left: 5px;
                width: 16px;
                height: 16px;
            }

            .an-switch input:checked ~ .an-switch-thumb,
            .an-switch.is-enabled .an-switch-thumb {
                transform: translateX(17px);
            }

            .an-nested {
                margin-top: 8px;
                padding: 8px;
                border-radius: 12px;
            }

            .an-nested-options {
                gap: 6px;
            }

            .an-nested-option {
                padding: 7px;
                border-radius: 10px;
                gap: 8px;
            }

            .an-nested-option .an-setting-title {
                font-size: 12px;
            }

            .an-nested-option .an-setting-helper {
                font-size: 10.5px;
            }

            .an-range-row {
                gap: 6px;
            }

            .an-range-label {
                font-size: 11px;
            }

            .voice-hint-wrapper {
                margin-top: 6px;
            }

            .an-section {
                padding: 8px;
                gap: 7px;
            }

            .an-section-title {
                font-size: 13px;
            }

            .an-section-helper {
                font-size: 11px;
            }

            .an-loading-chip {
                padding: 3px 7px;
                font-size: 10px;
            }

            .an-select {
                min-height: 36px;
                padding: 0 34px 0 10px;
                border-radius: 11px;
                font-size: 13px;
            }

            .an-select:focus {
                padding-left: 9px;
            }

            .an-select-arrow {
                right: 11px;
                font-size: 15px;
            }

            .an-setting-row[data-setting="adBlock"] {
                border-color: var(--an-outline-variant);
                background: var(--an-surface-container);
            }

            .an-setting-row[data-setting="adBlock"] .an-setting-title::before {
                content: "🛡️ ";
            }

            @container (max-width: 340px) {
                .an-sticky-core {
                    grid-template-columns: 1fr auto;
                }
                .an-auto-card {
                    grid-column: 1 / -1;
                }
            }



            /* Visual polish v5.1: compact professional core bar + quiet ad block */
            #settings-container {
                container-type: inline-size;
                border-radius: 18px;
            }

            .an-panel-header {
                min-height: 56px;
                padding: 12px 16px 9px 18px;
                border-bottom: 0;
                background: linear-gradient(180deg,
                    color-mix(in srgb, var(--an-primary-container) 92%, var(--an-surface)),
                    color-mix(in srgb, var(--an-primary-container) 54%, var(--an-surface))
                );
            }

            .an-title {
                font-size: 18px;
                line-height: 1.1;
            }

            .an-sticky-core {
                position: relative;
                top: auto;
                display: grid;
                grid-template-columns: minmax(138px, max-content) auto minmax(168px, 1fr);
                align-items: center;
                gap: 8px;
                padding: 6px 14px 10px;
                margin: 0;
                border: 0;
                border-bottom: 1px solid var(--an-outline-variant);
                border-radius: 0;
                background: linear-gradient(180deg,
                    color-mix(in srgb, var(--an-primary-container) 45%, var(--an-surface)),
                    var(--an-surface)
                );
                box-shadow: none;
                overflow: hidden;
            }

            .an-panel-body {
                padding: 10px;
                gap: 8px;
                background: var(--an-surface);
            }

            .an-counter-card {
                min-width: 0;
                min-height: 32px;
                padding: 5px 11px;
                border-radius: 999px;
                justify-content: center;
                gap: 0;
                background: color-mix(in srgb, var(--an-primary-container) 26%, var(--an-surface-container));
                border-color: color-mix(in srgb, var(--an-primary) 24%, var(--an-outline-variant));
            }

            .an-counter-card .an-chip {
                display: none !important;
            }

            .an-counter-value {
                font-size: 13px;
                line-height: 1;
                white-space: nowrap;
            }

            .an-audio-actions {
                grid-template-columns: repeat(2, 34px);
                gap: 6px;
                justify-content: center;
            }

            .an-fab-button {
                width: 34px;
                min-height: 34px;
                border-radius: 13px;
                font-size: 15px;
                background: color-mix(in srgb, var(--an-primary) 28%, var(--an-surface-container));
                color: var(--an-on-surface);
                box-shadow: none;
            }

            .an-fab-button.is-muted {
                background: color-mix(in srgb, var(--an-danger) 20%, var(--an-surface-container));
            }

            .an-auto-card {
                width: 100%;
                min-width: 0;
                min-height: 34px;
                display: grid;
                grid-template-columns: minmax(0, 1fr) auto;
                align-items: center;
                padding: 5px 7px 5px 10px;
                gap: 8px;
                border-radius: 999px;
                border: 1px solid color-mix(in srgb, var(--an-primary) 36%, var(--an-outline-variant));
                background: color-mix(in srgb, var(--an-primary-container) 36%, var(--an-surface-container));
                color: var(--an-on-surface);
                box-shadow: none;
                overflow: hidden;
            }

            .an-auto-card.is-disabled {
                background: var(--an-surface-container);
                color: var(--an-on-surface-variant);
                opacity: 0.78;
            }

            .an-auto-text {
                min-width: 0;
                display: flex;
                align-items: baseline;
                gap: 6px;
                overflow: hidden;
            }

            .an-auto-title {
                min-width: 0;
                font-size: 12.5px;
                line-height: 1;
                font-weight: 750;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }

            .an-auto-subtitle {
                flex: 0 0 auto;
                margin-top: 0;
                font-size: 10.5px;
                line-height: 1;
                font-weight: 600;
                color: var(--an-primary);
            }

            #auto-mode-switch.an-auto-switch,
            #auto-mode-switch.an-auto-switch .an-switch-track {
                width: 42px;
                height: 24px;
            }

            #auto-mode-switch.an-auto-switch .an-switch-thumb {
                left: 4px;
                width: 16px;
                height: 16px;
            }

            #auto-mode-switch.an-auto-switch input:checked ~ .an-switch-thumb,
            #auto-mode-switch.an-auto-switch.is-enabled .an-switch-thumb {
                transform: translateX(18px);
            }

            .an-setting-row[data-setting="adBlock"] {
                order: 999;
                border-color: var(--an-outline-variant) !important;
                background: var(--an-surface-container) !important;
            }

            .an-setting-row[data-setting="adBlock"] .an-setting-title::before,
            .an-nested-option[data-setting^="adBlock"] .an-setting-title::before,
            .an-nested-option[data-setting^="metric"] .an-setting-title::before {
                content: "" !important;
            }

            .an-setting-row[data-setting="adBlock"] .an-setting-title {
                font-size: 12.5px;
                font-weight: 600;
            }

            .an-setting-row[data-setting="adBlock"] .an-setting-helper {
                font-size: 10.5px;
            }

            .an-ad-details-toggle {
                margin-top: 6px;
                width: fit-content;
                min-height: 26px;
                padding: 0 10px;
                border: 1px solid var(--an-outline-variant);
                border-radius: 999px;
                background: transparent;
                color: var(--an-on-surface-variant);
                font-size: 11px;
                font-weight: 600;
                cursor: pointer;
            }

            .an-ad-details-toggle:hover {
                background: color-mix(in srgb, var(--an-primary) 10%, transparent);
                color: var(--an-on-surface);
            }

            .an-ad-details-toggle:disabled {
                opacity: 0.45;
                cursor: default;
            }

            .an-setting-row[data-setting="adBlock"] .an-nested {
                margin-top: 6px;
                padding: 6px;
            }

            .an-setting-row[data-setting="adBlock"] .an-nested-options {
                gap: 5px;
            }

            .an-setting-row[data-setting="adBlock"] .an-nested-option {
                padding: 6px 7px;
                border-radius: 10px;
            }

            .an-setting-row[data-setting="adBlock"] .an-nested-option .an-setting-title {
                font-size: 11.5px;
            }

            .an-setting-row[data-setting="adBlock"] .an-nested-option .an-setting-helper {
                font-size: 10px;
            }

            @container (max-width: 460px) {
                .an-sticky-core {
                    grid-template-columns: 1fr auto;
                    gap: 7px;
                }

                .an-audio-actions {
                    justify-content: end;
                }

                .an-auto-card {
                    grid-column: 1 / -1;
                }
            }

            @media (max-width: 520px) {
                #settings-container {
                    max-width: calc(100vw - 16px);
                    max-height: calc(100vh - 16px);
                    border-radius: 24px;
                }

                .an-panel-body {
                    padding: 12px;
                }
            }
        `;
        document.head.appendChild(style);
    }

    function clampNumber(value, min, max) {
        const number = Number(value);
        if (!Number.isFinite(number)) return min;
        return Math.min(max, Math.max(min, number));
    }

    function getPanelSize() {
        const saved = settings.panelSize && typeof settings.panelSize === 'object' ? settings.panelSize : {};
        const rawHeight = Number(saved.height);
        return {
            width: clampNumber(saved.width, 300, Math.min(760, window.innerWidth - 16)),
            height: Number.isFinite(rawHeight) && rawHeight > 0 ? clampNumber(rawHeight, 360, Math.max(360, window.innerHeight - 24)) : null
        };
    }


    function ensureEnhancedHybridStyles() {
        if (document.getElementById('autonektome-hybrid-v6-styles')) return;
        const style = document.createElement('style');
        style.id = 'autonektome-hybrid-v6-styles';
        style.textContent = `
            #settings-container {
                border-radius: 22px;
                background:
                    radial-gradient(circle at 18% 0%, color-mix(in srgb, var(--an-primary) 16%, transparent), transparent 38%),
                    var(--an-surface);
            }

            #settings-container[data-site-theme-accent="github-dark"][data-theme="dark"] {
                --an-surface: #0d1117;
                --an-surface-container: #161b22;
                --an-surface-container-high: #21262d;
                --an-on-surface: #c9d1d9;
                --an-on-surface-variant: #8b949e;
                --an-outline: #484f58;
                --an-outline-variant: #30363d;
                --an-shadow: rgba(1, 4, 9, 0.78);
            }

            .an-panel-header {
                min-height: 66px;
                padding: 12px 14px 10px 16px;
                background:
                    linear-gradient(135deg, color-mix(in srgb, var(--an-primary) 18%, var(--an-surface-container-high)), var(--an-surface-container)),
                    radial-gradient(circle at 86% 12%, color-mix(in srgb, var(--an-primary) 24%, transparent), transparent 38%);
                border-bottom: 1px solid color-mix(in srgb, var(--an-primary) 22%, var(--an-outline-variant));
            }

            .an-title-row {
                display: flex;
                align-items: center;
                gap: 8px;
                min-width: 0;
            }

            .an-title {
                font-size: 18px;
                font-weight: 750;
                color: var(--an-on-surface);
            }

            .an-version-badge {
                flex: 0 0 auto;
                height: 20px;
                display: inline-flex;
                align-items: center;
                padding: 0 8px;
                border-radius: 999px;
                font-size: 11px;
                font-weight: 800;
                letter-spacing: .2px;
                background: color-mix(in srgb, var(--an-primary) 20%, transparent);
                color: var(--an-primary);
                border: 1px solid color-mix(in srgb, var(--an-primary) 32%, transparent);
            }

            .an-status-pill {
                margin-top: 6px;
                display: inline-flex;
                align-items: center;
                gap: 8px;
                width: fit-content;
                max-width: 100%;
                min-height: 28px;
                padding: 4px 10px;
                border-radius: 999px;
                background: color-mix(in srgb, var(--an-primary) 11%, var(--an-surface));
                border: 1px solid color-mix(in srgb, var(--an-primary) 22%, transparent);
                color: var(--an-on-surface);
            }

            .an-status-dot {
                width: 8px;
                height: 8px;
                border-radius: 50%;
                background: var(--an-outline);
                box-shadow: 0 0 0 3px color-mix(in srgb, var(--an-outline) 14%, transparent);
            }

            .an-status-pill[data-status="idle"] .an-status-dot { background: var(--an-primary); }
            .an-status-pill[data-status="searching"] .an-status-dot { background: #d29922; box-shadow: 0 0 0 3px rgba(210,153,34,.16); }
            .an-status-pill[data-status="talking"] .an-status-dot { background: #3fb950; box-shadow: 0 0 0 3px rgba(63,185,80,.16); }
            .an-status-copy { min-width: 0; display: flex; align-items: baseline; gap: 6px; }
            .an-status-title { font-size: 12px; font-weight: 800; white-space: nowrap; }
            .an-status-text { font-size: 11px; color: var(--an-on-surface-variant); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

            .an-sticky-core {
                display: grid;
                grid-template-columns: auto minmax(0, 1fr);
                align-items: stretch;
                gap: 8px;
                flex: 0 0 auto;
                padding: 10px 12px;
                background: linear-gradient(180deg, var(--an-surface-container), color-mix(in srgb, var(--an-surface-container) 80%, var(--an-surface)));
                border-bottom: 1px solid var(--an-outline-variant);
            }

            .an-stats-card {
                grid-column: 1 / -1;
                position: relative;
                display: grid;
                grid-template-columns: repeat(3, minmax(0, 1fr));
                gap: 6px;
                padding: 8px;
                border-radius: 16px;
                background: color-mix(in srgb, var(--an-primary) 7%, var(--an-surface));
                border: 1px solid color-mix(in srgb, var(--an-primary) 16%, var(--an-outline-variant));
                min-width: 0;
            }

            .an-stat-item {
                min-width: 0;
                text-align: center;
                padding: 3px 4px;
                border-radius: 12px;
                background: color-mix(in srgb, var(--an-surface-container-high) 72%, transparent);
            }

            .an-stat-value {
                font-size: 14px;
                line-height: 1.05;
                font-weight: 850;
                color: var(--an-primary);
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }

            .an-stat-label {
                margin-top: 2px;
                font-size: 10px;
                line-height: 1;
                color: var(--an-on-surface-variant);
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }

            .an-audio-actions {
                grid-column: 1;
                display: flex;
                gap: 6px;
                align-items: stretch;
            }

            .an-fab-button {
                width: 38px;
                min-width: 38px;
                min-height: 38px;
                border-radius: 14px;
                font-size: 17px;
                background: color-mix(in srgb, var(--an-primary) 18%, var(--an-surface));
                box-shadow: none;
                border: 1px solid color-mix(in srgb, var(--an-primary) 16%, var(--an-outline-variant));
            }

            .an-auto-card {
                grid-column: 2;
                min-width: 0;
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 8px;
                padding: 8px 10px;
                border-radius: 16px;
                background: color-mix(in srgb, var(--an-primary) 15%, var(--an-surface));
                border: 1px solid color-mix(in srgb, var(--an-primary) 35%, var(--an-outline-variant));
                box-shadow: none;
            }

            .an-auto-title { font-size: 13px; line-height: 1.05; font-weight: 850; white-space: nowrap; }
            .an-auto-subtitle { margin-top: 1px; font-size: 11px; }
            .an-auto-switch { transform: scale(.82); transform-origin: right center; }
            .an-panel-body { padding: 12px; gap: 10px; }
            .an-setting-row, .an-section { border-radius: 16px; padding: 10px 12px; }
            .an-setting-title, .an-section-title { font-size: 13px; }
            .an-setting-helper, .an-section-helper { font-size: 11px; }
            .an-switch { transform: scale(.88); transform-origin: right center; }
            .an-soft-button, .an-primary-button, .an-ad-details-toggle {
                min-height: 30px;
                padding: 0 11px;
                border-radius: 10px;
                border: 1px solid color-mix(in srgb, var(--an-primary) 18%, var(--an-outline-variant));
                background: color-mix(in srgb, var(--an-primary) 9%, var(--an-surface));
                color: var(--an-on-surface);
                font-size: 12px;
                font-weight: 750;
                cursor: pointer;
            }
            .an-primary-button {
                background: var(--an-primary);
                color: var(--an-on-primary);
                border-color: var(--an-primary);
            }
            .an-soft-button:hover, .an-ad-details-toggle:hover { background: color-mix(in srgb, var(--an-primary) 14%, var(--an-surface)); }
            .an-primary-button:hover { filter: brightness(1.06); }

            .an-voice-extras {
                margin-top: 8px;
                display: flex;
                gap: 8px;
                align-items: center;
                flex-wrap: wrap;
            }


            /* V2-inspired compact GitHub panel pass */
            #settings-container[data-site-theme-accent="github-dark"][data-theme="dark"],
            #settings-container[data-site-theme-accent="github-dark-high-contrast"][data-theme="dark"] {
                --an-surface: rgba(13, 17, 23, 0.96);
                --an-surface-container: rgba(22, 27, 34, 0.86);
                --an-surface-container-high: rgba(33, 38, 45, 0.88);
                --an-on-surface: #e6edf3;
                --an-on-surface-variant: #7d8590;
                --an-outline: #484f58;
                --an-outline-variant: rgba(255,255,255,0.075);
                --an-shadow: rgba(1, 4, 9, 0.82);
                border-radius: 14px;
                border-color: rgba(255,255,255,0.08);
                box-shadow: 0 8px 32px rgba(0,0,0,0.42);
                background: rgba(13, 17, 23, 0.96);
                backdrop-filter: blur(12px);
            }

            #settings-container[data-site-theme-accent="github-dark"] .an-panel-header,
            #settings-container[data-site-theme-accent="github-dark-high-contrast"] .an-panel-header {
                min-height: 52px;
                padding: 10px 12px 9px 14px;
                background: linear-gradient(180deg, rgba(22,27,34,.92), rgba(13,17,23,.92));
                border-bottom: 1px solid rgba(255,255,255,0.065);
            }

            #settings-container[data-site-theme-accent="github-dark"] .an-title,
            #settings-container[data-site-theme-accent="github-dark-high-contrast"] .an-title {
                font-size: 15px;
                font-weight: 700;
                color: #c9d1d9;
                letter-spacing: .01em;
            }

            #settings-container[data-site-theme-accent="github-dark"] .an-version-badge,
            #settings-container[data-site-theme-accent="github-dark-high-contrast"] .an-version-badge {
                height: 17px;
                padding: 0 6px;
                border-radius: 5px;
                font-size: 10px;
                font-weight: 700;
                color: #7d8590;
                background: rgba(255,255,255,0.04);
                border: 1px solid rgba(255,255,255,0.06);
            }

            #settings-container[data-site-theme-accent="github-dark"] .an-status-pill,
            #settings-container[data-site-theme-accent="github-dark-high-contrast"] .an-status-pill {
                min-height: 22px;
                margin-top: 4px;
                padding: 3px 8px;
                gap: 7px;
                background: rgba(0,0,0,0.20);
                border-color: rgba(88,166,255,0.12);
            }

            #settings-container[data-site-theme-accent="github-dark"] .an-status-dot,
            #settings-container[data-site-theme-accent="github-dark-high-contrast"] .an-status-dot {
                width: 7px;
                height: 7px;
                box-shadow: none;
            }

            #settings-container[data-site-theme-accent="github-dark"] .an-status-copy,
            #settings-container[data-site-theme-accent="github-dark-high-contrast"] .an-status-copy {
                display: flex;
                align-items: center;
                gap: 6px;
            }

            #settings-container[data-site-theme-accent="github-dark"] .an-status-title,
            #settings-container[data-site-theme-accent="github-dark-high-contrast"] .an-status-title {
                font-size: 11px;
                color: #c9d1d9;
            }

            #settings-container[data-site-theme-accent="github-dark"] .an-status-text,
            #settings-container[data-site-theme-accent="github-dark-high-contrast"] .an-status-text {
                font-size: 10px;
                color: #7d8590;
            }

            #settings-container[data-site-theme-accent="github-dark"] .an-sticky-core,
            #settings-container[data-site-theme-accent="github-dark-high-contrast"] .an-sticky-core {
                background: rgba(0,0,0,0.14);
                border: 0;
                border-bottom: 1px solid rgba(255,255,255,0.055);
                box-shadow: none;
                padding: 10px;
                gap: 8px;
            }

            #settings-container[data-site-theme-accent="github-dark"] .an-card,
            #settings-container[data-site-theme-accent="github-dark"] .an-section,
            #settings-container[data-site-theme-accent="github-dark"] .an-setting-row,
            #settings-container[data-site-theme-accent="github-dark-high-contrast"] .an-card,
            #settings-container[data-site-theme-accent="github-dark-high-contrast"] .an-section,
            #settings-container[data-site-theme-accent="github-dark-high-contrast"] .an-setting-row {
                background: rgba(0,0,0,0.22);
                border: 1px solid rgba(255,255,255,0.06);
                border-radius: 12px;
            }

            .an-modal-backdrop {
                position: fixed;
                inset: 0;
                z-index: 2147483647;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 18px;
                background: rgba(0,0,0,.48);
                backdrop-filter: blur(4px);
            }
            .an-modal-dialog {
                width: min(520px, 96vw);
                max-height: min(720px, 92vh);
                overflow: hidden;
                display: flex;
                flex-direction: column;
                border-radius: 22px;
                border: 1px solid var(--an-outline-variant, #30363d);
                background: var(--an-surface, #161b22);
                color: var(--an-on-surface, #c9d1d9);
                box-shadow: 0 24px 60px rgba(0,0,0,.5);
                font-family: Roboto, "Segoe UI", Arial, sans-serif;
            }
            .an-modal-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 12px;
                padding: 14px 16px;
                border-bottom: 1px solid var(--an-outline-variant, #30363d);
                background: color-mix(in srgb, var(--an-primary, #58a6ff) 12%, var(--an-surface, #161b22));
            }
            .an-modal-title { font-size: 16px; font-weight: 850; }
            .an-modal-close {
                width: 32px;
                height: 32px;
                border-radius: 10px;
                border: 0;
                background: transparent;
                color: inherit;
                cursor: pointer;
                font-size: 24px;
                line-height: 1;
            }
            .an-modal-body { overflow: auto; padding: 14px 16px 16px; }
            .an-modal-note { margin: 0 0 12px; font-size: 12px; color: var(--an-on-surface-variant, #8b949e); }
            .an-modal-form { display: flex; flex-direction: column; gap: 12px; }
            .an-command-field { display: flex; flex-direction: column; gap: 6px; font-size: 12px; font-weight: 800; }
            .an-command-field textarea {
                width: 100%;
                resize: vertical;
                min-height: 68px;
                padding: 10px;
                border-radius: 12px;
                border: 1px solid var(--an-outline-variant, #30363d);
                background: color-mix(in srgb, var(--an-surface-container, #21262d) 84%, transparent);
                color: inherit;
                outline: none;
                font: 13px/1.35 Roboto, "Segoe UI", Arial, sans-serif;
            }
            .an-command-field textarea:focus { border-color: var(--an-primary, #58a6ff); }
            .an-modal-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px; }

            .an-mic-test { display: flex; flex-direction: column; gap: 14px; }
            .an-mic-level-text { font-size: 13px; font-weight: 750; color: var(--an-on-surface); }
            .an-eq-bars {
                height: 140px;
                display: flex;
                align-items: end;
                gap: 4px;
                padding: 14px;
                border-radius: 18px;
                background:
                    linear-gradient(180deg, color-mix(in srgb, var(--an-primary) 7%, transparent), transparent),
                    color-mix(in srgb, var(--an-surface-container-high) 92%, #000);
                border: 1px solid var(--an-outline-variant);
            }
            .an-eq-bars span {
                flex: 1 1 0;
                min-width: 4px;
                height: var(--h, 8%);
                border-radius: 999px 999px 3px 3px;
                background: linear-gradient(180deg, var(--an-primary), color-mix(in srgb, var(--an-primary) 55%, #3fb950));
                box-shadow: 0 0 12px color-mix(in srgb, var(--an-primary) 35%, transparent);
                transition: height 80ms linear, background 120ms ease;
            }
            .an-eq-bars span.is-hot { background: linear-gradient(180deg, #f85149, #d29922); }

            .an-ad-details-toggle { margin-top: 8px; opacity: .82; }
            [data-setting="adBlock"] .an-nested-option .an-setting-title::before,
            [data-setting="adBlock"] .an-setting-title::before { content: none !important; }

            .an-resize-handle {
                position: absolute;
                bottom: 4px;
                width: 22px;
                height: 22px;
                z-index: 8;
                opacity: .52;
                pointer-events: auto;
                border-radius: 6px;
                transition: opacity 140ms ease, background 140ms ease;
            }
            .an-resize-handle::before,
            .an-resize-handle::after {
                content: '';
                position: absolute;
                right: 5px;
                bottom: 5px;
                width: 12px;
                height: 12px;
                border-right: 2px solid color-mix(in srgb, var(--an-primary) 74%, var(--an-outline));
                border-bottom: 2px solid color-mix(in srgb, var(--an-primary) 74%, var(--an-outline));
                border-radius: 1px;
            }
            .an-resize-handle::after { width: 7px; height: 7px; }
            .an-resize-se { right: 4px; cursor: nwse-resize; }
            .an-resize-sw { left: 4px; cursor: nesw-resize; transform: scaleX(-1); }
            #settings-container:hover .an-resize-handle { opacity: .95; background: color-mix(in srgb, var(--an-primary) 9%, transparent); }
            #settings-container.is-collapsed .an-resize-handle { display: none; }
            #settings-container.is-mini {
                width: 296px !important;
                min-width: 296px !important;
                min-height: 0 !important;
                height: auto !important;
                max-height: none !important;
                resize: none !important;
                overflow: hidden !important;
                border-radius: 16px !important;
            }
            #settings-container.is-mini .an-panel-header {
                min-height: 40px !important;
                padding: 6px 8px 6px 10px !important;
                display: grid !important;
                grid-template-columns: minmax(0, 1fr) auto !important;
                align-items: center !important;
                gap: 8px !important;
                cursor: grab;
            }
            #settings-container.is-mini .an-title-group {
                min-width: 0 !important;
            }
            #settings-container.is-mini .an-title-row {
                gap: 6px !important;
                align-items: center !important;
            }
            #settings-container.is-mini .an-title {
                font-size: 12.5px !important;
                line-height: 1.1 !important;
                opacity: .88;
            }
            .an-mini-header-status {
                display: none;
                align-items: center;
                gap: 5px;
                min-width: 0;
                color: var(--an-on-surface-variant);
                font-size: 10.5px;
                font-weight: 700;
                white-space: nowrap;
            }
            .an-mini-header-status::before {
                content: '';
                width: 6px;
                height: 6px;
                border-radius: 50%;
                background: var(--an-outline);
                flex: 0 0 auto;
            }
            .an-mini-header-status[data-status="idle"]::before { background: var(--an-primary); }
            .an-mini-header-status[data-status="searching"]::before { background: #d29922; }
            .an-mini-header-status[data-status="talking"]::before { background: #3fb950; }
            #settings-container.is-mini .an-mini-header-status {
                display: inline-flex;
            }
            #settings-container.is-mini .an-version-badge,
            #settings-container.is-mini #an-current-status,
            #settings-container.is-mini .an-sticky-core,
            #settings-container.is-mini .an-panel-body,
            #settings-container.is-mini .an-resize-handle {
                display: none !important;
            }
            .an-mini-widget {
                display: none;
                padding: 8px 10px 10px;
                gap: 8px;
                background: color-mix(in srgb, var(--an-surface) 97%, transparent);
                border-top: 1px solid var(--an-outline-variant);
            }
            #settings-container.is-mini .an-mini-widget {
                display: grid !important;
                grid-template-columns: 32px 32px minmax(0, 1fr);
                grid-template-areas:
                    "mic hp auto"
                    "stats stats stats";
                align-items: center;
                gap: 8px;
            }
            #mini-mic-toggle { grid-area: mic; }
            #mini-headphone-toggle { grid-area: hp; }
            #mini-auto-mode-card { grid-area: auto; }
            .an-mini-stats { grid-area: stats; }
            .an-mini-widget .an-fab-button {
                width: 32px;
                min-width: 32px;
                min-height: 32px;
                border-radius: 10px;
                font-size: 14px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
            }
            .an-mini-status { display: none !important; }
            .an-mini-auto-card {
                width: 100%;
                min-width: 0;
                min-height: 32px;
                padding: 4px 8px 4px 10px;
                gap: 8px;
                border-radius: 12px;
                display: flex;
                align-items: center;
                justify-content: space-between;
                background: color-mix(in srgb, var(--an-primary) 10%, var(--an-surface-container));
            }
            .an-mini-auto-card .an-auto-title {
                display: block;
                font-size: 10.5px;
                line-height: 1;
                font-weight: 800;
            }
            .an-mini-auto-card .an-auto-subtitle {
                margin-top: 2px;
                font-size: 9.5px;
                line-height: 1;
                color: var(--an-primary);
                white-space: nowrap;
            }
            #mini-auto-mode-switch.an-auto-switch,
            #mini-auto-mode-switch.an-auto-switch .an-switch-track { width: 34px; height: 20px; }
            #mini-auto-mode-switch.an-auto-switch .an-switch-thumb { width: 12px; height: 12px; left: 4px; }
            #mini-auto-mode-switch.an-auto-switch input:checked ~ .an-switch-thumb,
            #mini-auto-mode-switch.an-auto-switch.is-enabled .an-switch-thumb { transform: translateX(14px); }
            .an-mini-stats {
                display: grid;
                grid-template-columns: repeat(3, minmax(0, 1fr));
                gap: 6px;
            }
            .an-mini-stat {
                min-width: 0;
                border-radius: 10px;
                padding: 6px 6px 5px;
                text-align: center;
                background: color-mix(in srgb, var(--an-primary) 7%, var(--an-surface-container));
                border: 1px solid color-mix(in srgb, var(--an-primary) 12%, var(--an-outline-variant));
            }
            .an-mini-stat-value {
                font-size: 12px;
                line-height: 1;
                font-weight: 850;
                color: var(--an-primary);
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .an-mini-stat-label {
                margin-top: 3px;
                font-size: 9px;
                line-height: 1;
                color: var(--an-on-surface-variant);
            }
            #settings-container.is-mini .an-header-actions { gap: 4px; }
            #settings-container.is-mini .an-icon-button { width: 28px; height: 28px; border-radius: 9px; font-size: 13px; }
            #settings-container[data-auto-height="true"] {
                height: auto !important;
                min-height: 0 !important;
            }
            #settings-container[data-auto-height="true"] .an-panel-body {
                flex: 0 1 auto;
                max-height: calc(100vh - 106px);
            }
            @media (max-width: 420px) {
                #settings-container.is-mini {
                    width: min(296px, calc(100vw - 16px)) !important;
                    min-width: min(296px, calc(100vw - 16px)) !important;
                }
            }


            .an-advanced-section {
                margin-top: 10px;
                opacity: .72;
                transition: opacity 160ms ease;
            }
            .an-advanced-section:hover,
            .an-advanced-section.is-open { opacity: 1; }
            .an-advanced-toggle {
                width: 100%;
                border: none;
                background: transparent;
                color: var(--an-on-surface-variant);
                font-size: 12px;
                font-weight: 650;
                letter-spacing: .02em;
                text-align: left;
                cursor: pointer;
                padding: 8px 4px;
            }
            .an-advanced-content {
                display: flex;
                flex-direction: column;
                gap: 8px;
                padding-top: 4px;
            }
            .an-advanced-content[hidden] { display: none !important; }
            .an-advanced-section .an-setting-row {
                border-radius: 14px;
                padding: 10px 12px;
                background: color-mix(in srgb, var(--an-surface-container) 58%, transparent);
            }
            .an-advanced-section .an-setting-title { font-size: 13px; }
            .an-advanced-section .an-setting-helper { font-size: 11px; }

            .an-mic-tools {
                display: grid;
                grid-template-columns: 1fr;
                gap: 10px;
            }
            .an-mic-monitor {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 12px;
                padding: 10px 12px;
                border: 1px solid var(--an-outline-variant);
                border-radius: 14px;
                background: color-mix(in srgb, var(--an-surface-container) 65%, transparent);
            }
            .an-mic-monitor-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
            .an-mic-monitor-title { font-size: 13px; font-weight: 750; color: var(--an-on-surface); }
            .an-mic-monitor-helper { font-size: 11px; color: var(--an-on-surface-variant); }
            .an-mic-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; margin-top: 0; }
            .an-mic-play-button[disabled] { opacity: .48; cursor: not-allowed; }
            .an-eq-bars { gap: 3px; }
            .an-eq-bars span {
                transform-origin: bottom center;
                transition: height 55ms linear, transform 55ms linear, background 120ms ease;
                transform: scaleY(var(--pulse, 1));
            }

            @media (max-width: 460px) {
                .an-sticky-core { grid-template-columns: 1fr; }
                .an-audio-actions { justify-content: start; }
                .an-auto-card { max-width: none; }
            }
        `;
        document.head.appendChild(style);
    }

    function getPanelPosition(size) {
        const saved = settings.panelPosition && typeof settings.panelPosition === 'object' ? settings.panelPosition : {};
        const defaultLeft = Math.max(8, window.innerWidth - size.width - 20);
        const left = clampNumber(saved.left ?? defaultLeft, 8, Math.max(8, window.innerWidth - (settings.panelCollapsed ? 64 : (settings.panelMiniMode ? 330 : size.width)) - 8));
        const top = clampNumber(saved.top ?? 20, 8, Math.max(8, window.innerHeight - (settings.panelCollapsed ? 64 : 120)));
        return { left, top };
    }

    function savePanelGeometry(container) {
        if (!container) return;
        const rect = container.getBoundingClientRect();
        settings.panelPosition = {
            left: Math.round(rect.left),
            top: Math.round(rect.top)
        };
        saveSetting('panelPosition', settings.panelPosition);

        if (!settings.panelCollapsed && !settings.panelMiniMode && container.dataset.autoHeight !== 'true') {
            settings.panelSize = {
                width: Math.round(rect.width),
                height: Math.round(rect.height)
            };
            saveSetting('panelSize', settings.panelSize);
        }
    }

    function applyPanelTheme(container) {
        if (!container) return;
        const theme = settings.panelTheme === 'light' ? 'light' : 'dark';
        settings.panelTheme = theme;
        container.dataset.theme = theme;
        const themeToggle = container.querySelector('#panel-theme-toggle');
        if (themeToggle) {
            themeToggle.textContent = theme === 'dark' ? '☀️' : '🌙';
            themeToggle.title = theme === 'dark' ? 'Переключить окно на светлую тему' : 'Переключить окно на тёмную тему';
            themeToggle.setAttribute('aria-label', themeToggle.title);
        }
        applyPanelAccent(container);
    }

    function setPanelCollapsed(container, collapsed) {
        if (!container) return;
        settings.panelCollapsed = !!collapsed;
        if (settings.panelCollapsed) {
            settings.panelMiniMode = false;
            saveSetting('panelMiniMode', false);
            container.classList.remove('is-mini');
        }
        saveSetting('panelCollapsed', settings.panelCollapsed);
        container.classList.toggle('is-collapsed', settings.panelCollapsed);
        container.setAttribute('aria-expanded', String(!settings.panelCollapsed));
        const collapseButton = container.querySelector('#panel-collapse-toggle');
        if (collapseButton) {
            collapseButton.textContent = settings.panelCollapsed ? '□' : '−';
            collapseButton.title = settings.panelCollapsed ? 'Развернуть окно' : 'Свернуть в шестерёнку';
            collapseButton.setAttribute('aria-label', collapseButton.title);
        }
        savePanelGeometry(container);
    }


    function setPanelMiniMode(container, mini) {
        if (!container) return;
        const enabled = !!mini;
        settings.panelMiniMode = enabled;
        saveSetting('panelMiniMode', enabled);
        if (enabled && settings.panelCollapsed) {
            settings.panelCollapsed = false;
            saveSetting('panelCollapsed', false);
            container.classList.remove('is-collapsed');
        }
        container.classList.toggle('is-mini', enabled);
        container.setAttribute('aria-expanded', String(!settings.panelCollapsed));
        const miniButton = container.querySelector('#panel-mini-toggle');
        if (miniButton) {
            miniButton.textContent = enabled ? '▢' : '▣';
            miniButton.title = enabled ? 'Вернуть полное окно' : 'Мини-виджет';
            miniButton.setAttribute('aria-label', miniButton.title);
        }
        const collapseButton = container.querySelector('#panel-collapse-toggle');
        if (collapseButton) {
            collapseButton.textContent = settings.panelCollapsed ? '□' : '−';
            collapseButton.title = settings.panelCollapsed ? 'Развернуть окно' : 'Свернуть в шестерёнку';
            collapseButton.setAttribute('aria-label', collapseButton.title);
        }
        if (enabled) {
            container.dataset.autoHeight = 'true';
            container.style.width = '330px';
            container.style.height = 'auto';
        } else if (!settings.panelCollapsed) {
            const size = getPanelSize();
            container.style.width = `${size.width}px`;
            container.style.height = size.height ? `${size.height}px` : 'auto';
            container.dataset.autoHeight = size.height ? 'false' : 'true';
        }
        updateButtonStyles();
        updateStatsUI();
        updateCurrentStatusUI();
        savePanelGeometry(container);
    }

    function makePanelDraggable(container, handle) {
        let isDragging = false;
        let startX = 0;
        let startY = 0;
        let startLeft = 0;
        let startTop = 0;

        handle.addEventListener('pointerdown', (event) => {
            if (event.button !== 0) return;
            if (event.target.closest('button, input, select, label, a')) return;

            isDragging = true;
            const rect = container.getBoundingClientRect();
            startX = event.clientX;
            startY = event.clientY;
            startLeft = rect.left;
            startTop = rect.top;
            container.classList.add('is-dragging');
            handle.setPointerCapture?.(event.pointerId);
            event.preventDefault();
        });

        handle.addEventListener('pointermove', (event) => {
            if (!isDragging) return;
            const rect = container.getBoundingClientRect();
            const nextLeft = clampNumber(startLeft + event.clientX - startX, 8, Math.max(8, window.innerWidth - rect.width - 8));
            const nextTop = clampNumber(startTop + event.clientY - startY, 8, Math.max(8, window.innerHeight - rect.height - 8));
            container.style.left = `${nextLeft}px`;
            container.style.top = `${nextTop}px`;
            container.style.right = 'auto';
            container.style.bottom = 'auto';
        });

        const stopDragging = (event) => {
            if (!isDragging) return;
            isDragging = false;
            container.classList.remove('is-dragging');
            try { handle.releasePointerCapture?.(event.pointerId); } catch (e) {}
            savePanelGeometry(container);
        };

        handle.addEventListener('pointerup', stopDragging);
        handle.addEventListener('pointercancel', stopDragging);
    }

    function addPanelResizeHandles(container) {
        if (!container || container.querySelector('.an-resize-handle')) return;

        const createHandle = (side) => {
            const handle = document.createElement('div');
            handle.className = `an-resize-handle an-resize-${side}`;
            handle.title = side === 'sw' ? 'Изменить размер слева' : 'Изменить размер справа';
            handle.setAttribute('aria-hidden', 'true');
            handle.addEventListener('pointerdown', (event) => startPanelResize(event, container, side));
            container.appendChild(handle);
        };

        createHandle('sw');
        createHandle('se');
    }

    function startPanelResize(event, container, side) {
        if (!container || settings.panelCollapsed || settings.panelMiniMode || event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();

        const startRect = container.getBoundingClientRect();
        const startX = event.clientX;
        const startY = event.clientY;
        const minWidth = 300;
        const minHeight = 520;
        const maxWidth = Math.min(760, window.innerWidth - 16);
        const maxHeight = Math.max(minHeight, window.innerHeight - startRect.top - 8);

        const handle = event.currentTarget;
        try { handle.setPointerCapture?.(event.pointerId); } catch (e) {}
        container.classList.add('is-dragging');
        container.dataset.autoHeight = 'false';

        const onMove = (moveEvent) => {
            const dx = moveEvent.clientX - startX;
            const dy = moveEvent.clientY - startY;
            let nextWidth = side === 'sw' ? startRect.width - dx : startRect.width + dx;
            let nextLeft = startRect.left;

            nextWidth = clampNumber(nextWidth, minWidth, maxWidth);
            if (side === 'sw') {
                nextLeft = clampNumber(startRect.right - nextWidth, 8, startRect.right - minWidth);
            }

            const nextHeight = clampNumber(startRect.height + dy, minHeight, maxHeight);
            container.style.width = `${Math.round(nextWidth)}px`;
            container.style.height = `${Math.round(nextHeight)}px`;
            container.style.left = `${Math.round(nextLeft)}px`;
            container.style.right = 'auto';
        };

        const onEnd = (endEvent) => {
            window.removeEventListener('pointermove', onMove, true);
            window.removeEventListener('pointerup', onEnd, true);
            window.removeEventListener('pointercancel', onEnd, true);
            try { handle.releasePointerCapture?.(endEvent.pointerId); } catch (e) {}
            container.classList.remove('is-dragging');
            savePanelGeometry(container);
        };

        window.addEventListener('pointermove', onMove, true);
        window.addEventListener('pointerup', onEnd, true);
        window.addEventListener('pointercancel', onEnd, true);
    }

    function observePanelResize(container) {
        if (!window.ResizeObserver) return;
        let resizeTimer = null;
        const resizeObserver = new ResizeObserver(() => {
            if (settings.panelCollapsed || settings.panelMiniMode || container.dataset.autoHeight === 'true') return;
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => savePanelGeometry(container), 180);
        });
        resizeObserver.observe(container);
    }

    function createIconButton(id, text, title) {
        const button = document.createElement('button');
        button.id = id;
        button.type = 'button';
        button.className = 'an-icon-button';
        button.textContent = text;
        button.title = title;
        button.setAttribute('aria-label', title);
        return button;
    }

    function createMaterialSwitch(id, checked) {
        const label = document.createElement('label');
        label.className = 'an-switch';
        if (checked) label.classList.add('is-enabled');
        if (id) label.id = id;

        const input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = !!checked;

        const track = document.createElement('span');
        track.className = 'an-switch-track';

        const thumb = document.createElement('span');
        thumb.className = 'an-switch-thumb';

        label.appendChild(input);
        label.appendChild(track);
        label.appendChild(thumb);
        return { label, input };
    }


    function getCurrentConversationDuration() {
        return currentConversationStart ? Math.floor((Date.now() - currentConversationStart) / 1000) : 0;
    }

    function updateStatsUI() {
        const countEl = document.querySelector('#an-stat-count');
        const currentEl = document.querySelector('#an-stat-current');
        const totalEl = document.querySelector('#an-stat-total');
        const miniCountEl = document.querySelector('#an-mini-stat-count');
        const miniCurrentEl = document.querySelector('#an-mini-stat-current');
        const miniTotalEl = document.querySelector('#an-mini-stat-total');
        const legacyCounter = document.querySelector('#conversation-counter .an-counter-value');
        const countText = String(settings.conversationCount || 0);
        const currentText = formatDuration(getCurrentConversationDuration());
        const totalText = formatDuration(settings.totalConversationDuration || 0);
        if (countEl) countEl.textContent = countText;
        if (currentEl) currentEl.textContent = currentText;
        if (totalEl) totalEl.textContent = totalText;
        if (miniCountEl) miniCountEl.textContent = countText;
        if (miniCurrentEl) miniCurrentEl.textContent = currentText;
        if (miniTotalEl) miniTotalEl.textContent = totalText;
        if (legacyCounter) legacyCounter.textContent = `Разговоров: ${settings.conversationCount || 0}`;
    }

    function resolveCurrentStatus() {
        const finishedScreen = typeof getFinishedSearchContainer === 'function' ? getFinishedSearchContainer() : document.querySelector('.callScreen.callFinished');
        const timerElement = document.querySelector('.callScreen__time, .timer-label');
        const stopButton = document.querySelector('button.callScreen__cancelCallBtn, button.stop-scan-button, button.stop-talk-button, .stop-scan-button, .stop-talk-button');
        const searchButton = document.querySelector('button#searchCompanyBtn, button.callScreen__findBtn, button.go-scan-button, .scan-button');
        if (currentConversationStart || isConversationActive || (timerElement && timerElement.textContent && timerElement.textContent !== '00:00')) {
            return { key: 'talking', title: 'Разговор', text: '' };
        }
        if (stopButton && !finishedScreen) {
            return { key: 'searching', title: 'Поиск', text: '' };
        }
        if (finishedScreen) {
            return { key: 'idle', title: 'Готов', text: 'между диалогами' };
        }
        if (searchButton) {
            return { key: 'idle', title: 'Готов', text: '' };
        }
        return { key: 'idle', title: 'Готов', text: '' };
    }

    function updateCurrentStatusUI(forcedKey = null) {
        const status = forcedKey === 'talking'
            ? { key: 'talking', title: 'Разговор', text: 'Идёт общение' }
            : resolveCurrentStatus();
        const pills = [document.querySelector('#an-current-status'), document.querySelector('#an-mini-current-status')].filter(Boolean);
        pills.forEach(pill => {
            pill.dataset.status = status.key;
            const title = pill.querySelector('.an-status-title');
            const statusText = pill.querySelector('.an-status-text');
            if (title) title.textContent = status.title;
            if (statusText) statusText.textContent = status.text;
        });
        const miniHeaderStatus = document.querySelector('#an-mini-header-status');
        if (miniHeaderStatus) {
            miniHeaderStatus.dataset.status = status.key;
            miniHeaderStatus.textContent = status.title;
            miniHeaderStatus.title = status.text ? `${status.title} — ${status.text}` : status.title;
        }
    }

    function createStatusPill() {
        const pill = document.createElement('div');
        pill.id = 'an-current-status';
        pill.className = 'an-status-pill';
        pill.dataset.status = 'idle';

        const dot = document.createElement('span');
        dot.className = 'an-status-dot';

        const text = document.createElement('div');
        text.className = 'an-status-copy';

        const title = document.createElement('div');
        title.id = 'an-status-title';
        title.className = 'an-status-title';
        title.textContent = 'Готов';

        const subtitle = document.createElement('div');
        subtitle.id = 'an-status-text';
        subtitle.className = 'an-status-text';
        subtitle.textContent = '';

        text.appendChild(title);
        text.appendChild(subtitle);
        pill.appendChild(dot);
        pill.appendChild(text);
        setTimeout(updateCurrentStatusUI, 0);
        return pill;
    }

    function createVoiceControlExtras() {
        const extras = document.createElement('div');
        extras.className = 'an-voice-extras';
        extras.appendChild(createVoiceHints());

        const editButton = document.createElement('button');
        editButton.type = 'button';
        editButton.className = 'an-soft-button';
        editButton.textContent = 'Настроить фразы';
        editButton.addEventListener('click', () => openVoiceCommandsModal());
        extras.appendChild(editButton);
        return extras;
    }

    function openVoiceCommandsModal() {
        const commands = getVoiceCommands();
        const modal = createModalShell('Настройка голосовых команд', 'an-voice-modal');
        const form = document.createElement('div');
        form.className = 'an-modal-form';

        const intro = document.createElement('p');
        intro.className = 'an-modal-note';
        intro.textContent = 'Впиши слова через запятую или с новой строки. Сработает любое совпадение из списка.';
        form.appendChild(intro);

        const textareas = {};
        Object.keys(VOICE_ACTION_LABELS).forEach(key => {
            const label = document.createElement('label');
            label.className = 'an-command-field';

            const caption = document.createElement('span');
            caption.textContent = VOICE_ACTION_LABELS[key];

            const textarea = document.createElement('textarea');
            textarea.rows = 3;
            textarea.value = (commands[key] || []).join(', ');
            textarea.spellcheck = false;
            textareas[key] = textarea;

            label.appendChild(caption);
            label.appendChild(textarea);
            form.appendChild(label);
        });

        const actions = document.createElement('div');
        actions.className = 'an-modal-actions';

        const resetButton = document.createElement('button');
        resetButton.type = 'button';
        resetButton.className = 'an-soft-button';
        resetButton.textContent = 'Сбросить';
        resetButton.addEventListener('click', () => {
            Object.keys(DEFAULT_VOICE_COMMANDS).forEach(key => {
                if (textareas[key]) textareas[key].value = DEFAULT_VOICE_COMMANDS[key].join(', ');
            });
        });

        const saveButton = document.createElement('button');
        saveButton.type = 'button';
        saveButton.className = 'an-primary-button';
        saveButton.textContent = 'Сохранить';
        saveButton.addEventListener('click', () => {
            const nextCommands = normalizeVoiceCommands({
                skip: textareas.skip?.value,
                stop: textareas.stop?.value,
                start: textareas.start?.value
            });
            settings.voiceCommands = nextCommands;
            saveSetting('voiceCommands', nextCommands);
            updateVoiceHints();
            modal.close();
        });

        actions.appendChild(resetButton);
        actions.appendChild(saveButton);
        form.appendChild(actions);
        modal.body.appendChild(form);
        modal.open();
    }

    function updateVoiceHints() {
        const commands = getVoiceCommands();
        document.querySelectorAll('.an-voice-hint-content').forEach(content => {
            content.innerHTML = `<b>Голосовые команды:</b><br><b>пропустить:</b> ${commands.skip.join(' / ')}<br><b>начать:</b> ${commands.start.join(' / ')}<br><b>остановить:</b> ${commands.stop.join(' / ')}`;
        });
    }

    function createModalShell(titleText, className = '') {
        const existing = document.querySelector('.an-modal-backdrop');
        if (existing) existing.remove();

        const backdrop = document.createElement('div');
        backdrop.className = `an-modal-backdrop ${className}`.trim();
        const panel = document.getElementById('settings-container');
        if (panel) {
            const panelStyles = getComputedStyle(panel);
            ['--an-primary','--an-on-primary','--an-surface','--an-surface-container','--an-surface-container-high','--an-on-surface','--an-on-surface-variant','--an-outline-variant'].forEach(prop => {
                const value = panelStyles.getPropertyValue(prop);
                if (value) backdrop.style.setProperty(prop, value);
            });
        }

        const dialog = document.createElement('div');
        dialog.className = 'an-modal-dialog';
        dialog.setAttribute('role', 'dialog');
        dialog.setAttribute('aria-modal', 'true');

        const header = document.createElement('div');
        header.className = 'an-modal-header';
        const title = document.createElement('div');
        title.className = 'an-modal-title';
        title.textContent = titleText;
        const close = document.createElement('button');
        close.type = 'button';
        close.className = 'an-modal-close';
        close.textContent = '×';
        close.setAttribute('aria-label', 'Закрыть');
        header.appendChild(title);
        header.appendChild(close);

        const body = document.createElement('div');
        body.className = 'an-modal-body';
        dialog.appendChild(header);
        dialog.appendChild(body);
        backdrop.appendChild(dialog);

        const api = {
            body,
            open() { document.body.appendChild(backdrop); },
            close() {
                if (micTestState?.modalBackdrop === backdrop) stopMicTest('modal-close');
                if (backdrop.classList.contains('an-mic-modal')) { setTimeout(() => { if (!document.querySelector('.an-mic-modal')) clearMicTestRecording(); }, 250); }
                backdrop.remove();
            }
        };
        close.addEventListener('click', api.close);
        backdrop.addEventListener('click', event => {
            if (event.target === backdrop) api.close();
        });
        document.addEventListener('keydown', function escHandler(event) {
            if (!backdrop.isConnected) {
                document.removeEventListener('keydown', escHandler);
                return;
            }
            if (event.key === 'Escape') api.close();
        });
        return api;
    }

    function createMicTestCard() {
        const row = document.createElement('section');
        row.className = 'an-setting-row an-mic-test-row';
        row.dataset.setting = 'micTest';

        const main = document.createElement('div');
        main.className = 'an-setting-main';

        const text = document.createElement('div');
        text.className = 'an-setting-text';
        const title = document.createElement('div');
        title.className = 'an-setting-title';
        title.textContent = 'Проверка микрофона';
        const helper = document.createElement('div');
        helper.className = 'an-setting-helper';
        helper.textContent = 'Эквалайзер, запись на 8 секунд и прослушивание';
        text.appendChild(title);
        text.appendChild(helper);

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'an-soft-button';
        button.textContent = 'Открыть';
        button.addEventListener('click', () => openMicTestModal());

        main.appendChild(text);
        main.appendChild(button);
        row.appendChild(main);
        return row;
    }

    function openMicTestModal() {
        const modal = createModalShell('Проверка микрофона', 'an-mic-modal');
        const wrap = document.createElement('div');
        wrap.className = 'an-mic-test';

        const levelText = document.createElement('div');
        levelText.className = 'an-mic-level-text';
        levelText.textContent = 'Нажми «Старт»: будет запись до 8 секунд. Обычная речь может быть не 100% — это нормально, главное без красного клиппинга.';

        const eq = document.createElement('div');
        eq.className = 'an-eq-bars';
        const bars = [];
        for (let i = 0; i < 36; i++) {
            const bar = document.createElement('span');
            bar.style.setProperty('--h', '8%');
            bar.style.setProperty('--pulse', '1');
            bars.push(bar);
            eq.appendChild(bar);
        }

        const tools = document.createElement('div');
        tools.className = 'an-mic-tools';

        const monitor = document.createElement('label');
        monitor.className = 'an-mic-monitor';
        const monitorText = document.createElement('span');
        monitorText.className = 'an-mic-monitor-text';
        const monitorTitle = document.createElement('span');
        monitorTitle.className = 'an-mic-monitor-title';
        monitorTitle.textContent = 'Слышать себя';
        const monitorHelper = document.createElement('span');
        monitorHelper.className = 'an-mic-monitor-helper';
        monitorHelper.textContent = 'Только для теста, можно выключить перед записью';
        monitorText.appendChild(monitorTitle);
        monitorText.appendChild(monitorHelper);
        const monitorSwitch = createMaterialSwitch(null, false);
        monitorSwitch.input.setAttribute('aria-label', 'Слышать себя в проверке микрофона');
        monitorSwitch.input.addEventListener('change', () => {
            if (micTestState?.monitorGain) {
                micTestState.monitorGain.gain.value = monitorSwitch.input.checked ? Math.min(Math.max(settings.gainValue || 1, 0.2), 1.4) : 0;
            }
            monitorSwitch.label.classList.toggle('is-enabled', monitorSwitch.input.checked);
        });
        monitor.appendChild(monitorText);
        monitor.appendChild(monitorSwitch.label);
        tools.appendChild(monitor);

        const playbackAudio = document.createElement('audio');
        playbackAudio.controls = true;
        playbackAudio.style.width = '100%';
        playbackAudio.style.display = 'none';

        const actions = document.createElement('div');
        actions.className = 'an-modal-actions an-mic-actions';
        const play = document.createElement('button');
        play.type = 'button';
        play.className = 'an-soft-button an-mic-play-button';
        play.textContent = 'Прослушать запись';
        play.disabled = true;
        const stop = document.createElement('button');
        stop.type = 'button';
        stop.className = 'an-soft-button';
        stop.textContent = 'Стоп';
        stop.disabled = true;
        const start = document.createElement('button');
        start.type = 'button';
        start.className = 'an-primary-button';
        start.textContent = 'Старт';
        actions.appendChild(play);
        actions.appendChild(stop);
        actions.appendChild(start);

        play.addEventListener('click', () => {
            if (!micTestRecordingUrl) return;
            playbackAudio.src = micTestRecordingUrl;
            playbackAudio.style.display = 'block';
            playbackAudio.currentTime = 0;
            playbackAudio.play().catch(error => {
                levelText.textContent = 'Браузер не дал автоматически воспроизвести запись. Нажми play на плеере ниже.';
                diag('warn', 'micTest.playback.failed', { message: error?.message || String(error) });
            });
        });

        wrap.appendChild(levelText);
        wrap.appendChild(eq);
        wrap.appendChild(tools);
        wrap.appendChild(actions);
        wrap.appendChild(playbackAudio);
        modal.body.appendChild(wrap);
        modal.open();

        start.addEventListener('click', async () => {
            try {
                start.disabled = true;
                stop.disabled = false;
                play.disabled = true;
                playbackAudio.pause();
                playbackAudio.removeAttribute('src');
                playbackAudio.style.display = 'none';
                levelText.textContent = 'Записываю микрофон… максимум 8 секунд.';
                await startMicTest({
                    bars,
                    levelText,
                    startButton: start,
                    stopButton: stop,
                    playButton: play,
                    playbackAudio,
                    monitorInput: monitorSwitch.input,
                    modalBackdrop: document.querySelector('.an-mic-modal')
                });
            } catch (error) {
                levelText.textContent = 'Не удалось получить доступ к микрофону.';
                start.disabled = false;
                stop.disabled = true;
                play.disabled = !micTestRecordingUrl;
                console.error('AutoNektome mic test error:', error);
                diag('error', 'micTest.start.failed', { message: error?.message || String(error), name: error?.name });
            }
        });
        stop.addEventListener('click', () => stopMicTest('manual'));
    }

    function clearMicTestRecording() {
        if (micTestRecordingUrl) {
            try { URL.revokeObjectURL(micTestRecordingUrl); } catch (error) {}
            micTestRecordingUrl = null;
        }
    }

    function pickRecorderMimeType() {
        if (!window.MediaRecorder) return '';
        const candidates = [
            'audio/webm;codecs=opus',
            'audio/webm',
            'audio/mp4'
        ];
        return candidates.find(type => MediaRecorder.isTypeSupported?.(type)) || '';
    }

    async function startMicTest(ui) {
        stopMicTest('restart');
        clearMicTestRecording();

        const stream = await requestRawMicStream({
            audio: {
                echoCancellation: settings.echoCancellation,
                noiseSuppression: settings.noiseSuppression,
                autoGainControl: settings.autoGainControl
            }
        });
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 2048;
        analyser.minDecibels = -95;
        analyser.maxDecibels = -18;
        analyser.smoothingTimeConstant = 0.58;
        source.connect(analyser);

        const monitorGain = ctx.createGain();
        monitorGain.gain.value = ui.monitorInput?.checked ? Math.min(Math.max(settings.gainValue || 1, 0.2), 1.4) : 0;
        source.connect(monitorGain);
        monitorGain.connect(ctx.destination);

        const freqData = new Uint8Array(analyser.frequencyBinCount);
        const timeData = new Uint8Array(analyser.fftSize);
        const chunks = [];
        let recorder = null;
        let recorderStarted = false;

        if (window.MediaRecorder) {
            const mimeType = pickRecorderMimeType();
            recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
            recorder.addEventListener('dataavailable', event => {
                if (event.data && event.data.size > 0) chunks.push(event.data);
            });
            recorder.addEventListener('stop', () => {
                if (!chunks.length) {
                    ui.levelText.textContent = 'Запись остановлена, но браузер не отдал аудиоданные.';
                    if (ui.playButton) ui.playButton.disabled = true;
                    return;
                }
                clearMicTestRecording();
                const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
                micTestRecordingUrl = URL.createObjectURL(blob);
                if (ui.playButton) ui.playButton.disabled = false;
                if (ui.playbackAudio) {
                    ui.playbackAudio.src = micTestRecordingUrl;
                    ui.playbackAudio.style.display = 'block';
                }
                ui.levelText.textContent = 'Запись готова. Нажми «Прослушать запись».';
                diag('info', 'micTest.recording.ready', { bytes: blob.size, type: blob.type });
            }, { once: true });
            recorder.start(200);
            recorderStarted = true;
        } else {
            ui.levelText.textContent = 'Эквалайзер работает, но запись недоступна: браузер не поддерживает MediaRecorder.';
        }

        micTestState = {
            stream,
            ctx,
            analyser,
            freqData,
            timeData,
            ui,
            animationId: null,
            modalBackdrop: ui.modalBackdrop,
            monitorGain,
            recorder,
            chunks,
            recordStopTimer: null
        };

        micTestState.recordStopTimer = setTimeout(() => stopMicTest('auto-timeout'), 8000);

        function tick() {
            if (!micTestState) return;
            analyser.getByteFrequencyData(freqData);
            analyser.getByteTimeDomainData(timeData);

            let squareSum = 0;
            let peak = 0;
            for (let i = 0; i < timeData.length; i++) {
                const centered = (timeData[i] - 128) / 128;
                squareSum += centered * centered;
                peak = Math.max(peak, Math.abs(centered));
            }
            const rms = Math.sqrt(squareSum / timeData.length);
            const percent = Math.min(100, Math.round(Math.pow(Math.min(1, rms * 7.6), 0.72) * 100));
            const peakPercent = Math.min(100, Math.round(peak * 100));
            const status = recorderStarted ? 'идёт запись' : 'только уровень';
            ui.levelText.textContent = `Уровень: ${percent}% · пик: ${peakPercent}% · ${status}`;

            const maxBin = Math.min(freqData.length - 1, 340);
            const minBin = 2;
            const now = performance.now();
            ui.bars.forEach((bar, index) => {
                const t0 = index / ui.bars.length;
                const t1 = (index + 1) / ui.bars.length;
                const startBin = Math.max(minBin, Math.floor(minBin * Math.pow(maxBin / minBin, t0)));
                const endBin = Math.max(startBin + 1, Math.floor(minBin * Math.pow(maxBin / minBin, t1)));
                let sum = 0;
                let max = 0;
                let count = 0;
                for (let bin = startBin; bin <= endBin && bin < freqData.length; bin++) {
                    const value = freqData[bin];
                    sum += value;
                    max = Math.max(max, value);
                    count++;
                }
                const avg = count ? sum / count : 0;
                const spectral = Math.max(avg / 255, max / 255);
                const bodyMotion = Math.min(1, rms * 5.2);
                const shimmer = (0.55 + 0.45 * Math.sin(now / 95 + index * 0.72)) * bodyMotion * 0.26;
                const raw = Math.max(spectral * 1.55, bodyMotion * (0.42 - index * 0.003), shimmer);
                const visual = Math.max(7, Math.min(100, Math.pow(Math.min(1, raw * 1.65), 0.58) * 100));
                bar.style.setProperty('--h', `${visual.toFixed(1)}%`);
                bar.style.setProperty('--pulse', `${(1 + Math.min(0.18, rms * 0.9)).toFixed(3)}`);
                bar.classList.toggle('is-hot', peakPercent > 88 || visual > 82);
            });
            micTestState.animationId = requestAnimationFrame(tick);
        }
        tick();
    }

    function stopMicTest(reason = 'manual') {
        if (!micTestState) return;
        const state = micTestState;
        micTestState = null;

        cancelAnimationFrame(state.animationId);
        clearTimeout(state.recordStopTimer);

        try {
            if (state.recorder && state.recorder.state !== 'inactive') state.recorder.stop();
        } catch (error) {
            diag('warn', 'micTest.recorder.stop.failed', { message: error?.message || String(error), reason });
        }

        state.stream?.getTracks().forEach(track => track.stop());
        state.ctx?.close?.().catch(() => {});
        state.ui?.bars?.forEach(bar => {
            bar.style.setProperty('--h', '8%');
            bar.style.setProperty('--pulse', '1');
            bar.classList.remove('is-hot');
        });
        if (state.ui?.levelText && !state.recorder) state.ui.levelText.textContent = 'Проверка остановлена.';
        if (state.ui?.startButton) state.ui.startButton.disabled = false;
        if (state.ui?.stopButton) state.ui.stopButton.disabled = true;
        diag('info', 'micTest.stopped', { reason });
    }

    function createVoiceHints() {
        const wrapper = document.createElement('div');
        wrapper.className = 'voice-hint-wrapper';
        wrapper.style.display = isVoiceControlEnabled ? 'inline-flex' : 'none';

        const trigger = document.createElement('span');
        trigger.className = 'an-chip';
        trigger.textContent = 'Команды';

        const content = document.createElement('div');
        content.className = 'an-tooltip an-voice-hint-content';
        wrapper.appendChild(trigger);
        wrapper.appendChild(content);
        voiceHintElement = wrapper;
        setTimeout(updateVoiceHints, 0);
        return wrapper;
    }

    function createConversationCounter() {
        const counterDiv = document.createElement('div');
        counterDiv.id = 'conversation-counter';
        counterDiv.className = 'an-stats-card';

        function stat(id, labelText, value) {
            const item = document.createElement('div');
            item.className = 'an-stat-item';
            const valueEl = document.createElement('div');
            valueEl.id = id;
            valueEl.className = 'an-stat-value';
            valueEl.textContent = value;
            const label = document.createElement('div');
            label.className = 'an-stat-label';
            label.textContent = labelText;
            item.appendChild(valueEl);
            item.appendChild(label);
            return item;
        }

        counterDiv.appendChild(stat('an-stat-count', 'разговоров', String(settings.conversationCount || 0)));
        counterDiv.appendChild(stat('an-stat-current', 'текущий', formatDuration(getCurrentConversationDuration())));
        counterDiv.appendChild(stat('an-stat-total', 'всего', formatDuration(settings.totalConversationDuration || 0)));

        const tooltip = document.createElement('div');
        tooltip.className = 'an-tooltip';
        tooltip.innerHTML = `
            Разговоры дольше:<br>
            5 минут: ${settings.conversationStats.over5min}<br>
            15 минут: ${settings.conversationStats.over15min}<br>
            30 минут: ${settings.conversationStats.over30min}<br>
            1 часа: ${settings.conversationStats.over1hour}<br>
            2 часов: ${settings.conversationStats.over2hours}<br>
            3 часов: ${settings.conversationStats.over3hours}<br>
            5 часов: ${settings.conversationStats.over5hours}
        `;
        counterDiv.appendChild(tooltip);
        setTimeout(updateStatsUI, 0);
        return counterDiv;
    }


    function createMiniWidget() {
        const mini = document.createElement('div');
        mini.className = 'an-mini-widget';

        const miniMicButton = document.createElement('button');
        miniMicButton.id = 'mini-mic-toggle';
        miniMicButton.type = 'button';
        miniMicButton.className = 'an-fab-button an-mic-toggle-button';
        miniMicButton.innerHTML = '🎤';
        miniMicButton.addEventListener('click', toggleMic);

        const miniHeadphoneButton = document.createElement('button');
        miniHeadphoneButton.id = 'mini-headphone-toggle';
        miniHeadphoneButton.type = 'button';
        miniHeadphoneButton.className = 'an-fab-button an-headphone-toggle-button';
        miniHeadphoneButton.innerHTML = '🎧';
        miniHeadphoneButton.addEventListener('click', toggleHeadphones);

        const miniStatus = document.createElement('div');
        miniStatus.id = 'an-mini-current-status';
        miniStatus.className = 'an-status-pill an-mini-status';
        miniStatus.dataset.status = 'idle';
        const miniDot = document.createElement('span');
        miniDot.className = 'an-status-dot';
        const miniStatusCopy = document.createElement('div');
        miniStatusCopy.className = 'an-status-copy';
        const miniStatusTitle = document.createElement('div');
        miniStatusTitle.className = 'an-status-title';
        miniStatusTitle.textContent = 'Готов';
        const miniStatusText = document.createElement('div');
        miniStatusText.className = 'an-status-text';
        miniStatusCopy.appendChild(miniStatusTitle);
        miniStatusCopy.appendChild(miniStatusText);
        miniStatus.appendChild(miniDot);
        miniStatus.appendChild(miniStatusCopy);

        const miniAutoCard = document.createElement('section');
        miniAutoCard.id = 'mini-auto-mode-card';
        miniAutoCard.className = 'an-card an-auto-card an-mini-auto-card';
        const miniAutoText = document.createElement('div');
        miniAutoText.className = 'an-auto-text';
        const miniAutoTitle = document.createElement('div');
        miniAutoTitle.className = 'an-auto-title';
        miniAutoTitle.textContent = 'Автопоиск';
        const miniAutoSubtitle = document.createElement('div');
        miniAutoSubtitle.id = 'mini-auto-mode-label';
        miniAutoSubtitle.className = 'an-auto-subtitle';
        miniAutoSubtitle.textContent = isAutoModeEnabled ? 'Авто вкл' : 'Авто выкл';
        miniAutoText.appendChild(miniAutoTitle);
        miniAutoText.appendChild(miniAutoSubtitle);
        const miniAutoSwitch = createMaterialSwitch('mini-auto-mode-switch', isAutoModeEnabled);
        miniAutoSwitch.label.classList.add('an-auto-switch');
        miniAutoSwitch.input.id = 'mini-auto-mode-input';
        miniAutoSwitch.input.addEventListener('change', (event) => toggleAutoMode(event.target.checked));
        miniAutoCard.appendChild(miniAutoText);
        miniAutoCard.appendChild(miniAutoSwitch.label);

        const miniStats = document.createElement('div');
        miniStats.className = 'an-mini-stats';
        function miniStat(id, label, value) {
            const item = document.createElement('div');
            item.className = 'an-mini-stat';
            const valueEl = document.createElement('div');
            valueEl.id = id;
            valueEl.className = 'an-mini-stat-value';
            valueEl.textContent = value;
            const labelEl = document.createElement('div');
            labelEl.className = 'an-mini-stat-label';
            labelEl.textContent = label;
            item.appendChild(valueEl);
            item.appendChild(labelEl);
            return item;
        }
        miniStats.appendChild(miniStat('an-mini-stat-count', 'разговоров', String(settings.conversationCount || 0)));
        miniStats.appendChild(miniStat('an-mini-stat-current', 'текущий', formatDuration(getCurrentConversationDuration())));
        miniStats.appendChild(miniStat('an-mini-stat-total', 'всего', formatDuration(settings.totalConversationDuration || 0)));

        mini.appendChild(miniMicButton);
        mini.appendChild(miniHeadphoneButton);
        mini.appendChild(miniAutoCard);
        mini.appendChild(miniStats);
        setTimeout(() => { updateButtonStyles(); updateStatsUI(); updateCurrentStatusUI(); }, 0);
        return mini;
    }

    function createSettingsUI() {
        if (document.getElementById('settings-container')) return;
        ensureMaterialStyles();
        ensureEnhancedHybridStyles();

        const container = document.createElement('aside');
        container.id = 'settings-container';
        container.setAttribute('role', 'dialog');
        container.setAttribute('aria-label', 'AutoNektome настройки');

        const size = getPanelSize();
        const position = getPanelPosition(size);
        container.style.width = `${size.width}px`;
        container.style.height = size.height ? `${size.height}px` : 'auto';
        container.dataset.autoHeight = size.height ? 'false' : 'true';
        container.style.left = `${position.left}px`;
        container.style.top = `${position.top}px`;
        container.style.right = 'auto';
        container.style.bottom = 'auto';

        const header = document.createElement('div');
        header.className = 'an-panel-header';

        const titleGroup = document.createElement('div');
        titleGroup.className = 'an-title-group';

        const titleRow = document.createElement('div');
        titleRow.className = 'an-title-row';

        const title = document.createElement('h3');
        title.className = 'an-title';
        title.textContent = 'AutoNektome';

        const miniHeaderStatus = document.createElement('span');
        miniHeaderStatus.id = 'an-mini-header-status';
        miniHeaderStatus.className = 'an-mini-header-status';
        miniHeaderStatus.dataset.status = 'idle';
        miniHeaderStatus.textContent = 'Готов';

        const versionBadge = document.createElement('span');
        versionBadge.className = 'an-version-badge';
        versionBadge.textContent = `v${SCRIPT_VERSION}`;

        titleRow.appendChild(title);
        titleRow.appendChild(miniHeaderStatus);
        titleRow.appendChild(versionBadge);
        titleGroup.appendChild(titleRow);
        titleGroup.appendChild(createStatusPill());

        const actions = document.createElement('div');
        actions.className = 'an-header-actions';

        const themeToggle = createIconButton('panel-theme-toggle', '☀️', 'Переключить тему окна');
        themeToggle.addEventListener('click', (event) => {
            event.stopPropagation();
            settings.panelTheme = settings.panelTheme === 'dark' ? 'light' : 'dark';
            saveSetting('panelTheme', settings.panelTheme);
            applyPanelTheme(container);
        });

        const miniToggle = createIconButton('panel-mini-toggle', '▣', 'Мини-виджет');
        miniToggle.addEventListener('click', (event) => {
            event.stopPropagation();
            setPanelMiniMode(container, !settings.panelMiniMode);
        });

        const collapseToggle = createIconButton('panel-collapse-toggle', '−', 'Свернуть в шестерёнку');
        collapseToggle.addEventListener('click', (event) => {
            event.stopPropagation();
            setPanelCollapsed(container, !settings.panelCollapsed);
        });

        // В шапке оставляем только два оконных действия: мини-виджет и сворачивание в шестерёнку.
        // Переключатель светлой/тёмной темы окна больше не показываем, чтобы верхушка не отвлекала.
        actions.appendChild(miniToggle);
        actions.appendChild(collapseToggle);

        const collapsedFab = document.createElement('div');
        collapsedFab.className = 'an-collapsed-fab';
        collapsedFab.textContent = '⚙️';
        collapsedFab.title = 'Развернуть AutoNektome';

        header.appendChild(titleGroup);
        header.appendChild(actions);
        header.appendChild(collapsedFab);

        const body = document.createElement('div');
        body.className = 'an-panel-body';

        const coreBlock = document.createElement('div');
        coreBlock.className = 'an-sticky-core';
        coreBlock.appendChild(createConversationCounter());

        const audioControls = document.createElement('div');
        audioControls.className = 'an-audio-actions';

        const micButton = document.createElement('button');
        micButton.id = 'mic-toggle';
        micButton.type = 'button';
        micButton.className = 'an-fab-button an-mic-toggle-button';
        micButton.innerHTML = '🎤';
        micButton.addEventListener('click', toggleMic);

        const headphoneButton = document.createElement('button');
        headphoneButton.id = 'headphone-toggle';
        headphoneButton.type = 'button';
        headphoneButton.className = 'an-fab-button an-headphone-toggle-button';
        headphoneButton.innerHTML = '🎧';
        headphoneButton.addEventListener('click', toggleHeadphones);

        audioControls.appendChild(micButton);
        audioControls.appendChild(headphoneButton);
        coreBlock.appendChild(audioControls);

        const autoCard = document.createElement('section');
        autoCard.id = 'auto-mode-card';
        autoCard.className = 'an-card an-auto-card';

        const autoText = document.createElement('div');
        autoText.className = 'an-auto-text';

        const autoTitle = document.createElement('div');
        autoTitle.className = 'an-auto-title';
        autoTitle.textContent = 'Автопоиск';

        const autoSubtitle = document.createElement('div');
        autoSubtitle.id = 'auto-mode-label';
        autoSubtitle.className = 'an-auto-subtitle';
        autoSubtitle.textContent = isAutoModeEnabled ? 'Вкл' : 'Выкл';

        autoText.appendChild(autoTitle);
        autoText.appendChild(autoSubtitle);

        const autoSwitch = createMaterialSwitch('auto-mode-switch', isAutoModeEnabled);
        autoSwitch.label.classList.add('an-auto-switch');
        autoSwitch.input.id = 'auto-mode-input';
        autoSwitch.input.addEventListener('change', (event) => toggleAutoMode(event.target.checked));

        autoCard.appendChild(autoText);
        autoCard.appendChild(autoSwitch.label);
        coreBlock.appendChild(autoCard);

        const audioSettings = document.createElement('div');
        audioSettings.className = 'an-settings-list';

        const settingHelpers = {
            enableLoopback: 'Слышать свой микрофон в наушниках',
            autoGainControl: 'Автонастройка уровня микрофона',
            autoVolume: 'Выравнивает громкость собеседника',
            noiseSuppression: 'Уменьшает фоновый шум',
            echoCancellation: 'Уменьшает эхо',
            voicePitch: 'Понижает голос',
            voiceControl: 'Команды: скип, чат, завершить',
            diagnosticLogs: 'Подробные события в консоль и AutoNektomeDebug.dump()',
            adBlock: 'Скрывает баннеры, не мешая загрузке сайта',
            adBlockHideElements: 'Прячет рекламные места',
            adBlockBlockNetwork: 'Блокирует рекламные вставки',
            metricBlock: 'Отключает отправку статистики',
            metricGlobalStubs: 'Выключает счётчики после загрузки'
        };

        function createNestedSetting(labelText, helperText, key, onChange) {
            const option = document.createElement('div');
            option.className = 'an-nested-option';
            option.dataset.setting = key;

            const text = document.createElement('div');
            text.className = 'an-setting-text';

            const title = document.createElement('div');
            title.className = 'an-setting-title';
            title.textContent = labelText;

            const helper = document.createElement('div');
            helper.className = 'an-setting-helper';
            helper.textContent = helperText || '';

            text.appendChild(title);
            text.appendChild(helper);

            const control = createMaterialSwitch(null, settings[key]);
            control.input.value = key;
            control.input.dataset.setting = key;
            control.input.setAttribute('aria-label', labelText);
            control.input.addEventListener('change', () => {
                settings[key] = control.input.checked;
                saveSetting(key, control.input.checked);
                control.label.classList.toggle('is-enabled', control.input.checked);
                onChange?.(control.input.checked);
            });

            option.appendChild(text);
            option.appendChild(control.label);
            return option;
        }

        function createToggle(labelText, key) {
            const row = document.createElement('section');
            row.className = 'an-setting-row';
            row.dataset.setting = key;

            const main = document.createElement('div');
            main.className = 'an-setting-main';

            const text = document.createElement('div');
            text.className = 'an-setting-text';

            const title = document.createElement('div');
            title.className = 'an-setting-title';
            title.textContent = labelText;

            const helper = document.createElement('div');
            helper.className = 'an-setting-helper';
            helper.textContent = settingHelpers[key] || '';

            text.appendChild(title);
            text.appendChild(helper);

            const control = createMaterialSwitch(null, settings[key]);
            const checkbox = control.input;
            checkbox.value = key;
            checkbox.dataset.setting = key;
            checkbox.setAttribute('aria-label', labelText);

            main.appendChild(text);
            main.appendChild(control.label);
            row.appendChild(main);

            let volumeContainer = null;
            let pitchContainer = null;
            let adBlockContainer = null;
            let adBlockDetailsButton = null;

            if (key === 'adBlock') {
                adBlockDetailsButton = document.createElement('button');
                adBlockDetailsButton.type = 'button';
                adBlockDetailsButton.className = 'an-ad-details-toggle';
                adBlockDetailsButton.setAttribute('aria-expanded', String(!!settings.adBlockDetailsExpanded));
                adBlockDetailsButton.disabled = !settings.adBlock;
                adBlockDetailsButton.textContent = settings.adBlockDetailsExpanded ? 'Скрыть параметры ↑' : 'Параметры ↓';

                adBlockContainer = document.createElement('div');
                adBlockContainer.className = 'an-nested an-nested-options';
                adBlockContainer.hidden = !settings.adBlockDetailsExpanded;

                adBlockDetailsButton.addEventListener('click', () => {
                    settings.adBlockDetailsExpanded = !settings.adBlockDetailsExpanded;
                    saveSetting('adBlockDetailsExpanded', settings.adBlockDetailsExpanded);
                    adBlockContainer.hidden = !settings.adBlockDetailsExpanded;
                    adBlockDetailsButton.setAttribute('aria-expanded', String(settings.adBlockDetailsExpanded));
                    adBlockDetailsButton.textContent = settings.adBlockDetailsExpanded ? 'Скрыть параметры ↑' : 'Параметры ↓';
                });

                adBlockContainer.appendChild(createNestedSetting(
                    'Скрывать блоки',
                    settingHelpers.adBlockHideElements,
                    'adBlockHideElements',
                    () => applyAdBlock()
                ));
                adBlockContainer.appendChild(createNestedSetting(
                    'Не грузить рекламу',
                    settingHelpers.adBlockBlockNetwork,
                    'adBlockBlockNetwork',
                    () => applyAdBlock()
                ));
                adBlockContainer.appendChild(createNestedSetting(
                    'Отключить метрики',
                    settingHelpers.metricBlock,
                    'metricBlock',
                    () => applyAdBlock()
                ));
                adBlockContainer.appendChild(createNestedSetting(
                    'Глушить счётчики',
                    settingHelpers.metricGlobalStubs,
                    'metricGlobalStubs',
                    () => applyAdBlock()
                ));
            }

            if (key === 'enableLoopback') {
                volumeContainer = document.createElement('div');
                volumeContainer.className = 'an-nested';
                volumeContainer.hidden = !settings.enableLoopback;

                const rangeRow = document.createElement('label');
                rangeRow.className = 'an-range-row';

                const volumeLabel = document.createElement('span');
                volumeLabel.className = 'an-range-label';
                volumeLabel.textContent = `Громкость самопрослушивания: ${settings.gainValue.toFixed(1)}`;

                const volumeSlider = document.createElement('input');
                volumeSlider.type = 'range';
                volumeSlider.className = 'an-range';
                volumeSlider.min = '0.1';
                volumeSlider.max = '3.0';
                volumeSlider.step = '0.1';
                volumeSlider.value = settings.gainValue;

                rangeRow.appendChild(volumeLabel);
                rangeRow.appendChild(volumeSlider);
                volumeContainer.appendChild(rangeRow);

                volumeSlider.addEventListener('input', () => {
                    settings.gainValue = parseFloat(volumeSlider.value);
                    volumeLabel.textContent = `Громкость самопрослушивания: ${settings.gainValue.toFixed(1)}`;
                    saveSetting('gainValue', settings.gainValue);
                    if (gainNode) gainNode.gain.value = settings.gainValue;
                });
            }

            if (key === 'voicePitch') {
                pitchContainer = document.createElement('div');
                pitchContainer.className = 'an-nested';
                pitchContainer.hidden = !settings.voicePitch;

                const rangeRow = document.createElement('label');
                rangeRow.className = 'an-range-row';

                const pitchLabel = document.createElement('span');
                pitchLabel.className = 'an-range-label';
                pitchLabel.textContent = `0 — обычный голос, 0.40 — очень низкий: ${settings.pitchLevel.toFixed(2)}`;

                const pitchSlider = document.createElement('input');
                pitchSlider.type = 'range';
                pitchSlider.className = 'an-range';
                pitchSlider.min = '0';
                pitchSlider.max = '0.4';
                pitchSlider.step = '0.01';
                pitchSlider.value = settings.pitchLevel;

                rangeRow.appendChild(pitchLabel);
                rangeRow.appendChild(pitchSlider);
                pitchContainer.appendChild(rangeRow);

                pitchSlider.addEventListener('input', () => {
                    settings.pitchLevel = parseFloat(pitchSlider.value);
                    pitchLabel.textContent = `0 — обычный голос, 0.40 — очень низкий: ${settings.pitchLevel.toFixed(2)}`;
                    saveSetting('pitchLevel', settings.pitchLevel);
                    updatePitchLevel(settings.pitchLevel);
                });
            }

            checkbox.addEventListener('change', () => {
                settings[key] = checkbox.checked;
                saveSetting(key, checkbox.checked);
                control.label.classList.toggle('is-enabled', checkbox.checked);

                if (key === 'enableLoopback') {
                    if (checkbox.checked && globalStream) enableSelfListening(globalStream);
                    else stopSelfListening();
                    if (volumeContainer) volumeContainer.hidden = !checkbox.checked;
                } else if (key === 'voiceControl') {
                    isVoiceControlEnabled = checkbox.checked;
                    if (voiceHintElement) voiceHintElement.style.display = checkbox.checked ? 'inline-flex' : 'none';

                    if (checkbox.checked) {
                        isNetworkBlocked = false;
                        if (!recognition) initSpeechRecognition();
                        if (recognition) startRecognitionSafe();
                    } else if (recognition) {
                        try { recognition.stop(); } catch(e) {}
                    }
                } else if (key === 'autoVolume') {
                    if (checkbox.checked) {
                        const audio = document.querySelector('audio#audioStream');
                        if (audio && audio.srcObject) setupAutoVolume(audio.srcObject);
                    } else {
                        stopAutoVolume('setting-disabled');
                    }
                } else if (key === 'voicePitch') {
                    updatePitchEffect(checkbox.checked);
                    if (pitchContainer) pitchContainer.hidden = !checkbox.checked;
                } else if (key === 'adBlock') {
                    if (!checkbox.checked && adBlockContainer) adBlockContainer.hidden = true;
                    if (checkbox.checked && adBlockContainer) adBlockContainer.hidden = !settings.adBlockDetailsExpanded;
                    if (adBlockDetailsButton) adBlockDetailsButton.disabled = !checkbox.checked;
                    applyAdBlock();
                }
            });

            if (key === 'voiceControl') row.appendChild(createVoiceControlExtras());
            if (key === 'adBlock' && adBlockDetailsButton) row.appendChild(adBlockDetailsButton);
            if (key === 'adBlock' && adBlockContainer) row.appendChild(adBlockContainer);
            if (key === 'enableLoopback' && volumeContainer) row.appendChild(volumeContainer);
            if (key === 'voicePitch' && pitchContainer) row.appendChild(pitchContainer);
            return row;
        }

        function createAdvancedSettingsSection() {
            const section = document.createElement('section');
            section.className = 'an-advanced-section';
            section.classList.toggle('is-open', !!settings.advancedSettingsExpanded);

            const toggle = document.createElement('button');
            toggle.type = 'button';
            toggle.className = 'an-advanced-toggle';
            toggle.setAttribute('aria-expanded', String(!!settings.advancedSettingsExpanded));
            toggle.textContent = settings.advancedSettingsExpanded ? 'Дополнительные настройки ↑' : 'Дополнительные настройки ↓';

            const content = document.createElement('div');
            content.className = 'an-advanced-content';
            content.hidden = !settings.advancedSettingsExpanded;
            content.appendChild(createToggle('Блокировка рекламы', 'adBlock'));
            content.appendChild(createToggle('Диагностические логи', 'diagnosticLogs'));

            toggle.addEventListener('click', () => {
                settings.advancedSettingsExpanded = !settings.advancedSettingsExpanded;
                saveSetting('advancedSettingsExpanded', settings.advancedSettingsExpanded);
                content.hidden = !settings.advancedSettingsExpanded;
                section.classList.toggle('is-open', settings.advancedSettingsExpanded);
                toggle.setAttribute('aria-expanded', String(settings.advancedSettingsExpanded));
                toggle.textContent = settings.advancedSettingsExpanded ? 'Дополнительные настройки ↑' : 'Дополнительные настройки ↓';
            });

            section.appendChild(toggle);
            section.appendChild(content);
            return section;
        }

        audioSettings.appendChild(createToggle('Самопрослушивание', 'enableLoopback'));
        audioSettings.appendChild(createToggle('Автогромкость микрофона', 'autoGainControl'));
        audioSettings.appendChild(createToggle('Автогромкость собеседника', 'autoVolume'));
        audioSettings.appendChild(createToggle('Шумоподавление', 'noiseSuppression'));
        audioSettings.appendChild(createToggle('Эхоподавление', 'echoCancellation'));
        audioSettings.appendChild(createToggle('Низкий голос', 'voicePitch'));
        audioSettings.appendChild(createToggle('Голосовое управление', 'voiceControl'));
        audioSettings.appendChild(createMicTestCard());

        body.appendChild(audioSettings);
        body.appendChild(createThemeSelector());
        body.appendChild(createAdvancedSettingsSection());

        container.appendChild(header);
        container.appendChild(createMiniWidget());
        container.appendChild(coreBlock);
        container.appendChild(body);
        document.body.appendChild(container);

        applyPanelTheme(container);
        setPanelCollapsed(container, !!settings.panelCollapsed);
        if (!settings.panelCollapsed) setPanelMiniMode(container, !!settings.panelMiniMode);
        makePanelDraggable(container, header);
        addPanelResizeHandles(container);
        observePanelResize(container);
        updateButtonStyles();
        toggleAutoMode(isAutoModeEnabled);
        updateStatsUI();
        updateCurrentStatusUI();

        container.addEventListener('click', () => {
            if (settings.panelCollapsed) setPanelCollapsed(container, false);
        });
    }

    // ### Инициализация
    function runDomMaintenance(reason = 'unknown') {
        pendingDomMaintenance = false;
        const started = performance.now();
        lastDomMaintenanceAt = Date.now();

        try {
            checkAndClickButton(reason);
            applySiteChromePolish();
            updateCurrentStatusUI();
            updateStatsUI();

            const audio = document.querySelector('audio#audioStream');
            if (audio && audio.srcObject && settings.autoVolume) setupAutoVolume(audio.srcObject, `dom:${reason}`);

            const finishedScreen = document.querySelector('.callScreen.callFinished');
            if (finishedScreen && isConversationActive) {
                stopConversationTimer();
            }

            const timerElement = document.querySelector('.callScreen__time, .timer-label');

            if (timerElement && timerElement.textContent === '00:00' && !conversationTimer) {
                startConversationTimer();
            }

            if (!timerElement && conversationTimer) {
                stopConversationTimer();
            }

            let stopButton = document.querySelector('button.callScreen__cancelCallBtn.btn.danger2.cancelCallBtnNoMess');
            if (!stopButton) {
                stopButton = document.querySelector('button.btn.btn-lg.stop-talk-button');
            }

            if (stopButton && !stopButton.dataset.listenerAdded) {
                stopButton.addEventListener('click', () => {
                    setTimeout(() => {
                        const confirmButton = document.querySelector('button.swal2-confirm.swal2-styled');
                        if (confirmButton && !confirmButton.dataset.listenerAdded) {
                            confirmButton.addEventListener('click', playNotificationOnEnd);
                            confirmButton.dataset.listenerAdded = 'true';
                        }
                    }, 500);
                });
                stopButton.dataset.listenerAdded = 'true';
            }
        } catch (error) {
            diag('error', 'domMaintenance.error', { reason, message: error?.message || String(error), stack: error?.stack || null });
        } finally {
            const elapsed = performance.now() - started;
            diag(elapsed > 25 ? 'warn' : 'debug', 'domMaintenance.done', {
                reason,
                elapsedMs: Math.round(elapsed),
                burst: domMutationBurstCount
            }, { throttleMs: 750 });
            domMutationBurstCount = 0;
        }
    }

    function scheduleDomMaintenance(reason = 'mutation', added = 0) {
        domMutationBurstCount += added;
        if (pendingDomMaintenance) return;
        pendingDomMaintenance = true;
        requestAnimationFrame(() => runDomMaintenance(reason));
    }

    function initObserver() {
        if (observer || !document.body) return;
        observer = new MutationObserver((mutations) => {
            let added = 0;
            let relevant = false;
            for (const mutation of mutations) {
                if (!mutation.addedNodes.length) continue;
                added += mutation.addedNodes.length;
                relevant = true;
            }
            if (!relevant) return;
            diag('debug', 'domObserver.mutations', { mutations: mutations.length, added }, { throttleMs: 1000 });
            scheduleDomMaintenance('mutation', added);
        });
        observer.observe(document.body, { childList: true, subtree: true });
        diag('info', 'domObserver.started');
        scheduleDomMaintenance('observer-start', 0);
    }

    function installGetUserMediaPatch() {
        if (isGetUserMediaPatched) return true;
        if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') return false;

        nativeGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);

        const patchedGetUserMedia = async function(constraints) {
            const normalizedConstraints = normalizeMediaConstraints(constraints);
            diag('info', 'getUserMedia.request', normalizedConstraints, { throttleMs: 500 });
            const rawStream = await nativeGetUserMedia(normalizedConstraints);
            diag('info', 'getUserMedia.success', {
                audio: !!normalizedConstraints?.audio,
                video: !!normalizedConstraints?.video,
                tracks: rawStream?.getTracks?.().map(track => ({ kind: track.kind, id: track.id, label: track.label, readyState: track.readyState, enabled: track.enabled })) || []
            });

            if (!normalizedConstraints?.audio) return rawStream;
            return buildOutgoingMicStream(rawStream);
        };

        patchedGetUserMedia.__autoNektomePatched = true;
        navigator.mediaDevices.getUserMedia = patchedGetUserMedia;
        isGetUserMediaPatched = true;
        console.log('AutoNektome: getUserMedia audio patch установлен');
        return true;
    }

    if (!installGetUserMediaPatch()) {
        const mediaPatchInterval = setInterval(() => {
            if (installGetUserMediaPatch()) clearInterval(mediaPatchInterval);
        }, 50);
    }

    const srcObjectDescriptor = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'srcObject');
    if (srcObjectDescriptor?.set && !HTMLMediaElement.prototype.__autoNektomeSrcObjectPatched) {
        Object.defineProperty(HTMLMediaElement.prototype, 'srcObject', {
            configurable: true,
            enumerable: srcObjectDescriptor.enumerable,
            get: srcObjectDescriptor.get,
            set: function(stream) {
                srcObjectDescriptor.set.call(this, stream);
                if (this.id === 'audioStream' && stream && settings.autoVolume) setupAutoVolume(stream, 'srcObject-setter');
            }
        });
        HTMLMediaElement.prototype.__autoNektomeSrcObjectPatched = true;
    }

    let isInitialized = false;
    async function init() {
        if (isInitialized) return;
        if (!document.body) {
            document.addEventListener('DOMContentLoaded', init, { once: true });
            return;
        }

        isInitialized = true;
        console.log('Инициализация скрипта...');
        diag('info', 'init.start', { readyState: document.readyState, bodyChildren: document.body?.children?.length || 0 });
        ensureSiteChromePolishStyles();
        createSettingsUI();
        applyAdBlock();
        applyTheme(settings.selectedTheme);
        applySiteChromePolish();
        diag('info', 'init.autoClickInitialSkipped', { reason: 'idle screen must stay visible' });
        initObserver();
        // Не запрашиваем микрофон для распознавания речи на старте, если голосовое управление выключено.
        // Иначе инициализация может зависнуть на getUserMedia/разрешениях и выглядеть как поломка сайта.
        if (settings.voiceControl) await initSpeechRecognition();
        console.log('Инициализация завершена');
        diag('info', 'init.done', window.AutoNektomeDebug?.dump?.().state || null);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();