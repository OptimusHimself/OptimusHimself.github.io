/**
 * Omakase BGM 播放器 + 音效模块
 *
 * - BGM：从 /audio/omakase/playlist.json 加载歌单，顺序循环播放
 * - 音效：Web Audio API 程序化合成
 *
 * 暴露全局：
 *   window.omakaseAudio = {
 *     // 音效
 *     playSelect()       // 选菜 - 清脆叮声
 *     playDeselect()     // 取消选菜 - 闷声
 *     playSubmit()       // 提交成功 - 厨房上菜铃
 *
 *     // 播放器控制
 *     togglePause()      // 播放/暂停
 *     playNext()         // 下一首
 *     playPrev()         // 上一首
 *     getCurrentTrack()  // 返回 { index, name } 或 null
 *     isPlaying()        // 返回 boolean
 *     onTrackChange(cb)  // 注册切歌回调
 *     ready(cb)          // 歌单加载完成后调用 cb
 *   }
 */
(function () {
  'use strict';

  if (!document.querySelector('.page-omakase')) return;

  /* ============================================================
   * BGM — 顺序循环播放器
   * ============================================================ */
  var PLAYLIST_URL = '/audio/omakase/playlist.json';

  var trackList = [];        // 完整歌单 [{ src, name }]
  var bgmAudio = null;
  var currentIndex = -1;
  var pausedByUser = false;
  var trackChangeCallbacks = [];
  var readyCallbacks = [];
  var isReady = false;

  /* ============================================================
   * 加载歌单
   * ============================================================ */
  function loadPlaylist(callback) {
    if (trackList.length > 0) {
      if (callback) callback();
      return;
    }

    var xhr = new XMLHttpRequest();
    xhr.open('GET', PLAYLIST_URL, true);
    xhr.responseType = 'json';
    xhr.onload = function () {
      if (xhr.status === 200 && Array.isArray(xhr.response)) {
        trackList = xhr.response;
      } else {
        trackList = [];
      }
      isReady = true;
      readyCallbacks.forEach(function (cb) { cb(); });
      readyCallbacks = [];
      if (callback) callback();
    };
    xhr.onerror = function () {
      trackList = [];
      isReady = true;
      readyCallbacks.forEach(function (cb) { cb(); });
      readyCallbacks = [];
      if (callback) callback();
    };
    xhr.send();
  }

  function onReady(cb) {
    if (isReady) {
      cb();
    } else {
      readyCallbacks.push(cb);
    }
  }

  /* ============================================================
   * 播放控制
   * ============================================================ */
  function notifyTrackChange() {
    var info = getCurrentTrack();
    trackChangeCallbacks.forEach(function (cb) { cb(info); });
  }

  function playByIndex(idx) {
    if (!bgmAudio || !trackList.length) return;
    if (idx < 0) idx = trackList.length - 1;
    if (idx >= trackList.length) idx = 0;
    currentIndex = idx;
    bgmAudio.src = trackList[idx].src;
    bgmAudio.play().catch(function () {});
    pausedByUser = false;
    notifyTrackChange();
  }

  function playEnded() {
    // 自动下一首
    if (!bgmAudio || pausedByUser) return;
    var next = currentIndex + 1;
    if (next >= trackList.length) next = 0;
    playByIndex(next);
  }

  function initBGM(callback) {
    loadPlaylist(function () {
      if (!trackList.length) return;

      bgmAudio = new Audio();
      bgmAudio.volume = 0.3;
      bgmAudio.loop = false;
      bgmAudio.addEventListener('ended', playEnded);

      // 从第一首开始
      playByIndex(0);

      // Autoplay 政策处理
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

      if (callback) callback();
    });
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
    if (!bgmAudio || !trackList.length) return;
    pausedByUser = false;
    var next = currentIndex + 1;
    if (next >= trackList.length) next = 0;
    playByIndex(next);
  }

  function playPrev() {
    if (!bgmAudio || !trackList.length) return;
    pausedByUser = false;
    var prev = currentIndex - 1;
    if (prev < 0) prev = trackList.length - 1;
    playByIndex(prev);
  }

  function getCurrentTrack() {
    if (currentIndex < 0 || currentIndex >= trackList.length) return null;
    return {
      index: currentIndex,
      name: trackList[currentIndex].name,
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

  /** 播放一个简单音调 */
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

  /** 选菜 - 清脆 "叮" */
  function playSelect() {
    playTone(880, 0.15, 0.25);
  }

  /** 取消选菜 - 闷 "咔" */
  function playDeselect() {
    playTone(220, 0.12, 0.2, 'triangle');
  }

  /**
   * 提交成功 - 厨房上菜铃 🛎️
   * 模拟厨师快速按服务铃：4~5声清脆高频短铃 + 一声低沉收尾
   */
  function playSubmit() {
    var ctx = getCtx();
    if (!ctx) return;
    var t = ctx.currentTime;

    // 4 声快速清脆铃音 (高频短促)
    var bellFreqs = [1500, 1600, 1400, 1550];
    bellFreqs.forEach(function (freq, i) {
      playTone(freq, 0.05, 0.15, 'sine', t + i * 0.07);
    });

    // 第 5 声稍长一点，带点余韵
    playTone(1200, 0.12, 0.12, 'sine', t + 0.32);

    // 低声收尾 — 模拟铃座落下的 "哒"
    playTone(400, 0.08, 0.10, 'triangle', t + 0.42);
  }

  /* ============================================================
   * 初始化 — 异步加载歌单
   * ============================================================ */
  initBGM();

  window.omakaseAudio = {
    // 音效
    playSelect: playSelect,
    playDeselect: playDeselect,
    playSubmit: playSubmit,

    // 播放器
    togglePause: togglePause,
    playNext: playNext,
    playPrev: playPrev,
    getCurrentTrack: getCurrentTrack,
    isPlaying: isPlaying,
    onTrackChange: onTrackChange,
    ready: onReady,

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