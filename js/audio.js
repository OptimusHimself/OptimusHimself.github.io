/**
 * Omakase BGM 播放器 + 音效模块
 *
 * - BGM：硬编码歌单，顺序循环播放
 * - 音效：Web Audio API 程序化合成
 *
 * 添加新歌：把文件丢进 /audio/omakase/，并在下面 TRACKS 数组加一行
 *
 * 暴露全局：
 *   window.omakaseAudio = {
 *     playSelect()       // 选菜 - 清脆叮声
 *     playDeselect()     // 取消选菜 - 闷声
 *     playSubmit()       // 提交成功 - 厨房上菜铃
 *     togglePause()      // 播放/暂停
 *     playNext()         // 下一首
 *     playPrev()         // 上一首
 *     getCurrentTrack()  // 返回 { index, name } 或 null
 *     isPlaying()        // 返回 boolean
 *     onTrackChange(cb)  // 注册切歌回调
 *   }
 */
(function () {
  'use strict';

  if (!document.querySelector('.page-omakase')) return;

  /* ============================================================
   * BGM 歌单 — 在这里添加新歌
   * ============================================================ */
  var TRACKS = [
    
    '雨中舞.m4a',
    'fifty-year spun.m4a',
    'stay alone.m4a',
    '绝对占有，相对自由.m4a',
  ];

  var BASE = '/audio/omakase/';

  var bgmAudio = null;
  var currentIndex = -1;
  var pausedByUser = false;
  var trackChangeCallbacks = [];

  function url(s) {
    return BASE + encodeURI(s);
  }

  function displayName(filename) {
    return filename.replace(/\.[^.]+$/, '');
  }

  /* ============================================================
   * 播放控制
   * ============================================================ */
  function notifyTrackChange() {
    var info = getCurrentTrack();
    trackChangeCallbacks.forEach(function (cb) { cb(info); });
  }

  function playByIndex(idx) {
    if (!bgmAudio || !TRACKS.length) return;
    if (idx < 0) idx = TRACKS.length - 1;
    if (idx >= TRACKS.length) idx = 0;
    currentIndex = idx;
    bgmAudio.src = url(TRACKS[idx]);
    bgmAudio.play().catch(function () {});
    pausedByUser = false;
    notifyTrackChange();
  }

  function playEnded() {
    if (!bgmAudio || pausedByUser) return;
    playByIndex(currentIndex + 1);
  }

  function initBGM() {
    if (!TRACKS.length) return;

    bgmAudio = new Audio();
    bgmAudio.volume = 0.3;
    bgmAudio.loop = false;
    bgmAudio.addEventListener('ended', playEnded);

    // 从第一首开始
    playByIndex(0);

    // Autoplay 政策处理：第一次用户交互时恢复播放
    var firstInteraction = function () {
      if (bgmAudio.paused && !pausedByUser) {
        bgmAudio.play().catch(function () {});
      }
      document.removeEventListener('click', firstInteraction);
      document.removeEventListener('touchstart', firstInteraction);
      document.removeEventListener('keydown', firstInteraction);
    };
    if (bgmAudio.paused && bgmAudio.readyState === 0) {
      document.addEventListener('click', firstInteraction);
      document.addEventListener('touchstart', firstInteraction);
      document.addEventListener('keydown', firstInteraction);
    }
  }

  /* ============================================================
   * 播放器 API
   * ============================================================ */
  function togglePause() {
    if (!bgmAudio) return;
    if (bgmAudio.paused) {
      pausedByUser = false;
      bgmAudio.play().catch(function () {});
    } else {
      pausedByUser = true;
      bgmAudio.pause();
    }
  }

  function playNext() {
    if (!bgmAudio || !TRACKS.length) return;
    pausedByUser = false;
    playByIndex(currentIndex + 1);
  }

  function playPrev() {
    if (!bgmAudio || !TRACKS.length) return;
    pausedByUser = false;
    playByIndex(currentIndex - 1);
  }

  function getCurrentTrack() {
    if (currentIndex < 0 || currentIndex >= TRACKS.length) return null;
    return {
      index: currentIndex,
      name: displayName(TRACKS[currentIndex]),
    };
  }

  function isPlaying() {
    return bgmAudio && !bgmAudio.paused;
  }

  function onTrackChange(cb) {
    if (typeof cb === 'function') {
      trackChangeCallbacks.push(cb);
    }
  }

  /* ============================================================
   * 音效 — Web Audio API 合成
   * ============================================================ */
  var audioCtx = null;

  function getCtx() {
    if (!audioCtx) {
      try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) {
        return null;
      }
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  function playTone(freq, duration, volume, type, startOffset) {
    var ctx = getCtx();
    if (!ctx) return;
    var t = startOffset || ctx.currentTime;
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(volume || 0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + duration);
  }

  function playSelect() {
    playTone(880, 0.15, 0.25);
  }

  function playDeselect() {
    playTone(220, 0.12, 0.2, 'triangle');
  }

  function playSubmit() {
    var ctx = getCtx();
    if (!ctx) return;
    var t = ctx.currentTime;
    var bellFreqs = [1500, 1600, 1400, 1550];
    bellFreqs.forEach(function (freq, i) {
      playTone(freq, 0.05, 0.15, 'sine', t + i * 0.07);
    });
    playTone(1200, 0.12, 0.12, 'sine', t + 0.32);
    playTone(400, 0.08, 0.10, 'triangle', t + 0.42);
  }

  /* ============================================================
   * 初始化
   * ============================================================ */
  initBGM();

  window.omakaseAudio = {
    playSelect: playSelect,
    playDeselect: playDeselect,
    playSubmit: playSubmit,
    togglePause: togglePause,
    playNext: playNext,
    playPrev: playPrev,
    getCurrentTrack: getCurrentTrack,
    isPlaying: isPlaying,
    onTrackChange: onTrackChange,

    // 别名（供 omakase.js 调用）
    togglePlay: togglePause,
    prev: playPrev,
    next: playNext,
    pause: function () {
      pausedByUser = true;
      if (bgmAudio) bgmAudio.pause();
    },
    getTrackName: function () {
      var t = getCurrentTrack();
      return t ? t.name : null;
    },
  };
})();