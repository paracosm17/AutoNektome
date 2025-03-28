// ==UserScript==
// @name         AutoNektome
// @namespace    http://tampermonkey.net/
// @version      3.0
// @description  Автоматический переход с настройками звука, голосовым управлением, улучшенной автогромкостью и изменением голоса для nekto.me audiochat
// @author       @paracosm17
// @match        https://nekto.me/audiochat
// @grant        none
// @license      MIT
// @downloadURL https://update.greasyfork.org/scripts/498724/AutoNektome.user.js
// @updateURL https://update.greasyfork.org/scripts/498724/AutoNektome.meta.js
// ==/UserScript==

(function() {
    'use strict';

    // ### Константы
    const NOTIFICATION_SOUND_URL = 'https://free-sound-effects.net/mp3/03/free-sound-1674971986.mp3';
    const VOICE_COMMANDS = {
        skip: ['скип', 'skip', 'скиф', 'скипнуть', 'кофе', 'кефир', 'дальше'],
        stop: ['завершить', 'остановить', 'закончить', 'кумыс'],
        start: ['разговор', 'диалог', 'чат']
    };
    const TARGET_VOLUME = 50;
    const MIN_VOLUME = 10;
    const MAX_VOLUME = 90;
    const TRANSITION_DURATION = 1000;
    const VOLUME_CHECK_INTERVAL = 200;
    const HOLD_DURATION = 5000;
    const SILENCE_THRESHOLD = 5;
    const HISTORY_SIZE = 15;

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
        pitchLevel: loadSetting('pitchLevel', 0, parseFloat)
    };

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

    // ### Утилиты
    const notificationAudio = new Audio(NOTIFICATION_SOUND_URL);
    notificationAudio.volume = 0.5;

    function loadSetting(key, defaultValue, transform = JSON.parse) {
        const value = localStorage.getItem(key);
        return value !== null ? transform(value) : defaultValue;
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
    function checkAndClickButton() {
        if (!isAutoModeEnabled) return;
        const button = document.querySelector('button.btn.btn-lg.go-scan-button');
        if (button) {
            notificationAudio.play();
            button.click();
        }
    }

    function skipConversation() {
        const stopButton = document.querySelector('button.btn.btn-lg.stop-talk-button');
        if (stopButton) {
            stopButton.click();
            setTimeout(() => {
                const confirmButton = document.querySelector('button.swal2-confirm.swal2-styled');
                if (confirmButton) confirmButton.click();
            }, 500);
            notificationAudio.play();
        }
    }

    function updateSliderStyles(enable) {
        const slider = document.querySelector('.slider');
        const sliderCircle = document.querySelector('.slider-circle');
        if (slider) slider.style.background = enable ? '#00ff9d' : '#555';
        if (sliderCircle) sliderCircle.style.left = enable ? '40px' : '4px';
    }

    function applyCustomStyles(enable) {
        const styleId = 'custom-slider-styles';
        let styleElement = document.getElementById(styleId);
        if (!styleElement) {
            styleElement = document.createElement('style');
            styleElement.id = styleId;
            document.head.appendChild(styleElement);
        }
        styleElement.textContent = `
            .slider { background: ${enable ? '#00ff9d' : '#555'} !important; transition: background 0.4s !important; }
            .slider-circle { left: ${enable ? '40px' : '4px'} !important; }
        `;
    }

    function toggleAutoMode(enable) {
        isAutoModeEnabled = enable;
        const toggleInput = document.querySelector('input[type="checkbox"]');
        const toggleLabel = document.querySelector('span.toggle-label');
        if (toggleInput) toggleInput.checked = enable;
        if (toggleLabel) {
            toggleLabel.textContent = `Авторежим ${enable ? 'ВКЛ' : 'ВЫКЛ'}`;
            toggleLabel.style.color = enable ? '#00ff9d' : '#ff4d4d';
            toggleLabel.style.textShadow = `0 0 5px ${enable ? '#00ff9d' : '#ff4d4d'}`;
        }
        updateSliderStyles(enable);
        applyCustomStyles(enable);
        if (!enable) skipConversation();
    }

    // ### Аудио функции
    async function getMicStream() {
        try {
            micStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    autoGainControl: settings.autoGainControl,
                    noiseSuppression: settings.noiseSuppression,
                    echoCancellation: settings.echoCancellation
                }
            });
            return micStream;
        } catch (e) {
            console.error('Ошибка получения микрофона:', e);
            return null;
        }
    }

    function enableSelfListening(stream) {
        if (!stream || !stream.getAudioTracks().length) return;
        if (audioContext) audioContext.close();
        audioContext = new AudioContext();
        const source = audioContext.createMediaStreamSource(stream);
        gainNode = audioContext.createGain();
        gainNode.gain.value = settings.gainValue;

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
    }

    async function createPitchShiftedStream(stream) {
        if (pitchAudioContext) pitchAudioContext.close();
        pitchAudioContext = new AudioContext();
        pitchSource = pitchAudioContext.createMediaStreamSource(stream);
        const outputNode = pitchAudioContext.createGain();

        if (settings.voicePitch && settings.pitchLevel > 0) {
            // Регистрируем AudioWorklet процессор
            const blob = new Blob([pitchShiftWorkletCode], { type: 'application/javascript' });
            const url = URL.createObjectURL(blob);
            await pitchAudioContext.audioWorklet.addModule(url);

            pitchWorkletNode = new AudioWorkletNode(pitchAudioContext, 'pitch-shift-processor');
            const pitchShiftFactor = 1.0 - settings.pitchLevel; // 0 -> 1.0, 0.4 -> 0.6
            pitchWorkletNode.port.postMessage(pitchShiftFactor);

            pitchNode = pitchAudioContext.createBiquadFilter();
            pitchNode.type = 'lowshelf';
            pitchNode.frequency.value = 300;
            pitchNode.gain.value = 10;

            pitchSource.connect(pitchWorkletNode);
            pitchWorkletNode.connect(pitchNode);
            pitchNode.connect(outputNode);
        } else {
            pitchSource.connect(outputNode);
        }

        const destination = pitchAudioContext.createMediaStreamDestination();
        outputNode.connect(destination);
        return destination.stream;
    }

    function updatePitchEffect(enable) {
        settings.voicePitch = enable;
        if (globalStream) {
            createPitchShiftedStream(micStream || globalStream).then(newStream => {
                globalStream.getAudioTracks().forEach(track => track.stop());
                globalStream = newStream;
                if (settings.enableLoopback) enableSelfListening(newStream);
            });
        }
    }

    function updatePitchLevel(value) {
        settings.pitchLevel = value;
        localStorage.setItem('pitchLevel', value);
        if (pitchWorkletNode) {
            const pitchShiftFactor = 1.0 - settings.pitchLevel;
            pitchWorkletNode.port.postMessage(pitchShiftFactor);
        } else if (globalStream) {
            createPitchShiftedStream(micStream || globalStream).then(newStream => {
                globalStream.getAudioTracks().forEach(track => track.stop());
                globalStream = newStream;
                if (settings.enableLoopback) enableSelfListening(newStream);
            });
        }
    }

    // ### Улучшенная автогромкость
    function setupAutoVolume(stream) {
        if (!settings.autoVolume || !stream) return;

        if (remoteAudioContext) remoteAudioContext.close();
        if (volumeCheckIntervalId) clearInterval(volumeCheckIntervalId);

        remoteAudioContext = new AudioContext();
        const source = remoteAudioContext.createMediaStreamSource(stream);
        volumeAnalyser = remoteAudioContext.createAnalyser();
        volumeAnalyser.fftSize = 256;
        source.connect(volumeAnalyser);

        const bufferLength = volumeAnalyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        const audioElement = document.querySelector('audio#audioStream');
        volumeHistory = [];
        lastAdjustedVolume = TARGET_VOLUME;

        function adjustVolume() {
            if (!settings.autoVolume || !volumeAnalyser || !audioElement) return;

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
            if (!volumeSlider) return;

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
        }

        function smoothTransition(slider, startValue, targetValue, audio) {
            const startTime = performance.now();
            function step(currentTime) {
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
    }

    // ### Голосовое управление
    async function initSpeechRecognition() {
        if (!('webkitSpeechRecognition' in window)) return;
        if (!micStream) await getMicStream();
        recognition = new webkitSpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = false;
        recognition.lang = 'ru-RU';

        recognition.onresult = (event) => {
            if (!isVoiceControlEnabled) return;
            const transcript = event.results[event.results.length - 1][0].transcript.trim().toLowerCase();
            if (VOICE_COMMANDS.skip.some(cmd => transcript.includes(cmd))) skipConversation();
            else if (VOICE_COMMANDS.stop.some(cmd => transcript.includes(cmd))) toggleAutoMode(false);
            else if (VOICE_COMMANDS.start.some(cmd => transcript.includes(cmd))) {
                toggleAutoMode(true);
                checkAndClickButton();
            }
        };

        recognition.onerror = (event) => {
            if (event.error !== 'aborted' && isVoiceControlEnabled) setTimeout(() => recognition.start(), 100);
        };

        recognition.onend = () => {
            if (isVoiceControlEnabled) setTimeout(() => recognition.start(), 100);
        };

        if (settings.voiceControl) {
            isVoiceControlEnabled = true;
            recognition.start();
            if (voiceHintElement) voiceHintElement.style.display = 'inline-block';
            setInterval(() => {
                if (isVoiceControlEnabled) {
                    recognition.stop();
                    setTimeout(() => recognition.start(), 200);
                }
            }, 10000);
        }
    }

    // ### UI элементы
    function createVoiceHints() {
        const wrapper = document.createElement('div');
        wrapper.className = 'voice-hint-wrapper';
        wrapper.style.cssText = `margin-left: 5px; display: ${isVoiceControlEnabled ? 'inline-block' : 'none'};`;
        const trigger = document.createElement('span');
        trigger.textContent = 'Подсказка';
        trigger.style.cssText = `font-size: 12px; color: #bbb; cursor: help; padding: 2px 5px; background: #444; border-radius: 5px; transition: color 0.2s ease;`;
        const content = document.createElement('div');
        content.style.cssText = `position: absolute; background: rgba(43, 43, 43, 0.95); color: #fff; padding: 8px; border-radius: 6px; box-shadow: 0 2px 10px rgba(0, 0, 0, 0.4); font-size: 11px; display: none; transform: translateY(5px); opacity: 0; transition: all 0.3s ease; z-index: 1000;`;
        content.innerHTML = `<b>Голосовые команды:</b><br><b>пропустить: </b>${VOICE_COMMANDS.skip.join('/')}<br><b>начать: </b>${VOICE_COMMANDS.start.join('/')}<br><b>остановить: </b>${VOICE_COMMANDS.stop.join('/')}`;

        wrapper.appendChild(trigger);
        wrapper.appendChild(content);

        trigger.addEventListener('mouseenter', () => {
            trigger.style.color = '#fff';
            content.style.display = 'block';
            setTimeout(() => { content.style.opacity = '1'; content.style.transform = 'translateY(0)'; }, 10);
        });
        trigger.addEventListener('mouseleave', () => {
            trigger.style.color = '#bbb';
            content.style.opacity = '0';
            content.style.transform = 'translateY(5px)';
            setTimeout(() => content.style.display = 'none', 300);
        });

        voiceHintElement = wrapper;
        return wrapper;
    }

    function createSettingsUI() {
        console.log('Создание UI настроек...');
        const container = document.createElement('div');
        container.id = 'settings-container';
        container.style.position = 'fixed';
        container.style.top = '20px';
        container.style.right = '20px';
        container.style.zIndex = '9999';
        container.style.background = 'linear-gradient(135deg, #2b2b2b, #1f1f1f)';
        container.style.padding = '20px';
        container.style.borderRadius = '15px';
        container.style.boxShadow = '0 5px 20px rgba(0, 0, 0, 0.7)';
        container.style.border = '2px solid #ff007a';
        container.style.width = '250px';
        container.style.color = '#fff';
        container.style.fontFamily = "'Segoe UI', Arial, sans-serif";
        container.style.transition = 'transform 0.3s ease';

        const header = document.createElement('h3');
        header.textContent = 'Настройки';
        header.style.margin = '0 0 15px';
        header.style.fontSize = '20px';
        header.style.color = '#ff007a';
        header.style.textAlign = 'center';
        header.style.textTransform = 'uppercase';
        header.style.letterSpacing = '2px';
        container.appendChild(header);

        const toggleWrapper = document.createElement('div');
        toggleWrapper.style.display = 'flex';
        toggleWrapper.style.alignItems = 'center';
        toggleWrapper.style.gap = '15px';
        toggleWrapper.style.marginBottom = '20px';

        const label = document.createElement('label');
        label.style.position = 'relative';
        label.style.display = 'inline-block';
        label.style.width = '70px';
        label.style.height = '34px';

        const toggleInput = document.createElement('input');
        toggleInput.type = 'checkbox';
        toggleInput.style.display = 'none';
        toggleInput.checked = isAutoModeEnabled;

        const slider = document.createElement('span');
        slider.className = 'slider';
        slider.style.position = 'absolute';
        slider.style.cursor = 'pointer';
        slider.style.top = '0';
        slider.style.left = '0';
        slider.style.right = '0';
        slider.style.bottom = '0';
        slider.style.background = isAutoModeEnabled ? '#00ff9d' : '#555';
        slider.style.transition = 'background 0.4s';
        slider.style.borderRadius = '34px';
        slider.style.boxShadow = 'inset 0 2px 5px rgba(0,0,0,0.5)';

        const sliderCircle = document.createElement('span');
        sliderCircle.className = 'slider-circle';
        sliderCircle.style.position = 'absolute';
        sliderCircle.style.height = '26px';
        sliderCircle.style.width = '26px';
        sliderCircle.style.left = isAutoModeEnabled ? '40px' : '4px';
        sliderCircle.style.bottom = '4px';
        sliderCircle.style.background = '#fff';
        sliderCircle.style.transition = 'left 0.4s';
        sliderCircle.style.borderRadius = '50%';
        sliderCircle.style.boxShadow = '0 2px 5px rgba(0,0,0,0.3)';

        slider.appendChild(sliderCircle);
        label.appendChild(toggleInput);
        label.appendChild(slider);

        const toggleLabel = document.createElement('span');
        toggleLabel.className = 'toggle-label';
        toggleLabel.textContent = `Авторежим ${isAutoModeEnabled ? 'ВКЛ' : 'ВЫКЛ'}`;
        toggleLabel.style.color = isAutoModeEnabled ? '#00ff9d' : '#ff4d4d';
        toggleLabel.style.fontSize = '16px';
        toggleLabel.style.fontWeight = 'bold';
        toggleLabel.style.textShadow = `0 0 5px ${isAutoModeEnabled ? '#00ff9d' : '#ff4d4d'}`;

        toggleWrapper.appendChild(label);
        toggleWrapper.appendChild(toggleLabel);
        container.appendChild(toggleWrapper);

        const audioSettings = document.createElement('div');
        audioSettings.style.display = 'flex';
        audioSettings.style.flexDirection = 'column';
        audioSettings.style.gap = '15px';

        function createToggle(labelText, key) {
            const div = document.createElement('div');
            const toggleDiv = document.createElement('div');
            toggleDiv.style.display = 'flex';
            toggleDiv.style.alignItems = 'center';
            toggleDiv.style.gap = '10px';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.style.appearance = 'none';
            checkbox.style.width = '20px';
            checkbox.style.height = '20px';
            checkbox.style.background = settings[key] ? '#00ff9d' : '#555';
            checkbox.style.borderRadius = '5px';
            checkbox.style.cursor = 'pointer';
            checkbox.style.transition = 'background 0.3s';
            checkbox.style.boxShadow = 'inset 0 2px 5px rgba(0,0,0,0.5)';
            checkbox.checked = settings[key];

            const labelSpan = document.createElement('span');
            labelSpan.textContent = labelText;
            labelSpan.style.fontSize = '14px';
            labelSpan.style.color = '#fff';
            labelSpan.style.fontWeight = 'bold';
            labelSpan.style.textShadow = '0 0 3px rgba(255,255,255,0.5)';

            toggleDiv.appendChild(checkbox);
            toggleDiv.appendChild(labelSpan);
            div.appendChild(toggleDiv);

            let volumeContainer = null;
            let pitchContainer = null;

            if (key === 'enableLoopback') {
                volumeContainer = document.createElement('div');
                volumeContainer.style.display = settings.enableLoopback ? 'block' : 'none';
                volumeContainer.style.marginTop = '10px';

                const volumeLabel = document.createElement('span');
                volumeLabel.textContent = `Громкость самопрослушивания: ${settings.gainValue.toFixed(1)}`;
                volumeLabel.style.fontSize = '14px';
                volumeLabel.style.color = '#fff';
                volumeLabel.style.fontWeight = 'bold';
                volumeLabel.style.textShadow = '0 0 3px rgba(255,255,255,0.5)';

                const volumeSlider = document.createElement('input');
                volumeSlider.type = 'range';
                volumeSlider.min = '0.1';
                volumeSlider.max = '3.0';
                volumeSlider.step = '0.1';
                volumeSlider.value = settings.gainValue;
                volumeSlider.style.width = '100%';
                volumeSlider.style.height = '8px';
                volumeSlider.style.background = `linear-gradient(to right, #ff007a ${((settings.gainValue - 0.1) / 2.9) * 100}%, #555 0%)`;
                volumeSlider.style.borderRadius = '5px';
                volumeSlider.style.outline = 'none';
                volumeSlider.style.cursor = 'pointer';
                volumeSlider.style.appearance = 'none';

                volumeContainer.appendChild(volumeLabel);
                volumeContainer.appendChild(volumeSlider);

                volumeSlider.addEventListener('input', () => {
                    settings.gainValue = parseFloat(volumeSlider.value);
                    volumeLabel.textContent = `Громкость самопрослушивания: ${settings.gainValue.toFixed(1)}`;
                    localStorage.setItem('gainValue', settings.gainValue);
                    if (gainNode) gainNode.gain.value = settings.gainValue;
                    volumeSlider.style.background = `linear-gradient(to right, #ff007a ${((settings.gainValue - 0.1) / 2.9) * 100}%, #555 0%)`;
                });
            }

            if (key === 'voicePitch') {
                pitchContainer = document.createElement('div');
                pitchContainer.style.display = settings.voicePitch ? 'block' : 'none';
                pitchContainer.style.marginTop = '10px';

                const pitchLabel = document.createElement('span');
                pitchLabel.textContent = `0 - обычный голос, 0.40 - очень низкий: ${settings.pitchLevel.toFixed(2)}`;
                pitchLabel.style.fontSize = '14px';
                pitchLabel.style.color = '#fff';
                pitchLabel.style.fontWeight = 'bold';
                pitchLabel.style.textShadow = '0 0 3px rgba(255,255,255,0.5)';

                const pitchSlider = document.createElement('input');
                pitchSlider.type = 'range';
                pitchSlider.min = '0';
                pitchSlider.max = '0.4';
                pitchSlider.step = '0.01';
                pitchSlider.value = settings.pitchLevel;
                pitchSlider.style.width = '100%';
                pitchSlider.style.height = '8px';
                pitchSlider.style.background = `linear-gradient(to right, #ff007a ${(settings.pitchLevel / 0.4) * 100}%, #555 0%)`;
                pitchSlider.style.borderRadius = '5px';
                pitchSlider.style.outline = 'none';
                pitchSlider.style.cursor = 'pointer';
                pitchSlider.style.appearance = 'none';

                pitchContainer.appendChild(pitchLabel);
                pitchContainer.appendChild(pitchSlider);

                pitchSlider.addEventListener('input', () => {
                    settings.pitchLevel = parseFloat(pitchSlider.value);
                    pitchLabel.textContent = `0 - обычный голос, 0.40 - очень низкий: ${settings.pitchLevel.toFixed(2)}`;
                    localStorage.setItem('pitchLevel', settings.pitchLevel);
                    updatePitchLevel(settings.pitchLevel);
                    pitchSlider.style.background = `linear-gradient(to right, #ff007a ${(settings.pitchLevel / 0.4) * 100}%, #555 0%)`;
                });
            }

            checkbox.addEventListener('change', () => {
                settings[key] = checkbox.checked;
                localStorage.setItem(key, JSON.stringify(checkbox.checked));
                checkbox.style.background = checkbox.checked ? '#00ff9d' : '#555';
                if (key === 'enableLoopback') {
                    if (checkbox.checked && globalStream) enableSelfListening(globalStream);
                    else if (audioContext) audioContext.close();
                    if (volumeContainer) volumeContainer.style.display = checkbox.checked ? 'block' : 'none';
                } else if (key === 'voiceControl') {
                    isVoiceControlEnabled = checkbox.checked;
                    if (voiceHintElement) voiceHintElement.style.display = checkbox.checked ? 'inline-block' : 'none';
                    if (checkbox.checked) {
                        if (!recognition) initSpeechRecognition();
                        recognition.start();
                    } else if (recognition) recognition.stop();
                } else if (key === 'autoVolume') {
                    if (checkbox.checked) {
                        const audio = document.querySelector('audio#audioStream');
                        if (audio && audio.srcObject) setupAutoVolume(audio.srcObject);
                    } else {
                        if (remoteAudioContext) remoteAudioContext.close();
                        if (volumeCheckIntervalId) clearInterval(volumeCheckIntervalId);
                    }
                } else if (key === 'voicePitch') {
                    updatePitchEffect(checkbox.checked);
                    if (pitchContainer) pitchContainer.style.display = checkbox.checked ? 'block' : 'none';
                }
            });

            if (key === 'voiceControl') div.appendChild(createVoiceHints());
            if (key === 'enableLoopback' && volumeContainer) div.appendChild(volumeContainer);
            if (key === 'voicePitch' && pitchContainer) div.appendChild(pitchContainer);
            return div;
        }

        audioSettings.appendChild(createToggle('Самопрослушивание', 'enableLoopback'));
        audioSettings.appendChild(createToggle('Автогромкость микрофона', 'autoGainControl'));
        audioSettings.appendChild(createToggle('Автогромкость собеседника', 'autoVolume'));
        audioSettings.appendChild(createToggle('Шумоподавление', 'noiseSuppression'));
        audioSettings.appendChild(createToggle('Эхоподавление', 'echoCancellation'));
        audioSettings.appendChild(createToggle('Низкий голос', 'voicePitch'));
        audioSettings.appendChild(createToggle('Голосовое управление', 'voiceControl'));

        container.appendChild(audioSettings);
        document.body.appendChild(container);

        const styleSheet = document.createElement('style');
        styleSheet.textContent = `
            input[type="range"]::-webkit-slider-thumb {
                appearance: none;
                width: 16px;
                height: 16px;
                background: #ff007a;
                border-radius: 50%;
                cursor: pointer;
                box-shadow: 0 0 5px #ff007a;
            }
        `;
        document.head.appendChild(styleSheet);

        container.addEventListener('mouseover', () => container.style.transform = 'scale(1.02)');
        container.addEventListener('mouseout', () => container.style.transform = 'scale(1)');
        toggleInput.addEventListener('change', (e) => toggleAutoMode(e.target.checked));

        console.log('UI настроек успешно добавлен в DOM');
    }

    // ### Инициализация
    function initObserver() {
        observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.addedNodes.length) {
                    checkAndClickButton();
                    const audio = document.querySelector('audio#audioStream');
                    if (audio && audio.srcObject && settings.autoVolume) setupAutoVolume(audio.srcObject);
                }
            });
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    navigator.mediaDevices.getUserMedia = ((original) => {
        return async (constraints) => {
            if (constraints?.audio) {
                constraints.audio = {
                    ...constraints.audio,
                    autoGainControl: settings.autoGainControl,
                    noiseSuppression: settings.noiseSuppression,
                    echoCancellation: settings.echoCancellation
                };
            }
            const stream = await original.call(navigator.mediaDevices, constraints);
            micStream = stream;
            const processedStream = await createPitchShiftedStream(stream);
            globalStream = processedStream;
            if (settings.enableLoopback) enableSelfListening(processedStream);
            return processedStream;
        };
    })(navigator.mediaDevices.getUserMedia);

    const originalSet = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'srcObject').set;
    Object.defineProperty(HTMLMediaElement.prototype, 'srcObject', {
        set: function(stream) {
            originalSet.call(this, stream);
            if (this.id === 'audioStream' && stream && settings.autoVolume) setupAutoVolume(stream);
        }
    });

    async function init() {
        console.log('Инициализация скрипта...');
        createSettingsUI();
        checkAndClickButton();
        initObserver();
        await initSpeechRecognition();
        console.log('Инициализация завершена');
    }

    window.addEventListener('load', () => {
        console.log('Страница загружена, запускаем init');
        init();
    });
})();
