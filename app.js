// 主应用 (ES5 兼容,无箭头函数/无 const/let/无模板字符串)
(function () {
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  var VIEWS = ['home', 'scan', 'detail', 'manage', 'form'];
  function showView(name) {
    for (var i = 0; i < VIEWS.length; i++) {
      var el = document.querySelector('[data-view="' + VIEWS[i] + '"]');
      if (el) el.hidden = (VIEWS[i] !== name);
    }
    window.scrollTo(0, 0);
    if (name !== 'scan') stopScanCamera();
  }

  var toastTimer = null;
  function toast(msg, ms) {
    var el = $('#toast');
    if (!el) return;
    el.textContent = msg;
    el.hidden = false;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.hidden = true; }, ms || 1800);
  }

  var mainScanner = null;
  var modalScanner = null;
  function stopScanCamera() {
    if (mainScanner) try { mainScanner.stop(); } catch (e) {}
  }
  function stopModalScan() {
    if (modalScanner) try { modalScanner.stop(); } catch (e) {}
    var m = $('#modal-scan');
    if (m) m.hidden = true;
  }

  var countdownTimer = null;
  var countdownRemain = 0;
  function startCountdown(sec) {
    if (countdownTimer) clearInterval(countdownTimer);
    countdownRemain = sec || 4;
    var txt = $('#countdown-text');
    if (!txt) return;
    txt.textContent = countdownRemain + '秒后自动返回首页';
    countdownTimer = setInterval(function () {
      countdownRemain -= 1;
      if (countdownRemain <= 0) {
        clearInterval(countdownTimer);
        showView('home');
      } else {
        txt.textContent = countdownRemain + '秒后自动返回首页';
      }
    }, 1000);
  }
  function stopCountdown() {
    if (countdownTimer) clearInterval(countdownTimer);
  }

  function renderManage() {
    var list = Storage.list();
    var wrap = $('#manage-list');
    var empty = $('#manage-empty');
    if (!wrap) return;
    wrap.innerHTML = '';
    if (!list.length) {
      wrap.hidden = true;
      if (empty) empty.hidden = false;
      return;
    }
    wrap.hidden = false;
    if (empty) empty.hidden = true;
    for (var i = 0; i < list.length; i++) {
      (function (p) {
        var el = document.createElement('div');
        el.className = 'manage-item';
        el.innerHTML =
          '<div class="manage-item-info">' +
            '<div class="manage-item-name"></div>' +
            '<div class="manage-item-barcode"></div>' +
          '</div>' +
          '<div class="manage-item-price">¥<span class="p-price"></span></div>' +
          '<div class="manage-item-actions">' +
            '<button class="ic-edit" aria-label="编辑">' +
              '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M3 17.25V21h3.75l11-11.04-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>' +
            '</button>' +
            '<button class="ic-delete" aria-label="删除">' +
              '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M6 7h12v13a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V7zm3-3h6a1 1 0 0 1 1 1v1H8V5a1 1 0 0 1 1-1zM4 5h16v2H4z"/></svg>' +
            '</button>' +
          '</div>';
        el.querySelector('.manage-item-name').textContent = p.name || '(未命名)';
        el.querySelector('.manage-item-barcode').textContent = p.barcode || '--';
        el.querySelector('.p-price').textContent = Number(p.price || 0).toFixed(2);
        el.querySelector('.ic-edit').addEventListener('click', function (e) {
          e.stopPropagation();
          openForm(p.id);
        });
        el.querySelector('.ic-delete').addEventListener('click', function (e) {
          e.stopPropagation();
          if (window.confirm('确定要删除「' + (p.name || p.barcode) + '」吗?')) {
            Storage.remove(p.id);
            renderManage();
            toast('已删除');
          }
        });
        el.addEventListener('click', function (e) {
          if (e.target.closest && (e.target.closest('.ic-edit') || e.target.closest('.ic-delete'))) return;
          showDetail(p);
        });
        wrap.appendChild(el);
      })(list[i]);
    }
  }

  function showDetail(product) {
    stopCountdown();
    var n = $('#detail-name'); if (n) n.textContent = product.name || '(未命名)';
    var pr = $('#detail-price'); if (pr) pr.textContent = Number(product.price || 0).toFixed(2);
    var bc = $('#detail-barcode'); if (bc) bc.textContent = product.barcode || '--';
    var imgWrap = $('#detail-img');
    if (imgWrap) {
      imgWrap.innerHTML = '';
      if (product.image) {
        var img = document.createElement('img');
        img.src = product.image;
        img.alt = product.name || '';
        imgWrap.appendChild(img);
      } else {
        var span = document.createElement('span');
        span.className = 'detail-img-empty';
        span.textContent = '暂无图片';
        imgWrap.appendChild(span);
      }
    }
    showView('detail');
    startCountdown(4);
  }

  function handleScanResult(barcode) {
    var p = Storage.getByBarcode(barcode);
    if (p) {
      showDetail(p);
    } else {
      stopScanCamera();
      if (window.confirm('未找到条码为「' + barcode + '」的商品,是否现在添加?')) {
        openForm(null, { barcode: barcode });
      } else {
        startMainScan();
      }
    }
  }

  function startMainScan() {
    var supported = false;
    try { supported = window.ScannerSupported === true; } catch (e) {}
    if (!supported) {
      try {
        if (window.Scanner && typeof Scanner.isSupported === 'function') {
          supported = Scanner.isSupported();
        }
      } catch (e) {}
    }
    if (!supported) {
      toast('当前浏览器不支持摄像头扫码', 2200);
      promptManualBarcode();
      return;
    }
    showView('scan');
    var video = $('#scan-video');
    if (!video) return;
    mainScanner = new Scanner(video, {
      onDetect: function (v) { try { mainScanner.stop(); } catch (e) {} handleScanResult(v); },
      onError: function (msg) { toast(msg, 2500); }
    });
    mainScanner.start();
  }

  function promptManualBarcode() {
    var code = window.prompt('请输入商品条形码');
    if (code && code.trim()) handleScanResult(code.trim());
  }

  function openFormModalScan() {
    var modal = $('#modal-scan');
    if (!modal) return;
    modal.hidden = false;
    var video = $('#modal-video');
    if (!video) return;
    modalScanner = new Scanner(video, {
      onDetect: function (v) {
        try { modalScanner.stop(); } catch (e) {}
        var m = $('#modal-scan'); if (m) m.hidden = true;
        var b = $('#f-barcode'); if (b) b.value = v;
        toast('已识别条码: ' + v);
      },
      onError: function (msg) { toast(msg, 2500); }
    });
    modalScanner.start();
  }

  var editingId = null;
  function openForm(id, prefill) {
    editingId = id || null;
    prefill = prefill || {};
    var f = $('#product-form');
    if (f) f.reset();
    var pv = $('#f-image-preview');
    if (pv) { pv.hidden = true; pv.src = ''; }
    var ph = $('#f-image-placeholder');
    if (ph) ph.hidden = false;
    var title = $('#form-title');
    if (title) title.textContent = id ? '编辑商品' : '添加商品';

    if (id) {
      var p = Storage.getById(id);
      if (p) {
        var fi = $('#f-id'); if (fi) fi.value = p.id;
        var fb = $('#f-barcode'); if (fb) fb.value = p.barcode || '';
        var fn = $('#f-name'); if (fn) fn.value = p.name || '';
        var fp = $('#f-price'); if (fp) fp.value = p.price || '';
        var fs = $('#f-spec'); if (fs) fs.value = p.spec || '';
        if (p.image && pv) {
          pv.src = p.image;
          pv.hidden = false;
          if (ph) ph.hidden = true;
        }
      }
    } else {
      var fid = $('#f-id'); if (fid) fid.value = '';
      if (prefill.barcode) { var fb2 = $('#f-barcode'); if (fb2) fb2.value = prefill.barcode; }
    }
    showView('form');
  }

  function submitForm(e) {
    e.preventDefault();
    var data = {
      id: ($('#f-id') && $('#f-id').value) || undefined,
      barcode: ($('#f-barcode') && $('#f-barcode').value || '').trim(),
      name: ($('#f-name') && $('#f-name').value || '').trim(),
      price: parseFloat($('#f-price') && $('#f-price').value) || 0,
      spec: ($('#f-spec') && $('#f-spec').value || '').trim(),
      image: ($('#f-image-preview') && $('#f-image-preview').src) || ''
    };
    if (!data.barcode) { toast('请输入条形码'); return; }
    if (!data.name) { toast('请输入商品名称'); return; }
    if (data.price < 0) { toast('价格不能为负'); return; }
    var res = Storage.upsert(data);
    if (res.conflict) {
      toast('该条形码已存在: ' + res.item.name);
      return;
    }
    toast('保存成功');
    editingId = null;
    renderManage();
    showView('manage');
  }

  function bindImageUpload() {
    var input = $('#f-image');
    if (!input) return;
    input.addEventListener('change', function (e) {
      var file = e.target.files && e.target.files[0];
      if (!file) return;
      if (file.size > 2 * 1024 * 1024) {
        toast('图片过大,请选择 2MB 以内');
        input.value = '';
        return;
      }
      var reader = new FileReader();
      reader.onload = function () {
        var dataUrl = reader.result;
        var img = new Image();
        img.onload = function () {
          var max = 800;
          var w = img.width, h = img.height;
          if (w > h && w > max) { h = h * max / w; w = max; }
          else if (h > max) { w = w * max / h; h = max; }
          var canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          var ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          var out = canvas.toDataURL('image/jpeg', 0.82);
          var pv = $('#f-image-preview');
          if (pv) { pv.src = out; pv.hidden = false; }
          var ph = $('#f-image-placeholder');
          if (ph) ph.hidden = true;
        };
        img.src = dataUrl;
      };
      reader.readAsDataURL(file);
    });
  }

  function bindEvents() {
    var bs = $('#btn-scan');
    if (bs) bs.addEventListener('click', startMainScan);
    var bm = $('#btn-manage');
    if (bm) bm.addEventListener('click', function () {
      renderManage();
      showView('manage');
    });

    var backs = $$('[data-back]');
    for (var i = 0; i < backs.length; i++) {
      backs[i].addEventListener('click', function () { showView('home'); });
    }

    var bmi = $('#btn-manual-input');
    if (bmi) bmi.addEventListener('click', promptManualBarcode);

    var ba = $('#btn-add');
    if (ba) ba.addEventListener('click', function () { openForm(null); });

    var pf = $('#product-form');
    if (pf) pf.addEventListener('submit', submitForm);

    var fst = $('#f-scan-trigger');
    if (fst) fst.addEventListener('click', openFormModalScan);

    var msc = $('#modal-scan-close');
    if (msc) msc.addEventListener('click', stopModalScan);

    bindImageUpload();

    var bv = $('#btn-voice');
    if (bv) bv.addEventListener('click', function () {
      var name = $('#detail-name') ? $('#detail-name').textContent : '';
      var price = $('#detail-price') ? $('#detail-price').textContent : '';
      var ok = Speech.speak('商品 ' + name + ',价格 ' + price + ' 元');
      if (ok) toast('播报中...');
      else toast('当前环境不支持语音播报');
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      Storage.seedIfEmpty();
      bindEvents();
      showView('home');
    });
  } else {
    Storage.seedIfEmpty();
    bindEvents();
    showView('home');
  }
})();
