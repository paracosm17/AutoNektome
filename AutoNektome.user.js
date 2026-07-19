// ==UserScript==
// @name         AutoNektome
// @namespace    http://tampermonkey.net/
// @version      5.1.0
// @description  Автоматический переход с настройками звука, голосовым управлением и выбором тем для nekto.me audiochat.
// @author       https://t.me/contact_developer_bot
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
  // Реестр фактических аудиотреков, которые могут быть переданы собеседнику.
  // Устанавливается при запуске панели или непосредственно перед первым поиском,
  // чтобы кнопка микрофона управляла не только внутренним потоком AutoNektome,
  // но и WebRTC-треком самого NektoMe.
  const __autoNektomeMediaSafety = (() => {
    const audioTracks = new Set();
    const peerConnections = new Set();
    const enabledBeforeMute = new WeakMap();
    let muted = false;
    let enforcementTimer = null;

    const isAudioTrack = track => !!track && track.kind === 'audio';

    const forgetTrack = track => {
      audioTracks.delete(track);
      enabledBeforeMute.delete(track);
    };

    const applyTrackState = track => {
      if (!isAudioTrack(track) || track.readyState === 'ended') {
        if (track) forgetTrack(track);
        return false;
      }

      try {
        if (muted) {
          if (!enabledBeforeMute.has(track)) enabledBeforeMute.set(track, track.enabled !== false);
          track.enabled = false;
        } else if (enabledBeforeMute.has(track)) {
          const previousState = enabledBeforeMute.get(track);
          enabledBeforeMute.delete(track);
          track.enabled = previousState;
        }
      } catch (error) {}
      return true;
    };

    const registerTrack = track => {
      if (!isAudioTrack(track)) return track;
      if (!audioTracks.has(track)) {
        audioTracks.add(track);
        try {
          track.addEventListener?.('ended', () => forgetTrack(track), { once: true });
        } catch (error) {}
      }
      applyTrackState(track);
      return track;
    };

    const registerStream = stream => {
      if (!stream?.getAudioTracks) return stream;
      try { stream.getAudioTracks().forEach(registerTrack); } catch (error) {}
      try {
        if (!stream.__autoNektomeTrackListenerInstalled) {
          Object.defineProperty(stream, '__autoNektomeTrackListenerInstalled', {
            value: true,
            configurable: true
          });
          stream.addEventListener?.('addtrack', event => registerTrack(event.track));
        }
      } catch (error) {}
      return stream;
    };

    const registerPeerConnection = connection => {
      if (!connection || typeof connection.getSenders !== 'function') return connection;
      peerConnections.add(connection);
      try { connection.getSenders().forEach(sender => registerTrack(sender?.track)); } catch (error) {}
      return connection;
    };

    const enforceMutedState = () => {
      peerConnections.forEach(connection => {
        if (!connection || connection.connectionState === 'closed' || connection.signalingState === 'closed') {
          peerConnections.delete(connection);
          return;
        }
        registerPeerConnection(connection);
      });
      audioTracks.forEach(applyTrackState);
    };

    const syncEnforcementTimer = () => {
      if (muted && !enforcementTimer) {
        enforcementTimer = setInterval(enforceMutedState, 200);
      } else if (!muted && enforcementTimer) {
        clearInterval(enforcementTimer);
        enforcementTimer = null;
      }
    };

    const setMuted = value => {
      muted = !!value;
      enforceMutedState();
      syncEnforcementTimer();
      return muted;
    };

    const install = () => {
      const mediaDevices = navigator.mediaDevices;
      if (mediaDevices?.getUserMedia && !mediaDevices.getUserMedia.__autoNektomeSafetyWrapped) {
        try {
          const originalGetUserMedia = mediaDevices.getUserMedia;
          const wrappedGetUserMedia = function(...args) {
            return Reflect.apply(originalGetUserMedia, mediaDevices, args).then(registerStream);
          };
          Object.defineProperty(wrappedGetUserMedia, '__autoNektomeSafetyWrapped', { value: true });
          Object.defineProperty(wrappedGetUserMedia, '__autoNektomeOriginal', { value: originalGetUserMedia });
          mediaDevices.getUserMedia = wrappedGetUserMedia;
        } catch (error) {}
      }

      const peerPrototype = window.RTCPeerConnection?.prototype;
      if (peerPrototype?.addTrack && !peerPrototype.addTrack.__autoNektomeSafetyWrapped) {
        try {
          const originalAddTrack = peerPrototype.addTrack;
          const wrappedAddTrack = function(track, ...streams) {
            registerTrack(track);
            streams.forEach(registerStream);
            const sender = Reflect.apply(originalAddTrack, this, [track, ...streams]);
            registerPeerConnection(this);
            registerTrack(sender?.track);
            return sender;
          };
          Object.defineProperty(wrappedAddTrack, '__autoNektomeSafetyWrapped', { value: true });
          peerPrototype.addTrack = wrappedAddTrack;
        } catch (error) {}
      }

      if (peerPrototype?.addStream && !peerPrototype.addStream.__autoNektomeSafetyWrapped) {
        try {
          const originalAddStream = peerPrototype.addStream;
          const wrappedAddStream = function(stream) {
            registerStream(stream);
            const result = Reflect.apply(originalAddStream, this, [stream]);
            registerPeerConnection(this);
            return result;
          };
          Object.defineProperty(wrappedAddStream, '__autoNektomeSafetyWrapped', { value: true });
          peerPrototype.addStream = wrappedAddStream;
        } catch (error) {}
      }

      if (peerPrototype?.addTransceiver && !peerPrototype.addTransceiver.__autoNektomeSafetyWrapped) {
        try {
          const originalAddTransceiver = peerPrototype.addTransceiver;
          const wrappedAddTransceiver = function(trackOrKind, init) {
            if (typeof trackOrKind === 'object') registerTrack(trackOrKind);
            const transceiver = Reflect.apply(originalAddTransceiver, this, [trackOrKind, init]);
            registerPeerConnection(this);
            registerTrack(transceiver?.sender?.track);
            return transceiver;
          };
          Object.defineProperty(wrappedAddTransceiver, '__autoNektomeSafetyWrapped', { value: true });
          peerPrototype.addTransceiver = wrappedAddTransceiver;
        } catch (error) {}
      }

      const senderPrototype = window.RTCRtpSender?.prototype;
      if (senderPrototype?.replaceTrack && !senderPrototype.replaceTrack.__autoNektomeSafetyWrapped) {
        try {
          const originalReplaceTrack = senderPrototype.replaceTrack;
          const wrappedReplaceTrack = function(track) {
            registerTrack(track);
            return Reflect.apply(originalReplaceTrack, this, [track]);
          };
          Object.defineProperty(wrappedReplaceTrack, '__autoNektomeSafetyWrapped', { value: true });
          senderPrototype.replaceTrack = wrappedReplaceTrack;
        } catch (error) {}
      }

      const mediaStreamPrototype = window.MediaStream?.prototype;
      if (mediaStreamPrototype?.addTrack && !mediaStreamPrototype.addTrack.__autoNektomeSafetyWrapped) {
        try {
          const originalStreamAddTrack = mediaStreamPrototype.addTrack;
          const wrappedStreamAddTrack = function(track) {
            registerTrack(track);
            return Reflect.apply(originalStreamAddTrack, this, [track]);
          };
          Object.defineProperty(wrappedStreamAddTrack, '__autoNektomeSafetyWrapped', { value: true });
          mediaStreamPrototype.addTrack = wrappedStreamAddTrack;
        } catch (error) {}
      }

      const trackPrototype = window.MediaStreamTrack?.prototype;
      if (trackPrototype?.clone && !trackPrototype.clone.__autoNektomeSafetyWrapped) {
        try {
          const originalClone = trackPrototype.clone;
          const wrappedClone = function() {
            const clonedTrack = Reflect.apply(originalClone, this, []);
            registerTrack(clonedTrack);
            return clonedTrack;
          };
          Object.defineProperty(wrappedClone, '__autoNektomeSafetyWrapped', { value: true });
          trackPrototype.clone = wrappedClone;
        } catch (error) {}
      }

      enforceMutedState();
      return true;
    };

    return {
      install,
      registerTrack,
      registerStream,
      registerPeerConnection,
      setMuted,
      isMuted: () => muted,
      getLiveTrackCount: () => Array.from(audioTracks).filter(track => track.readyState !== 'ended').length
    };
  })();

  // При прямом открытии или перезагрузке уже активного маршрута ставим защиту
  // до того, как сайт успеет создать исходящий микрофонный sender.
  if (/#\/(?:peer|searching)(?:$|[/?])/i.test(location.hash || '')) {
    __autoNektomeMediaSafety.install();
  }

  const __autoNektomeLateBoot = () => {

    'use strict';

    __autoNektomeMediaSafety.install();

    const SCRIPT_VERSION = '5.1.0';

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

    // Встроенная базовая палитра используется сразу, пока полный CSS темы
    // загружается из репозитория. Благодаря этому смена темы остаётся заметной
    // даже при блокировке cross-origin fetch политикой сайта или расширением.
    const SITE_THEME_FALLBACKS = {
        'GitHub Dark': { bg: '#0d1117', bg2: '#010409', surface: '#161b22', surface2: '#21262d', text: '#c9d1d9', muted: '#8b949e' },
        'GitHub Dark High Contrast': { bg: '#010409', bg2: '#060a11', surface: '#0d1117', surface2: '#161b22', text: '#f0f6fc', muted: '#8b949e' },
        'Catppuccin Mocha': { bg: '#11111b', bg2: '#181825', surface: '#1e1e2e', surface2: '#313244', text: '#cdd6f4', muted: '#a6adc8' },
        'Ayu Dark': { bg: '#0b0e14', bg2: '#0f131a', surface: '#151a23', surface2: '#1f2430', text: '#bfbdb6', muted: '#7a818e' },
        'Gotham': { bg: '#0c1014', bg2: '#10181d', surface: '#13232a', surface2: '#17343b', text: '#98d1ce', muted: '#5f8787' },
        'Rose Pine Moon': { bg: '#191724', bg2: '#1f1d2e', surface: '#26233a', surface2: '#393552', text: '#e0def4', muted: '#908caa' },
        'Gruvbox Dark': { bg: '#1d2021', bg2: '#282828', surface: '#32302f', surface2: '#3c3836', text: '#ebdbb2', muted: '#a89984' },
        'Dracula': { bg: '#282a36', bg2: '#21222c', surface: '#343746', surface2: '#44475a', text: '#f8f8f2', muted: '#b9bac4' },
        'One Dark': { bg: '#282c34', bg2: '#21252b', surface: '#2c313c', surface2: '#353b45', text: '#abb2bf', muted: '#7f848e' },
        'Monokai': { bg: '#272822', bg2: '#1e1f1c', surface: '#33342d', surface2: '#3e3d32', text: '#f8f8f2', muted: '#a8a897' },
        'Nord': { bg: '#2e3440', bg2: '#242933', surface: '#3b4252', surface2: '#434c5e', text: '#eceff4', muted: '#d8dee9' }
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
        notificationSounds: loadSetting('notificationSounds', true),
        autoConfirmDisconnect: loadSetting('autoConfirmDisconnect', false),
        disconnectProtection: loadSetting('disconnectProtection', true),
        siteVolume: loadSetting('siteVolume', 50, parseFloat),
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
        panelTheme: loadSetting('panelTheme', 'dark'),
        panelCollapsed: loadSetting('panelCollapsed', false),
        panelMiniMode: loadSetting('panelMiniMode', false),
        panelPosition: loadSetting('panelPosition', { top: 12, left: Math.max(8, window.innerWidth - 320) }),
        panelSize: loadSetting('panelSize', { width: 300, height: 0 })
    };

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
    let selfListeningSource = null;
    let selfListeningStream = null;
    let selfListeningRequestId = 0;
    let micStream = null;
    let recognition = null;
    let voiceHintElement = null;
    let remoteAudioContext = null;
    let volumeAnalyser = null;
    let volumeCheckIntervalId = null;
    let lastLoudTime = 0;
    let volumeHistory = [];
    let lastAdjustedVolume = TARGET_VOLUME;
    let conversationTimer = null;
    let currentConversationStart = null;
    let isConversationActive = false;
    let isMicMuted = false;
    let isHeadphonesMuted = false;
    let currentThemeLink = null;
    let currentThemeFallbackStyle = null;
    let currentThemeExternalLink = null;
    let currentThemeRequestId = 0;
    let githubParticlesCanvas = null;
    let githubParticlesAnimationId = null;
    let micTestState = null;
    let micTestMonitorState = null;
    let micTestMonitorRequestId = 0;
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
    let conversationStartCandidateAt = 0;
    let conversationEndCandidateAt = 0;
    let lastConversationSignalAt = 0;
    let lastObservedSiteTimerSeconds = 0;
    let activeConversationIdentity = '';
    let backgroundWorker = null;
    let backgroundFallbackTimer = null;
    let queuedDisconnect = null;
    let pendingAutoConfirmUntil = 0;
    let pendingDisconnectSource = '';
    let pendingDisconnectGuardRegistered = false;
    let pendingDisconnectIntentUntil = 0;
    let pendingDisconnectIntentSource = '';
    let seamlessTransitionUntil = 0;

    const CONVERSATION_START_STABLE_MS = 300;
    const CONVERSATION_END_GRACE_MS = 1200;
    const CONVERSATION_SIGNAL_LOSS_GRACE_MS = 5000;

    // Простая защита от быстрых скипов:
    // два разговора короче пяти секунд можно завершить сразу в течение минуты;
    // на третьем нужно лишь дождаться пяти секунд текущего разговора.
    const MIN_FAST_DIALOG_DURATION_MS = 5000;
    const FAST_DISCONNECT_WINDOW_MS = 60000;
    const MAX_FREE_FAST_DISCONNECTS = 2;
    const DISCONNECT_HISTORY_KEY = 'AutoNektome_fastDisconnectHistory_v51_simple';
    const LEGACY_DISCONNECT_HISTORY_KEY = 'AutoNektome_disconnectHistory_v51';
    const LEGACY_DISCONNECT_PAUSE_KEY = 'AutoNektome_disconnectPauseUntil_v51';
    let disconnectHistory = loadSessionNumberArray(DISCONNECT_HISTORY_KEY);
    let autoSearchPauseUntil = 0; // Оставлено для совместимости диагностики/UI; длинных пауз больше нет.
    try {
        sessionStorage.removeItem(LEGACY_DISCONNECT_HISTORY_KEY);
        sessionStorage.removeItem(LEGACY_DISCONNECT_PAUSE_KEY);
    } catch (error) {}

    // ### Утилиты
    const endConversationAudio = new Audio(END_CONVERSATION_SOUND_URL);
    endConversationAudio.volume = END_SOUND_VOLUME;
    const startConversationAudio = new Audio(START_CONVERSATION_SOUND_URL);
    startConversationAudio.volume = START_SOUND_VOLUME;

  // AutoNektome safe-core compatibility patch v3: штатное аудио NektoMe не изменяется.
  // Не вызываем pause(), не очищаем src, не ставим muted и не патчим play().



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

    function loadSessionNumber(key, fallback = 0) {
        const value = Number(sessionStorage.getItem(key));
        return Number.isFinite(value) ? value : fallback;
    }

    function loadSessionNumberArray(key) {
        try {
            const value = JSON.parse(sessionStorage.getItem(key) || '[]');
            return Array.isArray(value) ? value.map(Number).filter(Number.isFinite) : [];
        } catch (error) {
            return [];
        }
    }

    function saveDisconnectGuardState() {
        try {
            sessionStorage.setItem(DISCONNECT_HISTORY_KEY, JSON.stringify(disconnectHistory));
            sessionStorage.removeItem(LEGACY_DISCONNECT_HISTORY_KEY);
            sessionStorage.removeItem(LEGACY_DISCONNECT_PAUSE_KEY);
        } catch (error) {}
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
                        hasRemoteAudioContext: !!remoteAudioContext,
                        remoteAudioContextState: remoteAudioContext?.state || null,
                        currentAutoVolumeStreamActive: !!currentAutoVolumeStream?.active,
                        hasVolumeInterval: !!volumeCheckIntervalId,
                        lastAutoClickAt,
                        lastAutoClickSignature,
                        pendingDomMaintenance,
                        domMutationBurstCount,
                        autoSearchPauseUntil,
                        disconnectsInWindow: disconnectHistory.length,
                        queuedDisconnectDueAt: queuedDisconnect?.dueAt || null,
                        pendingAutoConfirmUntil,
                        backgroundWorkerActive: !!backgroundWorker
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

    function formatCurrentDuration(totalSeconds) {
        const seconds = Math.max(0, Math.floor(Number(totalSeconds) || 0));
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        if (hours > 0) return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }

    function formatTotalDuration(totalSeconds) {
        const seconds = Math.max(0, Math.floor(Number(totalSeconds) || 0));
        const totalHours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;

        // До часа показываем MM:SS — например, накопленные 10 минут и 5 секунд = 10:05.
        if (totalHours === 0) {
            return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        }

        // После часа добавляем часы, не теряя секунд активного разговора.
        if (totalHours < 24) {
            return `${String(totalHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        }

        // Для очень больших значений используем компактный формат с днями.
        const days = Math.floor(totalHours / 24);
        const hours = totalHours % 24;
        return `${days} д. ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }

    function setStatValue(element, text) {
        if (!element) return;
        const value = String(text);
        element.textContent = value;
        element.title = value;
        element.dataset.characters = String(value.length);
        const base = element.classList.contains('an-mini-stat-value') ? 12 : 14;
        const shrinkAfter = element.classList.contains('an-mini-stat-value') ? 7 : 8;
        const fontSize = Math.max(8, base - Math.max(0, value.length - shrinkAfter) * 0.55);
        element.style.fontSize = `${fontSize}px`;
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
        // Disabled: canvas changes the page fingerprint during NektoMe checks.
        stopGitHubDarkParticles();
    }

    function syncSiteThemeEffects() {
        stopGitHubDarkParticles();
    }

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    let nativeGetUserMedia = null;

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
        [micStream, globalStream, selfListeningStream]
            .filter(Boolean)
            .forEach(stream => __autoNektomeMediaSafety.registerStream(stream));
        __autoNektomeMediaSafety.setMuted(isMicMuted);
        diag('info', 'microphone.muteStateApplied', {
            muted: isMicMuted,
            trackedAudioTracks: __autoNektomeMediaSafety.getLiveTrackCount()
        }, { throttleMs: 500 });
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
    function getThemeCacheKey(themeName) {
        return `autonektomeThemeCss:${String(themeName || '').replace(/\s+/g, '-').toLowerCase()}`;
    }

    function removeActiveThemeNodes() {
        currentThemeRequestId++;
        [currentThemeLink, currentThemeFallbackStyle, currentThemeExternalLink].forEach(node => {
            try { node?.remove?.(); } catch (error) {}
        });
        document.querySelectorAll('#custom-theme-style, #custom-theme-fallback-style, #custom-theme-link').forEach(node => node.remove());
        currentThemeLink = null;
        currentThemeFallbackStyle = null;
        currentThemeExternalLink = null;
    }

    function buildThemeFallbackCss(themeName) {
        const fallback = SITE_THEME_FALLBACKS[themeName];
        const palette = getSiteThemePalette(themeName);
        if (!fallback || themeName === 'Original') return '';

        return `
            :root {
                --an-site-bg: ${fallback.bg};
                --an-site-bg-2: ${fallback.bg2};
                --an-site-surface: ${fallback.surface};
                --an-site-surface-2: ${fallback.surface2};
                --an-site-text: ${fallback.text};
                --an-site-muted: ${fallback.muted};
                --an-site-accent: ${palette.primaryLight};
                --an-site-accent-2: ${palette.accent};
            }
            html, body, body.night_theme {
                min-height: 100% !important;
                background:
                    radial-gradient(circle at 18% 4%, color-mix(in srgb, var(--an-site-accent) 15%, transparent), transparent 34%),
                    radial-gradient(circle at 82% 0%, color-mix(in srgb, var(--an-site-accent-2) 11%, transparent), transparent 30%),
                    linear-gradient(180deg, var(--an-site-bg) 0%, var(--an-site-bg-2) 52%, var(--an-site-bg) 100%) !important;
                color: var(--an-site-text) !important;
            }
            body.autonektome-site-themed .wraps,
            body.autonektome-site-themed .chat_container,
            body.autonektome-site-themed .outer-container,
            body.autonektome-site-themed #audio-chat-container,
            body.autonektome-site-themed .audio-chat,
            body.autonektome-site-themed .chat-step,
            body.autonektome-site-themed .centerToSearchBlock {
                background: transparent !important;
                color: var(--an-site-text) !important;
            }
            body.autonektome-site-themed .audio-chat .main-panel,
            body.autonektome-site-themed .audio-chat .window_chat_statuss,
            body.autonektome-site-themed .audio-chat .opened-label,
            body.autonektome-site-themed .audio-chat .need-update-label,
            body.autonektome-site-themed .swal2-popup {
                background: linear-gradient(180deg, color-mix(in srgb, var(--an-site-surface) 96%, transparent), color-mix(in srgb, var(--an-site-surface-2) 92%, transparent)) !important;
                border-color: color-mix(in srgb, var(--an-site-accent) 28%, rgba(255,255,255,.10)) !important;
                color: var(--an-site-text) !important;
            }
            body.autonektome-site-themed .audio-chat button,
            body.autonektome-site-themed .audio-chat .btn,
            body.autonektome-site-themed .audio-chat input,
            body.autonektome-site-themed .audio-chat select,
            body.autonektome-site-themed .audio-chat textarea {
                background-color: color-mix(in srgb, var(--an-site-surface-2) 90%, transparent) !important;
                border-color: color-mix(in srgb, var(--an-site-accent) 30%, rgba(255,255,255,.12)) !important;
                color: var(--an-site-text) !important;
            }
            body.autonektome-site-themed .audio-chat a,
            body.autonektome-site-themed .audio-chat .talking-count,
            body.autonektome-site-themed .audio-chat h1,
            body.autonektome-site-themed .audio-chat .title {
                color: var(--an-site-accent) !important;
            }
        `;
    }

    function installThemeCss(css, requestId, source = 'remote') {
        if (!css || requestId !== currentThemeRequestId) return false;
        const styleElement = document.createElement('style');
        styleElement.id = 'custom-theme-style';
        styleElement.dataset.source = source;
        styleElement.textContent = css;
        (document.head || document.documentElement).appendChild(styleElement);

        currentThemeLink?.remove?.();
        currentThemeLink = styleElement;
        currentThemeExternalLink?.remove?.();
        currentThemeExternalLink = null;
        return true;
    }

    function applyTheme(themeName) {
        const safeThemeName = Object.prototype.hasOwnProperty.call(THEMES, themeName) ? themeName : 'Original';
        diag('info', 'theme.apply', { themeName: safeThemeName }, { throttleMs: 500 });
        settings.selectedTheme = safeThemeName;
        saveSetting('selectedTheme', safeThemeName);

        removeActiveThemeNodes();
        const requestId = currentThemeRequestId;
        applySiteChromePolish();

        const loadingIndicator = document.querySelector('#site-theme-loading');
        if (loadingIndicator) loadingIndicator.style.display = safeThemeName === 'Original' ? 'none' : 'block';

        if (safeThemeName !== 'Original' && THEMES[safeThemeName]) {
            // Мгновенный встроенный слой: тема видна сразу и не зависит от сети.
            const fallbackCss = buildThemeFallbackCss(safeThemeName);
            if (fallbackCss) {
                currentThemeFallbackStyle = document.createElement('style');
                currentThemeFallbackStyle.id = 'custom-theme-fallback-style';
                currentThemeFallbackStyle.textContent = fallbackCss;
                (document.head || document.documentElement).appendChild(currentThemeFallbackStyle);
            }

            // Сначала используем последнюю успешно загруженную копию полного CSS.
            try {
                const cachedCss = localStorage.getItem(getThemeCacheKey(safeThemeName));
                if (cachedCss) installThemeCss(cachedCss, requestId, 'cache');
            } catch (error) {
                diag('warn', 'theme.cache.read.error', { themeName: safeThemeName, message: error?.message || String(error) });
            }

            // Параллельно подключаем обычный stylesheet. Это работает в окружениях,
            // где fetch блокируется CSP, но загрузка стилей разрешена.
            const externalLink = document.createElement('link');
            externalLink.id = 'custom-theme-link';
            externalLink.rel = 'stylesheet';
            externalLink.href = `${THEMES[safeThemeName]}?anv=${encodeURIComponent(SCRIPT_VERSION)}`;
            externalLink.crossOrigin = 'anonymous';
            externalLink.onload = () => {
                if (requestId !== currentThemeRequestId) return;
                if (loadingIndicator) loadingIndicator.style.display = 'none';
                diag('info', 'theme.link.loaded', { themeName: safeThemeName });
            };
            externalLink.onerror = () => {
                if (requestId !== currentThemeRequestId) return;
                diag('warn', 'theme.link.error', { themeName: safeThemeName });
            };
            (document.head || document.documentElement).appendChild(externalLink);
            currentThemeExternalLink = externalLink;

            // Fetch нужен для кеша и для встраивания CSS, когда external stylesheet
            // режется политикой style-src. Ошибка не отменяет встроенную тему.
            const controller = typeof AbortController === 'function' ? new AbortController() : null;
            const timeoutId = setTimeout(() => controller?.abort?.(), 9000);
            fetch(THEMES[safeThemeName], {
                cache: 'no-store',
                credentials: 'omit',
                mode: 'cors',
                signal: controller?.signal
            })
                .then(response => {
                    if (!response.ok) throw new Error(`HTTP ${response.status}`);
                    return response.text();
                })
                .then(css => {
                    if (requestId !== currentThemeRequestId) return;
                    if (!css || css.length < 80) throw new Error('Получен пустой CSS темы');
                    installThemeCss(css, requestId, 'network');
                    try { localStorage.setItem(getThemeCacheKey(safeThemeName), css); } catch (error) {}
                    if (loadingIndicator) loadingIndicator.style.display = 'none';
                    diag('info', 'theme.fetch.loaded', { themeName: safeThemeName, bytes: css.length });
                })
                .catch(error => {
                    if (requestId !== currentThemeRequestId) return;
                    diag('warn', 'theme.fetch.error', { themeName: safeThemeName, message: error?.message || String(error) });
                    // Встроенный fallback уже применён, поэтому не сбрасываем оформление.
                    if (loadingIndicator) loadingIndicator.style.display = 'none';
                })
                .finally(() => clearTimeout(timeoutId));
        } else {
            document.body?.classList.remove('autonektome-site-themed');
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

    function showRuntimeToast(message, duration = 3500) {
        let toast = document.getElementById('autonektome-runtime-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'autonektome-runtime-toast';
            toast.className = 'autonektome-runtime-toast';
            document.body?.appendChild(toast);
        }
        toast.textContent = message;
        const token = String(Date.now());
        toast.dataset.token = token;
        setTimeout(() => {
            if (toast?.dataset.token === token) toast.remove();
        }, duration);
    }

    function pruneDisconnectHistory(now = Date.now()) {
        const previousLength = disconnectHistory.length;
        disconnectHistory = disconnectHistory.filter(timestamp => now - timestamp < FAST_DISCONNECT_WINDOW_MS);
        autoSearchPauseUntil = 0;
        if (previousLength !== disconnectHistory.length) saveDisconnectGuardState();
    }

    function getCurrentConversationAgeMs(now = Date.now()) {
        if (currentConversationStart) {
            return Math.max(0, now - currentConversationStart);
        }

        const timerElement = document.querySelector('.callScreen__time, .timer-label');
        const siteTimerSeconds = timerElement ? parseDisplayedDuration(timerElement.textContent) : 0;
        if (siteTimerSeconds > 0) return siteTimerSeconds * 1000;
        if (conversationStartCandidateAt) return Math.max(0, now - conversationStartCandidateAt);

        // Кнопка завершения уже существует, но жизненный цикл ещё мог не успеть
        // стабилизироваться. Считаем такой разговор только что начавшимся.
        return getDisconnectButton(document) ? 0 : Number.POSITIVE_INFINITY;
    }

    function getDisconnectProtectionDelay(now = Date.now()) {
        if (!settings.disconnectProtection) return 0;
        pruneDisconnectHistory(now);

        // Первые два подтверждённых быстрых скипа в минутном окне разрешены.
        if (disconnectHistory.length < MAX_FREE_FAST_DISCONNECTS) return 0;

        const conversationAge = getCurrentConversationAgeMs(now);
        if (!Number.isFinite(conversationAge) || conversationAge >= MIN_FAST_DIALOG_DURATION_MS) return 0;
        return Math.max(0, MIN_FAST_DIALOG_DURATION_MS - conversationAge);
    }

    function registerProtectedDisconnect(source = 'unknown', now = Date.now()) {
        if (!settings.disconnectProtection) return false;
        pruneDisconnectHistory(now);

        // В историю попадает только фактически подтверждённое завершение
        // разговора короче пяти секунд. Открытие/закрытие модального окна не считается.
        const conversationAge = getCurrentConversationAgeMs(now);
        if (!Number.isFinite(conversationAge) || conversationAge >= MIN_FAST_DIALOG_DURATION_MS) {
            diag('debug', 'disconnectGuard.notFast', { source, conversationAge });
            return false;
        }

        const lastDisconnectAt = disconnectHistory.length ? disconnectHistory[disconnectHistory.length - 1] : 0;
        if (lastDisconnectAt && now - lastDisconnectAt < 750) {
            diag('debug', 'disconnectGuard.skipDuplicate', { source, agoMs: now - lastDisconnectAt }, { throttleMs: 500 });
            return true;
        }

        disconnectHistory.push(now);
        saveDisconnectGuardState();
        diag('info', 'disconnectGuard.fastRegistered', {
            source,
            conversationAge,
            countInWindow: disconnectHistory.length
        });
        return true;
    }

    function isAutoSearchSafetyPaused() {
        // Длинные защитные паузы удалены. Автопоиск никогда не блокируется
        // на десятки секунд: ограничение действует только до пятой секунды
        // конкретного текущего разговора.
        autoSearchPauseUntil = 0;
        return false;
    }

    function markDisconnectIntent(source = 'unknown', durationMs = 12000) {
        pendingDisconnectIntentSource = source;
        pendingDisconnectIntentUntil = Date.now() + durationMs;
    }

    function clearDisconnectIntent() {
        pendingDisconnectIntentSource = '';
        pendingDisconnectIntentUntil = 0;
    }

    function getDisconnectButton(target = document) {
        if (target instanceof Element) {
            return target.closest('button.callScreen__cancelCallBtn.btn.danger2.cancelCallBtnNoMess, button.btn.btn-lg.stop-talk-button, button.stop-talk-button');
        }
        return document.querySelector('button.callScreen__cancelCallBtn.btn.danger2.cancelCallBtnNoMess, button.btn.btn-lg.stop-talk-button, button.stop-talk-button');
    }

    function findDisconnectConfirmButton() {
        const candidates = Array.from(document.querySelectorAll('button.swal2-confirm.swal2-styled, button.swal2-confirm'));
        return candidates.find(button => {
            const text = normalizeSpeechText(button.textContent || '');
            return !button.disabled && (!text || text === 'да' || text.includes('подтверд') || text.includes('заверш'));
        }) || candidates.find(button => !button.disabled) || null;
    }

    function beginAutoConfirmWindow(source = 'unknown', guardRegistered = false) {
        pendingDisconnectSource = source;
        pendingDisconnectGuardRegistered = !!guardRegistered;
        pendingAutoConfirmUntil = Date.now() + 3500;
        markDisconnectIntent(source);
        document.body?.classList.add('autonektome-auto-confirm-pending');
        confirmDisconnectIfNeeded(`begin:${source}`);
    }

    function beginSeamlessTransition() {
        seamlessTransitionUntil = Date.now() + 4000;
        document.body?.classList.add('autonektome-seamless-transition');
    }

    function endSeamlessTransition() {
        seamlessTransitionUntil = 0;
        document.body?.classList.remove('autonektome-seamless-transition');
    }

    function confirmDisconnectIfNeeded(reason = 'maintenance') {
        if (!pendingAutoConfirmUntil) return false;
        const now = Date.now();
        if (now > pendingAutoConfirmUntil) {
            pendingAutoConfirmUntil = 0;
            pendingDisconnectSource = '';
            pendingDisconnectGuardRegistered = false;
            clearDisconnectIntent();
            document.body?.classList.remove('autonektome-auto-confirm-pending');
            return false;
        }

        const confirmButton = findDisconnectConfirmButton();
        if (!confirmButton) return false;

        const source = pendingDisconnectSource || pendingDisconnectIntentSource || 'unknown';
        pendingAutoConfirmUntil = 0;
        pendingDisconnectSource = '';
        pendingDisconnectGuardRegistered = false;
        if (isAutoModeEnabled) beginSeamlessTransition();

        // История быстрого скипа регистрируется capture-обработчиком самого
        // подтверждения. Поэтому отменённое окно никогда не расходует лимит.
        confirmButton.click();
        clearDisconnectIntent();
        setTimeout(() => document.body?.classList.remove('autonektome-auto-confirm-pending'), 400);
        diag('info', 'disconnect.autoConfirmed', { reason, source });
        return true;
    }

    function resolveQueuedDisconnectButton(queued) {
        if (queued?.button?.isConnected && isButtonUsable(queued.button)) return queued.button;
        const currentButton = getDisconnectButton(document);
        return currentButton && isButtonUsable(currentButton) ? currentButton : null;
    }

    function executeProtectedDisconnect(button, source = 'automatic', autoConfirm = true, reason = 'immediate') {
        const liveButton = button?.isConnected && isButtonUsable(button) ? button : getDisconnectButton(document);
        if (!liveButton || !isButtonUsable(liveButton)) {
            diag('warn', 'disconnect.execute.noButton', { source, reason }, { throttleMs: 1000 });
            return false;
        }

        liveButton.dataset.autonektomeDisconnectBypass = 'true';
        markDisconnectIntent(source);
        if (autoConfirm) beginAutoConfirmWindow(source, false);
        liveButton.click();
        diag('info', 'disconnect.executed', { source, reason, autoConfirm });
        return true;
    }

    function queueProtectedDisconnect(button, source = 'automatic') {
        if (!button || !isButtonUsable(button)) return false;

        const now = Date.now();
        if (queuedDisconnect && now < queuedDisconnect.dueAt) {
            const remaining = Math.max(1, Math.ceil((queuedDisconnect.dueAt - now) / 1000));
            showRuntimeToast(`Быстрый скип: можно завершить через ${remaining} с`, Math.min(5000, queuedDisconnect.dueAt - now + 500));
            return true;
        }

        const delay = getDisconnectProtectionDelay(now);
        if (delay > 0) {
            // Очередь нужна только голосовой/автоматической команде. Ручной клик
            // не запоминается: пользователь просто нажимает ещё раз после 5 секунд.
            queuedDisconnect = {
                button,
                source,
                autoConfirm: true,
                dueAt: now + delay,
                expiresAt: now + delay + 5000
            };
            showRuntimeToast(`Быстрый скип: можно завершить через ${Math.max(1, Math.ceil(delay / 1000))} с`, Math.min(5000, delay + 500));
            diag('warn', 'disconnect.delayedUntilFiveSeconds', { source, delay });
            return true;
        }

        queuedDisconnect = null;
        return executeProtectedDisconnect(button, source, true, 'queue-immediate');
    }

    function flushQueuedDisconnect(reason = 'background') {
        if (!queuedDisconnect) return false;

        const now = Date.now();
        if (now < queuedDisconnect.dueAt) return false;

        const queued = queuedDisconnect;
        const button = resolveQueuedDisconnectButton(queued);
        if (!button) {
            if (now < queued.expiresAt) return false;
            queuedDisconnect = null;
            diag('warn', 'disconnect.queueExpired', { reason, source: queued.source });
            return false;
        }

        queuedDisconnect = null;
        return executeProtectedDisconnect(button, queued.source, queued.autoConfirm, `queued:${reason}`);
    }

    function handleDisconnectClickCapture(event) {
        const clickedButton = event.target?.closest?.('button');
        const now = Date.now();

        // Регистрируем только реальное подтверждение завершения. Если пользователь
        // открыл окно и нажал «Нет»/закрыл его, история быстрых скипов не меняется.
        if (clickedButton?.matches?.('button.swal2-confirm.swal2-styled, button.swal2-confirm')) {
            if (pendingDisconnectIntentUntil > now) {
                registerProtectedDisconnect(pendingDisconnectIntentSource || 'confirmed', now);
                clearDisconnectIntent();
            }
            return;
        }

        if (clickedButton?.matches?.('button.swal2-cancel, button.swal2-close, .swal2-cancel, .swal2-close')) {
            clearDisconnectIntent();
            pendingAutoConfirmUntil = 0;
            pendingDisconnectSource = '';
            pendingDisconnectGuardRegistered = false;
            document.body?.classList.remove('autonektome-auto-confirm-pending');
            return;
        }

        const button = getDisconnectButton(event.target);
        if (!button) return;

        if (button.dataset.autonektomeDisconnectBypass === 'true') {
            delete button.dataset.autonektomeDisconnectBypass;
            return;
        }

        const delay = getDisconnectProtectionDelay(now);
        if (settings.disconnectProtection && delay > 0) {
            event.preventDefault();
            event.stopImmediatePropagation();
            queuedDisconnect = null;
            clearDisconnectIntent();
            const remaining = Math.max(1, Math.ceil(delay / 1000));
            showRuntimeToast(`Быстрый скип: подождите ${remaining} с`, Math.min(5000, delay + 500));
            diag('warn', 'disconnect.manualBlockedUntilFiveSeconds', {
                delay,
                conversationAge: getCurrentConversationAgeMs(now),
                fastDisconnectsInWindow: disconnectHistory.length
            });
            return;
        }

        // Само открытие окна ничего не записывает. Намерение живёт лишь до
        // подтверждения и безопасно исчезает после отмены/таймаута.
        markDisconnectIntent('one-click');
        if (settings.autoConfirmDisconnect) {
            beginAutoConfirmWindow('one-click', false);
        }
    }

    function checkAndClickButton(reason = 'manual') {
        if (!isAutoModeEnabled) {
            endSeamlessTransition();
            diag('debug', 'autoClick.skip.disabled', { reason }, { throttleMs: 1500 });
            return;
        }

        if (isAutoSearchSafetyPaused()) {
            endSeamlessTransition();
            diag('debug', 'autoClick.skip.safetyPause', { reason, pauseUntil: autoSearchPauseUntil }, { throttleMs: 1500 });
            return;
        }

        const finishedScreen = getFinishedSearchContainer();
        if (!finishedScreen) {
            if (seamlessTransitionUntil && (/#\/searching(?:$|[/?])/i.test(location.hash || '') || /#\/peer(?:$|[/?])/i.test(location.hash || ''))) {
                endSeamlessTransition();
            }
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
        const stopButton = getDisconnectButton(document);
        if (stopButton) queueProtectedDisconnect(stopButton, 'automatic-skip');
    }

    function playNotificationOnEnd() {
        if (isConversationActive) {
            if (settings.notificationSounds) endConversationAudio.play().catch(e => {});
            isConversationActive = false;
            updateCurrentStatusUI();
        }
    }

    function playNotificationOnStart() {
        if (!isConversationActive) {
            if (settings.notificationSounds) {
                startConversationAudio.dataset.custom = 'true';
                startConversationAudio.play().catch(e => {});
            }
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
        if (!isAutoModeEnabled) {
            if (queuedDisconnect?.source === 'automatic-skip') queuedDisconnect = null;
            endSeamlessTransition();
        }
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

    async function getMicStream(options = {}) {
        try {
            micStream = await requestRawMicStream({ audio: true });
            globalStream = micStream;
            syncMicMuteState();
            if (settings.enableLoopback && !options.skipLoopback) {
                await enableSelfListening(globalStream);
            }
            return micStream;
        } catch (e) {
            console.error('Ошибка получения микрофона:', e);
            return null;
        }
    }

    function hasLiveAudioTrack(stream) {
        return !!stream?.getAudioTracks?.().some(track => track.readyState !== 'ended');
    }

    function unlockAudioContext(context, reason = 'unknown') {
        if (!context || context.state === 'closed') return Promise.resolve(false);

        // Создаём короткий бесшумный источник прямо во время пользовательского клика.
        // Это сохраняет право браузера на воспроизведение, даже если затем нужно
        // дождаться асинхронного разрешения getUserMedia.
        try {
            const buffer = context.createBuffer(1, 1, context.sampleRate || 44100);
            const source = context.createBufferSource();
            source.buffer = buffer;
            source.connect(context.destination);
            source.start(0);
            source.addEventListener?.('ended', () => {
                try { source.disconnect(); } catch (error) {}
            }, { once: true });
        } catch (error) {}

        if (context.state !== 'suspended') return Promise.resolve(context.state === 'running');
        return context.resume()
            .then(() => context.state === 'running')
            .catch(error => {
                diag('warn', 'selfListening.context.resumeFailed', {
                    reason,
                    state: context.state,
                    message: error?.message || String(error)
                });
                return false;
            });
    }

    function createSelfListeningAudioContext(preferredStream = null) {
        if (!AudioContextClass) return null;
        const sampleRate = Number(preferredStream?.getAudioTracks?.()[0]?.getSettings?.().sampleRate);
        const options = { latencyHint: 'interactive' };
        if (Number.isFinite(sampleRate) && sampleRate >= 8000) options.sampleRate = sampleRate;
        try {
            return new AudioContextClass(options);
        } catch (error) {
            try { return new AudioContextClass({ latencyHint: 'interactive' }); } catch (fallbackError) {}
            return new AudioContextClass();
        }
    }

    function prepareSelfListeningContext(preferredStream = null) {
        if (!AudioContextClass) return null;
        if (!audioContext || audioContext.state === 'closed') {
            audioContext = createSelfListeningAudioContext(preferredStream);
        }
        void unlockAudioContext(audioContext, 'user-gesture');
        return audioContext;
    }

    async function requestSelfListeningStream(preferredStream = null) {
        const getter = nativeGetUserMedia || navigator.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices);
        if (!getter) throw new Error('navigator.mediaDevices.getUserMedia недоступен');

        const preferredTrack = preferredStream?.getAudioTracks?.()[0] || null;
        const deviceId = preferredTrack?.getSettings?.().deviceId || '';
        const directMonitorConstraints = {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
            channelCount: { ideal: 1 },
            latency: { ideal: 0.01 }
        };
        if (deviceId) directMonitorConstraints.deviceId = { exact: deviceId };

        try {
            return await getter({ audio: directMonitorConstraints });
        } catch (error) {
            if (!deviceId) throw error;
            delete directMonitorConstraints.deviceId;
            return getter({ audio: directMonitorConstraints });
        }
    }

    async function waitForSelfListeningTrack(stream, timeoutMs = 650) {
        const track = stream?.getAudioTracks?.()[0];
        if (!track || track.readyState === 'ended') return false;

        if (track.muted) {
            await Promise.race([
                new Promise(resolve => track.addEventListener?.('unmute', resolve, { once: true })),
                new Promise(resolve => setTimeout(resolve, timeoutMs))
            ]);
        }

        // Короткий прогрев предотвращает прерывистый первый запуск некоторых
        // микрофонных драйверов, когда поток уже live, но ещё отдаёт рваные буферы.
        await new Promise(resolve => setTimeout(resolve, 180));
        return track.readyState !== 'ended';
    }

    function disconnectSelfListeningGraph() {
        try { selfListeningSource?.disconnect(); } catch (error) {}
        try { gainNode?.disconnect(); } catch (error) {}
        selfListeningSource = null;
        gainNode = null;
    }

    function stopSelfListening() {
        selfListeningRequestId++;
        disconnectSelfListeningGraph();
        if (selfListeningStream) {
            selfListeningStream.getTracks?.().forEach(track => track.stop());
            selfListeningStream = null;
        }
        if (audioContext) {
            audioContext.close().catch(() => {});
            audioContext = null;
        }
    }

    async function enableSelfListening(preferredStream = null, preparedContext = null) {
        if (!AudioContextClass) return false;

        const requestId = ++selfListeningRequestId;
        let context = preparedContext;
        if (!context || context.state === 'closed') context = prepareSelfListeningContext(preferredStream);
        if (!context) return false;

        if (audioContext && audioContext !== context) {
            try { await audioContext.close(); } catch (error) {}
        }
        audioContext = context;
        disconnectSelfListeningGraph();
        if (selfListeningStream) {
            selfListeningStream.getTracks?.().forEach(track => track.stop());
            selfListeningStream = null;
        }

        await unlockAudioContext(context, 'connect-microphone');
        if (requestId !== selfListeningRequestId || !settings.enableLoopback || context.state === 'closed') return false;

        let stream = null;
        try {
            stream = await requestSelfListeningStream(preferredStream);
            __autoNektomeMediaSafety.registerStream(stream);
            if (!await waitForSelfListeningTrack(stream)) throw new Error('Поток микрофона не готов');

            if (requestId !== selfListeningRequestId || !settings.enableLoopback || context.state === 'closed') {
                stream.getTracks?.().forEach(track => track.stop());
                return false;
            }

            selfListeningSource = context.createMediaStreamSource(stream);
            gainNode = context.createGain();
            gainNode.gain.value = Math.max(0, Number(settings.gainValue) || 1);

            selfListeningSource.connect(gainNode);
            gainNode.connect(context.destination);
            const running = await unlockAudioContext(context, 'graph-connected');
            if (requestId !== selfListeningRequestId || !settings.enableLoopback) {
                disconnectSelfListeningGraph();
                stream.getTracks?.().forEach(track => track.stop());
                return false;
            }

            selfListeningStream = stream;
            syncMicMuteState();
            diag('info', 'selfListening.started', {
                contextState: context.state,
                running,
                gain: gainNode.gain.value,
                trackState: stream.getAudioTracks?.()[0]?.readyState || null,
                latencyHint: 'interactive'
            });
            return context.state === 'running';
        } catch (error) {
            stream?.getTracks?.().forEach(track => track.stop());
            disconnectSelfListeningGraph();
            diag('error', 'selfListening.startFailed', {
                message: error?.message || String(error),
                name: error?.name || null,
                contextState: context.state
            });
            return false;
        }
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

            const volumeSlider = document.querySelector('.volume_slider input.slider-input, #an-site-volume-slider');
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
    if (!settings.voiceControl) return;

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
            if (isVoiceControlEnabled && settings.voiceControl) {
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
        if (!isVoiceControlEnabled || !settings.voiceControl || !recognition) return;
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

    function parseDisplayedDuration(text) {
        const parts = String(text || '').trim().match(/\d+/g)?.map(Number) || [];
        if (!parts.length || parts.some(value => !Number.isFinite(value))) return 0;
        if (parts.length >= 3) return parts.slice(-3).reduce((total, value, index) => total + value * [3600, 60, 1][index], 0);
        if (parts.length === 2) return parts[0] * 60 + parts[1];
        return parts[0];
    }

    function getConversationSnapshot() {
        const finishedScreen = getFinishedSearchContainer();
        const timerElement = document.querySelector('.callScreen__time, .timer-label');
        const talkStopButton = document.querySelector('button.callScreen__cancelCallBtn.btn.danger2.cancelCallBtnNoMess, button.btn.btn-lg.stop-talk-button, button.stop-talk-button');
        const audio = document.querySelector('audio#audioStream');
        const remoteStream = audio?.srcObject || null;
        const remoteTracks = remoteStream?.getAudioTracks?.() || [];
        const activeRemoteTrack = remoteTracks.some(track => track.readyState === 'live' && track.enabled !== false);
        const remoteTrackIds = remoteTracks.map(track => String(track.id || '')).filter(Boolean).sort().join(',');
        const remoteStreamId = String(remoteStream?.id || '');
        const connectionIdentity = [remoteStreamId, remoteTrackIds].filter(Boolean).join('|');
        const peerRoute = /#\/peer(?:$|[/?])/i.test(location.hash || '');
        const searchingRoute = /#\/searching(?:$|[/?])/i.test(location.hash || '');
        const idleButton = document.querySelector('.chat-step.idle button#searchCompanyBtn, button#searchCompanyBtn');
        const siteTimerSeconds = timerElement ? parseDisplayedDuration(timerElement.textContent) : 0;
        const connected = !finishedScreen && !searchingRoute && (
            (!!timerElement && (peerRoute || !!talkStopButton || activeRemoteTrack)) ||
            (peerRoute && activeRemoteTrack)
        );
        const ended = !!finishedScreen || searchingRoute || (!peerRoute && !!idleButton && !timerElement);
        return {
            connected,
            ended,
            timerElement,
            siteTimerSeconds,
            talkStopButton,
            activeRemoteTrack,
            connectionIdentity,
            peerRoute,
            searchingRoute
        };
    }

    function startConversationTimer(startedAt = Date.now(), reason = 'signal', connectionIdentity = '') {
        if (currentConversationStart) return;
        currentConversationStart = Math.max(0, Number(startedAt) || Date.now());
        activeConversationIdentity = String(connectionIdentity || '');
        lastConversationSignalAt = Date.now();
        playNotificationOnStart();
        if (conversationTimer) clearInterval(conversationTimer);
        conversationTimer = setInterval(() => {
            updateStatsUI();
            updateCurrentStatusUI();
        }, 1000);
        diag('info', 'conversation.started', {
            reason,
            startedAt: currentConversationStart,
            connectionIdentity: activeConversationIdentity || null
        });
        updateStatsUI();
    }

    function stopConversationTimer(endedAt = Date.now(), reason = 'signal', durationOverrideSeconds = null) {
        if (!currentConversationStart) return;
        if (conversationTimer) clearInterval(conversationTimer);
        const safeEnd = Math.max(currentConversationStart, Number(endedAt) || Date.now());
        const measuredDuration = Math.max(0, Math.floor((safeEnd - currentConversationStart) / 1000));
        const overrideDuration = Number(durationOverrideSeconds);
        const hasDurationOverride = durationOverrideSeconds !== null &&
            typeof durationOverrideSeconds !== 'undefined' &&
            Number.isFinite(overrideDuration);
        const duration = hasDurationOverride
            ? Math.max(0, Math.floor(overrideDuration))
            : measuredDuration;
        updateConversationStats(duration);
        settings.totalConversationDuration = Math.max(0, (Number(settings.totalConversationDuration) || 0) + duration);
        saveSetting('totalConversationDuration', settings.totalConversationDuration);
        diag('info', 'conversation.stopped', {
            reason,
            duration,
            measuredDuration,
            durationOverridden: hasDurationOverride,
            connectionIdentity: activeConversationIdentity || null
        });
        conversationTimer = null;
        currentConversationStart = null;
        activeConversationIdentity = '';
        conversationStartCandidateAt = 0;
        conversationEndCandidateAt = 0;
        lastConversationSignalAt = 0;
        lastObservedSiteTimerSeconds = 0;
        playNotificationOnEnd();
        updateStatsUI();
        updateCurrentStatusUI();
    }

    function getBestCompletedConversationDuration(now = Date.now()) {
        if (lastObservedSiteTimerSeconds > 0) return lastObservedSiteTimerSeconds;
        if (!currentConversationStart) return 0;
        return Math.max(0, Math.floor((now - currentConversationStart) / 1000));
    }

    function syncConversationLifecycle(reason = 'maintenance') {
        const now = Date.now();
        const snapshot = getConversationSnapshot();

        if (snapshot.connected) {
            const identityChanged = !!(
                currentConversationStart &&
                activeConversationIdentity &&
                snapshot.connectionIdentity &&
                activeConversationIdentity !== snapshot.connectionIdentity
            );
            const timerRolledBack = !!(
                currentConversationStart &&
                lastObservedSiteTimerSeconds >= 2 &&
                snapshot.siteTimerSeconds <= 1 &&
                snapshot.siteTimerSeconds < lastObservedSiteTimerSeconds
            );

            // При очень быстром переходе Nekto.me может заменить собеседника без
            // заметного промежуточного экрана. Новый MediaStream/трек или сброс
            // штатного таймера означает, что предыдущий разговор нужно закрыть
            // и сразу начать новый, иначе оба диалога склеиваются в один.
            if (identityChanged || timerRolledBack) {
                const completedDuration = getBestCompletedConversationDuration(now);
                stopConversationTimer(now, `rollover:${reason}`, completedDuration);
            }

            lastConversationSignalAt = now;
            conversationEndCandidateAt = 0;
            conversationStartCandidateAt = 0;

            if (!currentConversationStart) {
                const siteBasedStart = now - Math.max(0, snapshot.siteTimerSeconds) * 1000;
                startConversationTimer(siteBasedStart, reason, snapshot.connectionIdentity);
            } else {
                if (!activeConversationIdentity && snapshot.connectionIdentity) {
                    activeConversationIdentity = snapshot.connectionIdentity;
                }

                // Штатный таймер Nekto.me является источником истины. Если
                // локальная точка старта ушла вперёд/назад из-за фоновой вкладки
                // или пропущенного DOM-перехода, мягко синхронизируем её.
                const localDuration = Math.max(0, Math.floor((now - currentConversationStart) / 1000));
                if (snapshot.timerElement && Math.abs(localDuration - snapshot.siteTimerSeconds) >= 2) {
                    currentConversationStart = now - Math.max(0, snapshot.siteTimerSeconds) * 1000;
                }
            }

            lastObservedSiteTimerSeconds = Math.max(0, snapshot.siteTimerSeconds);
            return snapshot;
        }

        conversationStartCandidateAt = 0;
        if (snapshot.timerElement) {
            lastObservedSiteTimerSeconds = Math.max(lastObservedSiteTimerSeconds, snapshot.siteTimerSeconds);
        }
        if (currentConversationStart) {
            if (snapshot.ended) {
                // Явный экран завершения/поиска фиксируем сразу. Это особенно
                // важно для быстрых скипов: ожидание grace-периода позволяло
                // следующему диалогу начаться раньше, чем учитывался предыдущий.
                stopConversationTimer(now, `explicit-end:${reason}`, getBestCompletedConversationDuration(now));
            } else {
                const signalExpired = lastConversationSignalAt && now - lastConversationSignalAt >= CONVERSATION_SIGNAL_LOSS_GRACE_MS;
                if (signalExpired) {
                    if (!conversationEndCandidateAt) conversationEndCandidateAt = now;
                    if (now - conversationEndCandidateAt >= CONVERSATION_END_GRACE_MS) {
                        stopConversationTimer(conversationEndCandidateAt, `signal-loss:${reason}`, getBestCompletedConversationDuration(conversationEndCandidateAt));
                    }
                } else {
                    conversationEndCandidateAt = 0;
                }
            }
        }
        return snapshot;
    }

    function getNativeVolumeSlider() {
        return document.querySelector('.volume_slider input.slider-input, .volume_slider input[type="range"]');
    }

    function clearScriptHiddenState(element) {
        if (!element) return;
        element.classList.remove('autonektome-hide-site-chrome');
        delete element.dataset.autonektomeHiddenSiteChrome;
        ['display', 'visibility', 'opacity', 'width', 'height', 'max-width', 'max-height', 'margin', 'padding', 'overflow', 'pointer-events'].forEach(prop => clearImportantStyle(element, prop));
    }

    function restoreNativeVolumeControl() {
        const slider = getNativeVolumeSlider();
        if (!slider) return null;
        const wrapper = slider.closest('.volume_slider');
        const header = slider.closest('.header.header_chat, .header_chat');
        clearScriptHiddenState(header);
        clearScriptHiddenState(wrapper);
        forceImportantStyle(header, 'display', 'flex');
        forceImportantStyle(header, 'visibility', 'visible');
        forceImportantStyle(header, 'opacity', '1');
        forceImportantStyle(wrapper, 'display', 'flex');
        forceImportantStyle(wrapper, 'visibility', 'visible');
        forceImportantStyle(wrapper, 'opacity', '1');
        return slider;
    }

    function getSiteVolumePercent() {
        const value = Number(settings.siteVolume);
        return Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 50;
    }

    function applySiteVolume(value, source = 'fallback') {
        const rawValue = Number(value);
        const normalized = Number.isFinite(rawValue) ? Math.max(0, Math.min(100, rawValue)) : getSiteVolumePercent();
        settings.siteVolume = normalized;
        saveSetting('siteVolume', normalized);
        const audio = document.querySelector('audio#audioStream');
        if (audio) audio.volume = normalized / 100;
        const nativeSlider = restoreNativeVolumeControl();
        if (nativeSlider && source !== 'native') {
            nativeSlider.value = String(normalized);
            nativeSlider.dispatchEvent(new Event('input', { bubbles: true }));
            nativeSlider.dispatchEvent(new Event('change', { bubbles: true }));
        }
        const fallbackSlider = document.querySelector('#an-site-volume-slider');
        const fallbackValue = document.querySelector('#an-site-volume-value');
        const miniSlider = document.querySelector('#an-mini-volume-slider');
        const miniValue = document.querySelector('#an-mini-volume-value');
        if (fallbackSlider && source !== 'fallback') fallbackSlider.value = String(normalized);
        if (miniSlider && source !== 'mini') miniSlider.value = String(normalized);
        if (fallbackValue) fallbackValue.textContent = `${Math.round(normalized)}%`;
        if (miniValue) miniValue.textContent = `${Math.round(normalized)}%`;
    }

    function syncVolumeControls() {
        const nativeSlider = restoreNativeVolumeControl();
        const fallback = document.querySelector('#an-site-volume-fallback');
        if (fallback) fallback.hidden = false;
        if (nativeSlider) {
            if (!nativeSlider.dataset.autonektomeVolumeListener) {
                nativeSlider.addEventListener('input', () => applySiteVolume(nativeSlider.value, 'native'));
                nativeSlider.dataset.autonektomeVolumeListener = 'true';
            }
            const value = Number(nativeSlider.value);
            if (Number.isFinite(value)) {
                settings.siteVolume = value;
                const fallbackSlider = document.querySelector('#an-site-volume-slider');
                const fallbackValue = document.querySelector('#an-site-volume-value');
                const miniSlider = document.querySelector('#an-mini-volume-slider');
                const miniValue = document.querySelector('#an-mini-volume-value');
                if (fallbackSlider) fallbackSlider.value = String(value);
                if (miniSlider) miniSlider.value = String(value);
                if (fallbackValue) fallbackValue.textContent = `${Math.round(value)}%`;
                if (miniValue) miniValue.textContent = `${Math.round(value)}%`;
            }
            return true;
        }
        if (fallback) fallback.hidden = false;
        const audio = document.querySelector('audio#audioStream');
        if (audio && !audio.dataset.autonektomeInitialVolumeApplied) {
            audio.volume = Math.max(0, Math.min(1, getSiteVolumePercent() / 100));
            audio.dataset.autonektomeInitialVolumeApplied = 'true';
        }
        return false;
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

        const micState = __autoNektomeMediaSafety.isMuted();
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

            #settings-container button {
                font: inherit;
                color: inherit;
                -webkit-appearance: none;
                appearance: none;
            }

            .an-soft-button {
                min-height: 34px;
                padding: 6px 12px;
                border: 1px solid color-mix(in srgb, var(--an-primary) 28%, var(--an-outline-variant));
                border-radius: 11px;
                background: color-mix(in srgb, var(--an-primary) 10%, var(--an-surface-container-high));
                color: var(--an-on-surface);
                box-shadow: none;
                font-size: 12px;
                font-weight: 700;
                line-height: 1.2;
                white-space: nowrap;
                cursor: pointer;
                transition: background 160ms ease, border-color 160ms ease, color 160ms ease, transform 120ms ease, opacity 160ms ease;
            }

            .an-soft-button:hover:not(:disabled) {
                background: color-mix(in srgb, var(--an-primary) 18%, var(--an-surface-container-high));
                border-color: color-mix(in srgb, var(--an-primary) 55%, var(--an-outline-variant));
                color: var(--an-primary);
            }

            .an-soft-button:active:not(:disabled) {
                transform: translateY(1px);
            }

            .an-soft-button:disabled {
                opacity: .48;
                cursor: not-allowed;
                background: var(--an-surface-container-high);
                border-color: var(--an-outline-variant);
                color: var(--an-on-surface-variant);
                filter: none;
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



            @container (max-width: 340px) {
                .an-sticky-core {
                    grid-template-columns: 1fr auto;
                }
                .an-auto-card {
                    grid-column: 1 / -1;
                }
            }



            /* Visual polish v5.1.0: compact professional core bar + quiet ad block */
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


            .an-stat-value,
            .an-mini-stat-value {
                width: 100%;
                max-width: 100%;
                min-width: 0;
                font-variant-numeric: tabular-nums;
                letter-spacing: -0.02em;
                text-overflow: clip;
            }

            #an-site-volume-fallback { grid-column: 1 / -1; }
            #an-site-volume-fallback[hidden] { display: none !important; }
            #an-site-volume-fallback .an-range-label { display: flex; justify-content: space-between; gap: 8px; }

            body.autonektome-site-themed .header.header_chat,
            body.autonektome-site-themed .volume_slider,
            body.autonektome-site-themed .volume_slider * {
                visibility: visible !important;
                opacity: 1 !important;
                pointer-events: auto !important;
                max-width: none !important;
                max-height: none !important;
            }

            body.autonektome-site-themed .header.header_chat {
                display: flex !important;
            }

            body.autonektome-site-themed .volume_slider {
                display: flex !important;
            }

            body.autonektome-auto-confirm-pending .swal2-container,
            body.autonektome-auto-confirm-pending .swal2-backdrop-show {
                opacity: 0 !important;
                pointer-events: none !important;
                transition: none !important;
                animation: none !important;
            }

            body.autonektome-seamless-transition .callScreen.callFinished,
            body.autonektome-seamless-transition .chat-step.finished,
            body.autonektome-seamless-transition .chat-step.finish,
            body.autonektome-seamless-transition .chat-step.hangup,
            body.autonektome-seamless-transition .callFinished,
            body.autonektome-seamless-transition .hangup {
                opacity: 0 !important;
                transition: none !important;
                animation: none !important;
            }

            .autonektome-runtime-toast {
                position: fixed;
                left: 50%;
                bottom: 22px;
                transform: translateX(-50%);
                z-index: 2147483647;
                max-width: min(92vw, 430px);
                padding: 10px 14px;
                border-radius: 14px;
                background: rgba(20, 18, 24, .94);
                color: #fff;
                box-shadow: 0 8px 28px rgba(0,0,0,.35);
                font: 600 13px/1.35 "Segoe UI", Arial, sans-serif;
                text-align: center;
                pointer-events: none;
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
            .an-primary-button {
                background: var(--an-primary);
                color: var(--an-on-primary);
                border-color: var(--an-primary);
            }
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
                    "stats stats stats"
                    "volume volume volume";
                align-items: center;
                gap: 8px;
            }
            #mini-mic-toggle { grid-area: mic; }
            #mini-headphone-toggle { grid-area: hp; }
            #mini-auto-mode-card { grid-area: auto; }
            .an-mini-stats { grid-area: stats; }
            .an-mini-volume {
                grid-area: volume;
                min-width: 0;
                display: grid;
                grid-template-columns: 1fr;
                gap: 4px;
                padding: 7px 9px 8px;
                border-radius: 11px;
                background: color-mix(in srgb, var(--an-primary) 7%, var(--an-surface-container));
                border: 1px solid color-mix(in srgb, var(--an-primary) 12%, var(--an-outline-variant));
                cursor: pointer;
            }
            .an-mini-volume-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 8px;
                font-size: 9.5px;
                line-height: 1;
                font-weight: 750;
                color: var(--an-on-surface-variant);
            }
            .an-mini-volume-header strong {
                color: var(--an-primary);
                font-size: 10px;
                font-variant-numeric: tabular-nums;
            }
            .an-mini-volume-slider {
                width: 100%;
                min-width: 0;
                height: 14px;
                margin: 0;
                padding: 0;
                cursor: pointer;
            }
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


    function getCurrentConversationDuration(now = Date.now()) {
        if (!currentConversationStart) return 0;

        // Пока штатный таймер разговора присутствует, отображаем именно его:
        // это исключает расхождение панели AutoNektome с Nekto.me после быстрых
        // переключений, фонового throttling или краткого изменения DOM.
        const timerElement = document.querySelector('.callScreen__time, .timer-label');
        if (timerElement && /\d/.test(String(timerElement.textContent || ''))) {
            return Math.max(0, parseDisplayedDuration(timerElement.textContent));
        }

        return Math.max(0, Math.floor((now - currentConversationStart) / 1000));
    }

    function getLiveTotalConversationDuration(now = Date.now()) {
        const completedDuration = Math.max(0, Number(settings.totalConversationDuration) || 0);
        return completedDuration + getCurrentConversationDuration(now);
    }

    function getLiveConversationCount() {
        const completedCount = Math.max(0, Number(settings.conversationCount) || 0);
        return completedCount + (currentConversationStart ? 1 : 0);
    }

    function updateStatsUI() {
        const countEl = document.querySelector('#an-stat-count');
        const currentEl = document.querySelector('#an-stat-current');
        const totalEl = document.querySelector('#an-stat-total');
        const miniCountEl = document.querySelector('#an-mini-stat-count');
        const miniCurrentEl = document.querySelector('#an-mini-stat-current');
        const miniTotalEl = document.querySelector('#an-mini-stat-total');
        const legacyCounter = document.querySelector('#conversation-counter .an-counter-value');
        const now = Date.now();
        const countText = String(getLiveConversationCount());
        const currentText = formatCurrentDuration(getCurrentConversationDuration(now));
        const totalText = formatTotalDuration(getLiveTotalConversationDuration(now));
        setStatValue(countEl, countText);
        setStatValue(currentEl, currentText);
        setStatValue(totalEl, totalText);
        setStatValue(miniCountEl, countText);
        setStatValue(miniCurrentEl, currentText);
        setStatValue(miniTotalEl, totalText);
        if (legacyCounter) legacyCounter.textContent = `Разговоров: ${getLiveConversationCount()}`;
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
            if (isAutoSearchSafetyPaused()) {
                const secondsLeft = Math.max(1, Math.ceil((autoSearchPauseUntil - Date.now()) / 1000));
                return { key: 'idle', title: 'Пауза', text: `защита ${secondsLeft} с` };
            }
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
                if (micTestMonitorState?.modalBackdrop === backdrop) stopMicTestMonitor('modal-close');
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
        monitorSwitch.input.addEventListener('change', async () => {
            monitorSwitch.label.classList.toggle('is-enabled', monitorSwitch.input.checked);

            if (!monitorSwitch.input.checked) {
                if (micTestState?.monitorGain) micTestState.monitorGain.gain.value = 0;
                stopMicTestMonitor('toggle-off');
                return;
            }

            if (micTestState?.monitorGain) {
                micTestState.monitorGain.gain.value = Math.max(0, Number(settings.gainValue) || 1);
                void unlockAudioContext(micTestState.ctx, 'mic-test-monitor-toggle');
                return;
            }

            const preparedMonitorContext = AudioContextClass ? new AudioContextClass() : null;
            if (preparedMonitorContext) void unlockAudioContext(preparedMonitorContext, 'mic-test-monitor-user-gesture');

            try {
                const started = await startMicTestMonitor({
                    monitorInput: monitorSwitch.input,
                    modalBackdrop: document.querySelector('.an-mic-modal'),
                    preparedAudioContext: preparedMonitorContext
                });
                if (!started && monitorSwitch.input.checked) throw new Error('Самопрослушивание не запустилось');
            } catch (error) {
                preparedMonitorContext?.close?.().catch(() => {});
                if (!monitorSwitch.input.checked) return;
                monitorSwitch.input.checked = false;
                monitorSwitch.label.classList.remove('is-enabled');
                levelText.textContent = 'Не удалось получить доступ к микрофону.';
                diag('error', 'micTest.monitor.failed', { message: error?.message || String(error), name: error?.name || null });
            }
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
            stopMicTestMonitor('recording-start');
            const preparedMonitorContext = AudioContextClass ? new AudioContextClass() : null;
            if (preparedMonitorContext) void unlockAudioContext(preparedMonitorContext, 'mic-test-user-gesture');

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
                    modalBackdrop: document.querySelector('.an-mic-modal'),
                    preparedAudioContext: preparedMonitorContext
                });
            } catch (error) {
                preparedMonitorContext?.close?.().catch(() => {});
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

    function stopMicTestMonitor(reason = 'manual') {
        micTestMonitorRequestId++;
        if (!micTestMonitorState) return;
        const state = micTestMonitorState;
        micTestMonitorState = null;
        try { state.source?.disconnect(); } catch (error) {}
        try { state.monitorGain?.disconnect(); } catch (error) {}
        state.stream?.getTracks?.().forEach(track => track.stop());
        state.ctx?.close?.().catch(() => {});
        diag('info', 'micTest.monitor.stopped', { reason });
    }

    async function startMicTestMonitor(ui) {
        stopMicTestMonitor('restart');
        if (!AudioContextClass) return false;

        const requestId = ++micTestMonitorRequestId;
        const ctx = ui.preparedAudioContext || new AudioContextClass();
        await unlockAudioContext(ctx, 'mic-test-monitor-before-get-user-media');

        let stream;
        try {
            stream = await requestRawMicStream({
                audio: {
                    echoCancellation: settings.echoCancellation,
                    noiseSuppression: settings.noiseSuppression,
                    autoGainControl: settings.autoGainControl
                }
            });
        } catch (error) {
            ctx.close().catch(() => {});
            throw error;
        }

        if (requestId !== micTestMonitorRequestId || !ui.monitorInput?.checked || !ui.modalBackdrop?.isConnected) {
            stream.getTracks().forEach(track => track.stop());
            ctx.close().catch(() => {});
            return false;
        }

        const source = ctx.createMediaStreamSource(stream);
        const monitorGain = ctx.createGain();
        monitorGain.gain.value = Math.max(0, Number(settings.gainValue) || 1);
        source.connect(monitorGain);
        monitorGain.connect(ctx.destination);
        const running = await unlockAudioContext(ctx, 'mic-test-monitor-connected');

        if (requestId !== micTestMonitorRequestId || !ui.monitorInput?.checked || !ui.modalBackdrop?.isConnected) {
            try { source.disconnect(); } catch (error) {}
            try { monitorGain.disconnect(); } catch (error) {}
            stream.getTracks().forEach(track => track.stop());
            ctx.close().catch(() => {});
            return false;
        }

        micTestMonitorState = {
            stream,
            ctx,
            source,
            monitorGain,
            modalBackdrop: ui.modalBackdrop
        };
        diag('info', 'micTest.monitor.started', {
            contextState: ctx.state,
            running,
            gain: monitorGain.gain.value,
            trackState: stream.getAudioTracks?.()[0]?.readyState || null
        });
        return ctx.state === 'running';
    }

    async function startMicTest(ui) {
        stopMicTest('restart');
        clearMicTestRecording();

        const ctx = ui.preparedAudioContext || new (window.AudioContext || window.webkitAudioContext)();
        await unlockAudioContext(ctx, 'mic-test-before-get-user-media');

        let stream;
        try {
            stream = await requestRawMicStream({
                audio: {
                    echoCancellation: settings.echoCancellation,
                    noiseSuppression: settings.noiseSuppression,
                    autoGainControl: settings.autoGainControl
                }
            });
        } catch (error) {
            ctx.close().catch(() => {});
            throw error;
        }

        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 2048;
        analyser.minDecibels = -95;
        analyser.maxDecibels = -18;
        analyser.smoothingTimeConstant = 0.58;
        source.connect(analyser);

        const monitorGain = ctx.createGain();
        monitorGain.gain.value = ui.monitorInput?.checked ? Math.max(0, Number(settings.gainValue) || 1) : 0;
        source.connect(monitorGain);
        monitorGain.connect(ctx.destination);
        await unlockAudioContext(ctx, 'mic-test-monitor-connected');

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
            source,
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

        const keepMonitoring = reason !== 'modal-close'
            && reason !== 'restart'
            && state.ui?.monitorInput?.checked
            && state.modalBackdrop?.isConnected;

        if (keepMonitoring) {
            try { state.source?.disconnect(state.analyser); } catch (error) {}
            micTestMonitorRequestId++;
            micTestMonitorState = {
                stream: state.stream,
                ctx: state.ctx,
                source: state.source,
                monitorGain: state.monitorGain,
                modalBackdrop: state.modalBackdrop
            };
        } else {
            try { state.source?.disconnect(); } catch (error) {}
            try { state.monitorGain?.disconnect(); } catch (error) {}
            state.stream?.getTracks().forEach(track => track.stop());
            state.ctx?.close?.().catch(() => {});
        }

        state.ui?.bars?.forEach(bar => {
            bar.style.setProperty('--h', '8%');
            bar.style.setProperty('--pulse', '1');
            bar.classList.remove('is-hot');
        });
        if (state.ui?.levelText && !state.recorder) state.ui.levelText.textContent = 'Проверка остановлена.';
        if (state.ui?.startButton) state.ui.startButton.disabled = false;
        if (state.ui?.stopButton) state.ui.stopButton.disabled = true;
        diag('info', 'micTest.stopped', { reason, keepMonitoring });
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
        counterDiv.appendChild(stat('an-stat-current', 'текущий', formatCurrentDuration(getCurrentConversationDuration())));
        counterDiv.appendChild(stat('an-stat-total', 'всего', formatTotalDuration(getLiveTotalConversationDuration())));

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
        miniStats.appendChild(miniStat('an-mini-stat-current', 'текущий', formatCurrentDuration(getCurrentConversationDuration())));
        miniStats.appendChild(miniStat('an-mini-stat-total', 'всего', formatTotalDuration(getLiveTotalConversationDuration())));

        const miniVolume = document.createElement('label');
        miniVolume.className = 'an-mini-volume';
        miniVolume.setAttribute('for', 'an-mini-volume-slider');
        const miniVolumeHeader = document.createElement('span');
        miniVolumeHeader.className = 'an-mini-volume-header';
        const miniVolumeTitle = document.createElement('span');
        miniVolumeTitle.textContent = 'Громкость';
        const miniVolumeValue = document.createElement('strong');
        miniVolumeValue.id = 'an-mini-volume-value';
        miniVolumeValue.textContent = `${Math.round(getSiteVolumePercent())}%`;
        miniVolumeHeader.appendChild(miniVolumeTitle);
        miniVolumeHeader.appendChild(miniVolumeValue);
        const miniVolumeSlider = document.createElement('input');
        miniVolumeSlider.id = 'an-mini-volume-slider';
        miniVolumeSlider.type = 'range';
        miniVolumeSlider.className = 'an-range an-mini-volume-slider';
        miniVolumeSlider.min = '0';
        miniVolumeSlider.max = '100';
        miniVolumeSlider.step = '1';
        miniVolumeSlider.value = String(getSiteVolumePercent());
        miniVolumeSlider.setAttribute('aria-label', 'Громкость собеседника');
        miniVolumeSlider.addEventListener('input', () => applySiteVolume(miniVolumeSlider.value, 'mini'));
        miniVolume.appendChild(miniVolumeHeader);
        miniVolume.appendChild(miniVolumeSlider);

        mini.appendChild(miniMicButton);
        mini.appendChild(miniHeadphoneButton);
        mini.appendChild(miniAutoCard);
        mini.appendChild(miniStats);
        mini.appendChild(miniVolume);
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
        coreBlock.appendChild(createSiteVolumeControl());

        const audioSettings = document.createElement('div');
        audioSettings.className = 'an-settings-list';

        const settingHelpers = {
            enableLoopback: 'Слышать свой микрофон в наушниках',
            autoGainControl: 'Автонастройка уровня микрофона',
            autoVolume: 'Выравнивает громкость собеседника',
            noiseSuppression: 'Уменьшает фоновый шум',
            echoCancellation: 'Уменьшает эхо',
            voiceControl: 'Команды: скип, чат, завершить',
            notificationSounds: 'Включает звуки начала и завершения разговора',
            autoConfirmDisconnect: 'Завершает диалог одним нажатием без видимого окна подтверждения',
            disconnectProtection: 'Разрешает два быстрых скипа в минуту, затем ждёт 5 секунд текущего разговора',
            diagnosticLogs: 'Подробные события в консоль и AutoNektomeDebug.dump()',
            metricGlobalStubs: 'Выключает счётчики после загрузки'
        };

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

            const applyToggleChange = async () => {
                settings[key] = checkbox.checked;
                saveSetting(key, checkbox.checked);
                control.label.classList.toggle('is-enabled', checkbox.checked);
                control.label.setAttribute('aria-checked', String(checkbox.checked));

                if (key === 'enableLoopback') {
                    if (volumeContainer) volumeContainer.hidden = !checkbox.checked;

                    if (checkbox.checked) {
                        // AudioContext создаётся и разблокируется синхронно в обработчике
                        // клика, до возможного ожидания разрешения на микрофон.
                        const preferredStream = hasLiveAudioTrack(globalStream) ? globalStream : null;
                        const preparedContext = prepareSelfListeningContext(preferredStream);

                        if (checkbox.checked && settings.enableLoopback) {
                            const started = await enableSelfListening(preferredStream, preparedContext);
                            if (!started) {
                                diag('warn', 'selfListening.notStarted', {
                                    hasStream: !!preferredStream,
                                    contextState: preparedContext?.state || null
                                });
                            }
                        }
                    } else {
                        stopSelfListening();
                    }
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
                } else if (key === 'disconnectProtection' && !checkbox.checked) {
                    autoSearchPauseUntil = 0;
                    queuedDisconnect = null;
                    disconnectHistory = [];
                    pendingDisconnectGuardRegistered = false;
                    clearDisconnectIntent();
                    saveDisconnectGuardState();
                    updateCurrentStatusUI();
                }
            };

            checkbox.addEventListener('change', applyToggleChange);

            if (key === 'voiceControl') {
                // У голосового управления дополнительный блок меняет высоту строки.
                // На части браузеров нативный click вложенного checkbox из-за этого
                // визуально срабатывал только со второго раза. Переключаем явно.
                checkbox.style.pointerEvents = 'none';
                checkbox.tabIndex = -1;
                control.label.tabIndex = 0;
                control.label.setAttribute('role', 'switch');
                control.label.setAttribute('aria-checked', String(checkbox.checked));
                control.label.addEventListener('click', event => {
                    event.preventDefault();
                    event.stopPropagation();
                    checkbox.checked = !checkbox.checked;
                    applyToggleChange();
                });
                control.label.addEventListener('keydown', event => {
                    if (event.key !== 'Enter' && event.key !== ' ') return;
                    event.preventDefault();
                    control.label.click();
                });
            }

            if (key === 'voiceControl') row.appendChild(createVoiceControlExtras());
            if (key === 'enableLoopback' && volumeContainer) row.appendChild(volumeContainer);
            return row;
        }

        function createSiteVolumeControl() {
            const row = document.createElement('section');
            row.id = 'an-site-volume-fallback';
            row.className = 'an-setting-row';
            const text = document.createElement('div');
            text.className = 'an-setting-text';
            const title = document.createElement('div');
            title.className = 'an-setting-title';
            title.textContent = 'Громкость собеседника';
            text.appendChild(title);

            const nested = document.createElement('div');
            nested.className = 'an-nested';
            const rangeRow = document.createElement('label');
            rangeRow.className = 'an-range-row';
            const label = document.createElement('span');
            label.className = 'an-range-label';
            label.innerHTML = `Уровень <strong id="an-site-volume-value">${Math.round(getSiteVolumePercent())}%</strong>`;
            const slider = document.createElement('input');
            slider.id = 'an-site-volume-slider';
            slider.type = 'range';
            slider.className = 'an-range';
            slider.min = '0';
            slider.max = '100';
            slider.step = '1';
            slider.value = String(getSiteVolumePercent());
            slider.addEventListener('input', () => applySiteVolume(slider.value, 'fallback'));
            rangeRow.appendChild(label);
            rangeRow.appendChild(slider);
            nested.appendChild(rangeRow);
            row.appendChild(text);
            row.appendChild(nested);
            return row;
        }

        audioSettings.appendChild(createMicTestCard());
        audioSettings.appendChild(createToggle('Голосовое управление', 'voiceControl'));
        audioSettings.appendChild(createToggle('Самопрослушивание', 'enableLoopback'));
        audioSettings.appendChild(createToggle('Автогромкость микрофона', 'autoGainControl'));
        audioSettings.appendChild(createToggle('Автогромкость собеседника', 'autoVolume'));
        audioSettings.appendChild(createToggle('Шумоподавление', 'noiseSuppression'));
        audioSettings.appendChild(createToggle('Эхоподавление', 'echoCancellation'));
        audioSettings.appendChild(createToggle('Звуки уведомлений', 'notificationSounds'));
        audioSettings.appendChild(createToggle('Завершать диалог одним нажатием', 'autoConfirmDisconnect'));
        audioSettings.appendChild(createToggle('Защита от частых отключений', 'disconnectProtection'));
        audioSettings.appendChild(createToggle('Диагностические логи', 'diagnosticLogs'));

        body.appendChild(audioSettings);
        body.appendChild(createThemeSelector());

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
            syncVolumeControls();
            syncConversationLifecycle(`dom:${reason}`);
            flushQueuedDisconnect(`dom:${reason}`);
            confirmDisconnectIfNeeded(`dom:${reason}`);
            if (seamlessTransitionUntil && Date.now() > seamlessTransitionUntil) endSeamlessTransition();
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
        if (document.visibilityState === 'hidden') {
            queueMicrotask(() => runDomMaintenance(`${reason}:hidden`));
        } else {
            requestAnimationFrame(() => runDomMaintenance(reason));
        }
    }

    function initObserver() {
        if (observer || !document.body) return;
        observer = new MutationObserver((mutations) => {
      // AutoNektome production compatibility patch v5: ignore own settings-panel mutations.
      mutations = mutations.filter(mutation => {
        const rawTarget = mutation.target;
        const target = rawTarget instanceof Element
          ? rawTarget
          : rawTarget?.parentElement;

        if (target?.closest?.('#settings-container')) return false;

        const addedNodes = Array.from(mutation.addedNodes || []);
        if (!addedNodes.length) return true;

        return addedNodes.some(node => {
          if (!(node instanceof Element)) return true;
          if (node.id === 'settings-container') return false;
          if (node.closest?.('#settings-container')) return false;
          return true;
        });
      });

      if (!mutations.length) return;

            // Критические переходы обрабатываем в microtask MutationObserver до следующей отрисовки.
            confirmDisconnectIfNeeded('urgent-mutation');
            if (getFinishedSearchContainer()) checkAndClickButton('urgent-finished-screen');
            syncConversationLifecycle('urgent-mutation');

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

    function runBackgroundMaintenance(reason = 'background') {
        try {
            flushQueuedDisconnect(reason);
            confirmDisconnectIfNeeded(reason);
            syncConversationLifecycle(reason);
            if (isAutoModeEnabled) checkAndClickButton(reason);
            syncVolumeControls();
            updateStatsUI();
            updateCurrentStatusUI();
            if (seamlessTransitionUntil && Date.now() > seamlessTransitionUntil) endSeamlessTransition();
        } catch (error) {
            diag('error', 'backgroundMaintenance.error', { reason, message: error?.message || String(error) }, { throttleMs: 1500 });
        }
    }

    function installResilientRuntimeHooks() {
        if (document.documentElement.dataset.autonektomeRuntimeHooks === 'true') return;
        document.documentElement.dataset.autonektomeRuntimeHooks = 'true';
        document.addEventListener('click', handleDisconnectClickCapture, true);
        ['visibilitychange', 'readystatechange'].forEach(name => document.addEventListener(name, () => runBackgroundMaintenance(name)));
        ['focus', 'pageshow', 'hashchange', 'online'].forEach(name => window.addEventListener(name, () => runBackgroundMaintenance(name)));
        ['playing', 'loadedmetadata', 'emptied', 'ended', 'pause'].forEach(name => {
            document.addEventListener(name, event => {
                if (event.target?.matches?.('audio#audioStream')) runBackgroundMaintenance(`audio:${name}`);
            }, true);
        });

        try {
            const workerCode = `setInterval(() => postMessage(Date.now()), 750);`;
            const workerUrl = URL.createObjectURL(new Blob([workerCode], { type: 'application/javascript' }));
            backgroundWorker = new Worker(workerUrl);
            URL.revokeObjectURL(workerUrl);
            backgroundWorker.onmessage = () => runBackgroundMaintenance('worker-clock');
            backgroundWorker.onerror = () => {
                try { backgroundWorker?.terminate(); } catch (error) {}
                backgroundWorker = null;
            };
        } catch (error) {
            backgroundWorker = null;
        }

        backgroundFallbackTimer = setInterval(() => runBackgroundMaintenance('fallback-clock'), 1500);
        runBackgroundMaintenance('hooks-installed');
    }

    // Browser media APIs remain native for NektoMe compatibility.

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
        document.getElementById('autonektome-boot-hint')?.remove();
        if (__autoNektomeBootHintRemoveTimer) {
            clearTimeout(__autoNektomeBootHintRemoveTimer);
            __autoNektomeBootHintRemoveTimer = null;
        }
        installResilientRuntimeHooks();
        syncVolumeControls();
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

  };


  /*
   * AutoNektome automatic-safe boot v6 clean
   *
   * NektoMe sends its large encrypted registration/profile packet shortly
   * after the page opens, before the first dialog. Starting the full script at
   * document-start changes DOM/canvas/global state before that profile is
   * formed and can trigger the false server-side block.
   *
   * This controller stays passive and starts AutoNektome automatically when
   * NektoMe's idle screen has received a real online-count update. No packet
   * is blocked, read or modified. A conservative timeout and the previously
   * proven post-click fallback cover layout/network variations.
   */
  const AUTO_BOOT_MIN_MS = 6500;
  const AUTO_BOOT_FALLBACK_MS = 11000;
  const CLICK_FALLBACK_MS = 1500;
  const BOOT_HINT_VISIBLE_MS = 7500;

  let __autoNektomeBooted = false;
  let __autoNektomeBootTimer = null;
  let __autoNektomeFallbackTimer = null;
  let __autoNektomeObserver = null;
  let __autoNektomeStartObserved = false;
  let __autoNektomeBootHintTimer = null;
  let __autoNektomeBootHintRemoveTimer = null;
  const __autoNektomeStartedAt = performance.now();

  const __hasNektoBanPopup = () => {
    const popup = document.querySelector('.banPopup');
    if (!popup) return false;
    const text = popup.textContent || '';
    return (
      text.includes('Доступ к чатам') ||
      text.includes('IP-адреса заблокирован') ||
      text.includes('БАН')
    );
  };

  const __isPeerRoute = () =>
    /#\/peer(?:$|[/?])/i.test(location.hash || '');

  const __isSearchingRoute = () =>
    /#\/searching(?:$|[/?])/i.test(location.hash || '');

  const __hasOnlineCountSignal = () => {
    const candidates = document.querySelectorAll(
      '.users-count-panel .talking-count, .talking-count'
    );

    return Array.from(candidates).some(element => {
      const text = String(element.textContent || '').trim();
      return /\d/.test(text);
    });
  };

  const __isIdleScreenReady = () => {
    if (__hasNektoBanPopup()) return false;
    if (__isPeerRoute() || __isSearchingRoute()) return false;

    const button = document.querySelector('#searchCompanyBtn');
    if (!(button instanceof HTMLElement)) return false;
    if (button.matches(':disabled, [disabled]')) return false;

    const appText = String(
      document.querySelector('#audio-chat-container')?.textContent || ''
    );

    return !/Ид[её]т загрузка|загрузка\.{2,}|подождите/i.test(appText);
  };

  const __cleanupAutoNektomeBoot = () => {
    if (__autoNektomeBootTimer) {
      clearTimeout(__autoNektomeBootTimer);
      __autoNektomeBootTimer = null;
    }
    if (__autoNektomeFallbackTimer) {
      clearTimeout(__autoNektomeFallbackTimer);
      __autoNektomeFallbackTimer = null;
    }
    if (__autoNektomeObserver) {
      __autoNektomeObserver.disconnect();
      __autoNektomeObserver = null;
    }
    if (__autoNektomeBootHintTimer) {
      clearTimeout(__autoNektomeBootHintTimer);
      __autoNektomeBootHintTimer = null;
    }
    // Сообщение удаляется только после фактического создания панели.
    // Если поздняя инициализация завершится ошибкой, пользователь не останется
    // без объяснения того, почему интерфейс ещё не появился.

    window.removeEventListener('hashchange', __checkAcceptedRoute);
    document.removeEventListener(
      'click',
      __onFirstTrustedStart,
      true
    );
  };

  const __bootAutoNektome = reason => {
    if (__autoNektomeBooted || __hasNektoBanPopup()) return false;

    __autoNektomeBooted = true;
    __cleanupAutoNektomeBoot();

    setTimeout(() => {
      if (__hasNektoBanPopup()) return;
      try {
        __autoNektomeLateBoot();
        console.info('AutoNektome 5.1 запущен:', reason);
      } catch (error) {
        __autoNektomeBooted = false;
        console.error('AutoNektome 5.1: ошибка позднего запуска', error);
        __showBootHintIfNeeded();
      }
    }, 80);

    return true;
  };

  const __scheduleBootAtMinimum = reason => {
    if (__autoNektomeBooted || __autoNektomeBootTimer) return;

    const elapsed = performance.now() - __autoNektomeStartedAt;
    const wait = Math.max(250, AUTO_BOOT_MIN_MS - elapsed);

    __autoNektomeBootTimer = setTimeout(() => {
      __autoNektomeBootTimer = null;

      if (__hasNektoBanPopup()) return;

      if (
        __hasOnlineCountSignal() ||
        __isIdleScreenReady() ||
        __isPeerRoute()
      ) {
        __bootAutoNektome(reason);
      }
    }, wait);
  };

  const __checkPassiveReadySignal = () => {
    if (__autoNektomeBooted || __hasNektoBanPopup()) return;

    if (__isPeerRoute()) {
      __scheduleBootAtMinimum('accepted-peer-route');
      return;
    }

    if (__hasOnlineCountSignal() && __isIdleScreenReady()) {
      __scheduleBootAtMinimum('online-count-ready');
    }
  };

  const __checkAcceptedRoute = () => {
    if (__isPeerRoute() || __isSearchingRoute()) {
      __autoNektomeMediaSafety.install();
    }
    if (__isPeerRoute()) {
      __scheduleBootAtMinimum('peer-route-change');
    }
  };

  const __startPassiveObserver = () => {
    if (__autoNektomeObserver || !document.documentElement) return;

    __autoNektomeObserver = new MutationObserver(
      __checkPassiveReadySignal
    );

    __autoNektomeObserver.observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['class', 'disabled']
    });

    __checkPassiveReadySignal();
  };

  const __onFirstTrustedStart = event => {
    if (!event.isTrusted || __autoNektomeStartObserved) return;

    const origin = event.target;
    const element = origin instanceof Element
      ? origin
      : origin?.parentElement;

    if (!element?.closest?.('#searchCompanyBtn')) return;

    // Ставим аудио-перехват в capture-фазе до обработчика сайта, чтобы
    // зарегистрировать микрофонный поток и WebRTC sender первого диалога.
    __autoNektomeMediaSafety.install();

    __autoNektomeStartObserved = true;

    if (__autoNektomeBootTimer) {
      clearTimeout(__autoNektomeBootTimer);
    }

    __autoNektomeBootTimer = setTimeout(() => {
      __autoNektomeBootTimer = null;
      __bootAutoNektome('trusted-start-fallback');
    }, CLICK_FALLBACK_MS);
  };

  window.addEventListener('hashchange', __checkAcceptedRoute);

  document.addEventListener(
    'click',
    __onFirstTrustedStart,
    true
  );

  const __showBootHintIfNeeded = () => {
    if (__autoNektomeBooted || __hasNektoBanPopup() || document.getElementById('settings-container')) return;
    if (document.getElementById('autonektome-boot-hint')) return;

    const host = document.body || document.documentElement;
    if (!host) {
      if (!__autoNektomeBootHintTimer) {
        __autoNektomeBootHintTimer = setTimeout(() => {
          __autoNektomeBootHintTimer = null;
          __showBootHintIfNeeded();
        }, 0);
      }
      return;
    }

    const hint = document.createElement('div');
    hint.id = 'autonektome-boot-hint';
    hint.setAttribute('role', 'status');
    hint.setAttribute('aria-live', 'polite');

    const title = document.createElement('div');
    title.textContent = 'AutoNektome 5.1 загружен';
    Object.assign(title.style, {
      fontWeight: '800',
      fontSize: '14px',
      color: '#ffffff'
    });

    const message = document.createElement('div');
    message.textContent = 'Для безопасного запуска зайдите в первый диалог — панель появится автоматически.';
    Object.assign(message.style, {
      marginTop: '3px',
      color: 'rgba(255,255,255,.82)',
      fontWeight: '600',
      fontSize: '12px'
    });

    hint.appendChild(title);
    hint.appendChild(message);
    Object.assign(hint.style, {
      position: 'fixed',
      left: '50%',
      top: '14px',
      transform: 'translateX(-50%)',
      zIndex: '2147483647',
      width: 'max-content',
      maxWidth: 'min(92vw, 500px)',
      padding: '11px 16px',
      border: '1px solid rgba(121,192,255,.38)',
      borderRadius: '15px',
      background: 'linear-gradient(180deg, rgba(22,27,34,.98), rgba(13,17,23,.98))',
      color: '#fff',
      boxShadow: '0 10px 34px rgba(0,0,0,.46), 0 0 0 1px rgba(255,255,255,.035) inset',
      fontFamily: 'Roboto, Segoe UI, Arial, sans-serif',
      lineHeight: '1.3',
      textAlign: 'center',
      pointerEvents: 'none',
      opacity: '1'
    });
    host.appendChild(hint);

    __autoNektomeBootHintRemoveTimer = setTimeout(() => {
      __autoNektomeBootHintRemoveTimer = null;
      hint.remove();
    }, BOOT_HINT_VISIBLE_MS);
  };

  // Показываем сообщение на document-start, а не после защитного таймаута.
  // Если полная панель уже появилась, cleanup удалит сообщение немедленно.
  __showBootHintIfNeeded();

  const __startAutoBoot = () => {
    __startPassiveObserver();
    __showBootHintIfNeeded();

    // Conservative automatic fallback: menu appears on the initial page even
    // if NektoMe changes the users-count markup in a future build.
    const elapsed = performance.now() - __autoNektomeStartedAt;
    __autoNektomeFallbackTimer = setTimeout(() => {
      __autoNektomeFallbackTimer = null;

      if (__hasNektoBanPopup()) return;

      if (
        __isIdleScreenReady() ||
        __isPeerRoute() ||
        __isSearchingRoute()
      ) {
        __bootAutoNektome('automatic-safe-timeout');
      }
    }, Math.max(500, AUTO_BOOT_FALLBACK_MS - elapsed));
  };

  if (document.readyState === 'loading') {
    document.addEventListener(
      'DOMContentLoaded',
      __startAutoBoot,
      { once: true }
    );
  } else {
    __startAutoBoot();
  }

})();
