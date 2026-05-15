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
      } else {
        orderList.add(dish);
        this.classList.add('selected');
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
   * 5. 提交按钮 — 调阿里云 FC → PushPlus
   * ============================================================ */
  if (submitBtn) {
    submitBtn.addEventListener('click', async function () {
      var dishes = Array.from(orderList).join('\u3001');
      var nickname =
        (nicknameInput ? nicknameInput.value.trim() : '') || '\u533F\u540D\u98DF\u5BA2';

      var btn = this;
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
          alert('\u2705 \u70B9\u83DC\u6210\u529F\uFF01\u8001\u677F\u5DF2\u6536\u5230~');
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

  /* ============================================================
   * 6. 初始化渲染
   * ============================================================ */
  renderOrderPopup();
})();