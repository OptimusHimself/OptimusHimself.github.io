/**
 * Omakase 点菜交互 — 独立 JS 文件 (替代内联 script)
 *
 * 在 index.md 中引用：通过 Fluid 的 custom_js 配置全局加载，
 * 通过 .page-omakase 选择器限定只在 Omakase 页面执行。
 */
(function () {
  'use strict';

  /* ============================================================
   * 只在 Omakase 页面执行
   * ============================================================ */
  if (!document.querySelector('.page-omakase')) return;

  /* ============================================================
   * 常量
   * ============================================================ */
  var FC_URL = 'https://pushplu-forward-stlhtyowoa.cn-hangzhou.fcapp.run';

  /* ============================================================
   * 状态
   * ============================================================ */
  var orderList = new Set();

  /* ============================================================
   * DOM 引用（由 index.md 提供对应的 HTML 元素）
   * ============================================================ */
  var orderSidebar = document.getElementById('orderSidebar');
  var orderOverlay = document.getElementById('orderOverlay');
  var cartFloatBtn = document.getElementById('cartFloatBtn');
  var orderCountBadge = document.getElementById('orderCount');
  var orderCountHeader = document.getElementById('orderCountHeader');
  var orderListEl = document.getElementById('orderList');
  var nicknameInput = document.getElementById('nicknameInput');
  var submitBtn = document.getElementById('submitBtn');
  var clearBtn = document.getElementById('clearBtn');
  var confirmBox = document.getElementById('confirmBox');
  var confirmYes = document.getElementById('confirmYes');
  var confirmNo = document.getElementById('confirmNo');

  /* 音乐控制 */
  var musicFloatBtn = document.getElementById('musicFloatBtn');
  var musicPanel = document.getElementById('musicPanel');
  var musicPlayBtn = document.getElementById('musicPlayBtn');
  var musicPrevBtn = document.getElementById('musicPrevBtn');
  var musicNextBtn = document.getElementById('musicNextBtn');
  var musicTrackName = document.getElementById('musicTrackName');

  /* ============================================================
   * 1. 卡片点击 — 选菜 / 取消
   * ============================================================ */
  document.querySelectorAll('.menu-card').forEach(function (card) {
    card.addEventListener('click', function (e) {
      // 点滑动圆点或 label 时不触发
      if (e.target.closest('.swipe-dots') || e.target.closest('label')) return;

      var titleEl = this.querySelector('.menu-card-title');
      if (!titleEl) return;

      var dish = titleEl.textContent.trim();

      if (orderList.has(dish)) {
        orderList['delete'](dish);
        this.classList.remove('selected');
        if (window.omakaseAudio) window.omakaseAudio.playDeselect();
      } else {
        orderList.add(dish);
        this.classList.add('selected');
        if (window.omakaseAudio) window.omakaseAudio.playSelect();
      }

      renderOrderPopup();
    });
  });

  /* ============================================================
   * 2. 渲染弹窗内容
   * ============================================================ */
  function renderOrderPopup() {
    var items = Array.from(orderList);
    var count = items.length;

    // 角标
    if (orderCountBadge) orderCountBadge.textContent = count;
    if (orderCountHeader) orderCountHeader.textContent = count;

    // 列表
    if (!orderListEl) return;

    if (count === 0) {
      orderListEl.innerHTML =
        '<div class="order-sidebar-empty">还没有选菜哦 🍜</div>';
      if (submitBtn) submitBtn.disabled = true;
    } else {
      orderListEl.innerHTML = items
        .map(function (n) {
          return '<div class="order-sidebar-item">' + n + '</div>';
        })
        .join('');
      if (submitBtn) submitBtn.disabled = false;
    }

    // 隐藏确认区（选菜变化时重置状态）
    if (confirmBox) confirmBox.style.display = 'none';
  }

  /* ============================================================
   * 3. 打开 / 关闭弹窗
   * ============================================================ */
  function openPopup() {
    if (orderSidebar) orderSidebar.classList.add('show');
    if (orderOverlay) orderOverlay.classList.add('show');
  }

  function closePopup() {
    if (orderSidebar) orderSidebar.classList.remove('show');
    if (orderOverlay) orderOverlay.classList.remove('show');
    // 关闭弹窗时隐藏确认区
    if (confirmBox) confirmBox.style.display = 'none';
  }

  // 点击浮动按钮 → 打开
  if (cartFloatBtn) {
    cartFloatBtn.addEventListener('click', openPopup);
  }

  // 点击遮罩 → 关闭
  if (orderOverlay) {
    orderOverlay.addEventListener('click', closePopup);
  }

  /* ============================================================
   * 4. 清空按钮
   * ============================================================ */
  if (clearBtn) {
    clearBtn.addEventListener('click', function () {
      orderList.clear();
      document.querySelectorAll('.menu-card.selected').forEach(function (c) {
        c.classList.remove('selected');
      });
      renderOrderPopup();
    });
  }

  /* ============================================================
   * 5. 提交按钮 — 先确认，再调阿里云 FC → PushPlus
   * ============================================================ */
  if (submitBtn) {
    submitBtn.addEventListener('click', function () {
      // 显示确认区，等待用户选择
      if (confirmBox) confirmBox.style.display = 'block';
    });
  }

  /* ============================================================
   * 6. 确认区按钮
   * ============================================================ */
  if (confirmYes) {
    confirmYes.addEventListener('click', async function () {
      // 🛎️ 客人确认点菜 — 响厨房铃
      if (window.omakaseAudio) window.omakaseAudio.playSubmit();
      // 隐藏确认区
      if (confirmBox) confirmBox.style.display = 'none';

      var dishes = Array.from(orderList).join('\u3001');
      var nickname =
        (nicknameInput ? nicknameInput.value.trim() : '') || '\u533F\u540D\u98DF\u5BA2';

      var btn = submitBtn;
      if (!btn) return;
      btn.disabled = true;
      btn.textContent = '\u23F3 \u53D1\u9001\u4E2D...';

      try {
        var r = await fetch(FC_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dishes: dishes, nickname: nickname }),
        });
        var d = await r.json();

        if (d.code === 200) {
          alert('✅ 点菜成功！老板已收到~');
          orderList.clear();
          document.querySelectorAll('.menu-card.selected').forEach(function (c) {
            c.classList.remove('selected');
          });
          renderOrderPopup();
          if (nicknameInput) nicknameInput.value = '';
          closePopup();
        } else {
          alert('\u274C \u53D1\u9001\u5931\u8D25: ' + (d.msg || '\u672A\u77E5\u9519\u8BEF'));
        }
      } catch (_) {
        alert('\u274C \u7F51\u7EDC\u9519\u8BEF\uFF0C\u8BF7\u7A0D\u540E\u518D\u8BD5');
      } finally {
        btn.disabled = false;
        btn.textContent = '\uD83D\uDCE4 \u63D0\u4EA4\u70B9\u83DC';
      }
    });
  }

  if (confirmNo) {
    confirmNo.addEventListener('click', function () {
      // 隐藏确认区，不提交
      if (confirmBox) confirmBox.style.display = 'none';
    });
  }

  /* ============================================================
   * 7. 音乐播放器控制
   * ============================================================ */
  if (musicFloatBtn) {
    musicFloatBtn.addEventListener('click', function () {
      if (musicPanel) {
        // 只展开/收起面板，不播放/暂停
        musicPanel.classList.toggle('visible');
        // 如果 audio 还没加载，动态加载 audio.js
        if (!window.omakaseAudio) {
          var s = document.createElement('script');
          s.src = '/js/audio.js';
          s.onload = function () {
            if (window.omakaseAudio) updateMusicUI();
          };
          document.head.appendChild(s);
        }
      }
    });
  }

  if (musicPlayBtn) {
    musicPlayBtn.addEventListener('click', function () {
      if (window.omakaseAudio) {
        window.omakaseAudio.togglePlay();
        updateMusicUI();
      }
    });
  }

  if (musicPrevBtn) {
    musicPrevBtn.addEventListener('click', function () {
      if (window.omakaseAudio) {
        window.omakaseAudio.prev();
        updateMusicUI();
      }
    });
  }

  if (musicNextBtn) {
    musicNextBtn.addEventListener('click', function () {
      if (window.omakaseAudio) {
        window.omakaseAudio.next();
        updateMusicUI();
      }
    });
  }

  function updateMusicUI() {
    if (!window.omakaseAudio || !musicPlayBtn || !musicTrackName) return;
    musicPlayBtn.textContent = window.omakaseAudio.isPlaying() ? '⏸' : '▶️';
    musicTrackName.textContent = window.omakaseAudio.getTrackName() || '—';
  }

  /* ============================================================
   * 8. 初始化渲染
   * ============================================================ */
  renderOrderPopup();

  // 等待 audio.js 加载完毕
  if (window.omakaseAudio) {
    updateMusicUI();
  } else {
    var checkAudio = setInterval(function () {
      if (window.omakaseAudio) {
        updateMusicUI();
        clearInterval(checkAudio);
      }
    }, 200);
  }
})();