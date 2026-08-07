// 扫码模块 (ES5 兼容)
// 优先用原生 BarcodeDetector(Chrome/Edge/新版 Android)
// 不支持时降级到 ZXing(iOS Safari / 旧浏览器)
(function (global) {
  var hasNative = ('BarcodeDetector' in window);
  var NATIVE_FORMATS = ['ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e', 'qr_code'];

  // ZXing 在 window 上的命名空间
  function getZXing() {
    return window.ZXing || null;
  }

  // 把原生 format 名映射到 ZXing format
  function pickZXingFormats() {
    var ZX = getZXing();
    if (!ZX || !ZX.BarcodeFormat) return null;
    var f = ZX.BarcodeFormat;
    return [
      f.EAN_13, f.EAN_8, f.CODE_128, f.CODE_39,
      f.UPC_A, f.UPC_E, f.QR_CODE, f.ITF,
      f.CODE_93, f.CODABAR, f.DATA_MATRIX, f.AZTEC, f.PDF_417
    ];
  }

  function Scanner(videoEl, opts) {
    opts = opts || {};
    this.video = videoEl;
    this.stream = null;
    this.running = false;
    this.onDetect = opts.onDetect || function () {};
    this.onError = opts.onError || function () {};
    this._engine = hasNative ? 'native' : 'zxing';
    this._rafId = null;
    this._nativeDetector = null;
    this._zxingReader = null;
    this._zxingControls = null;
    this._lastValue = '';
    this._lastTime = 0;
  }

  Scanner.prototype.isSupported = function () {
    if (hasNative) return true;
    if (getZXing()) return true;
    return false;
  };

  Scanner.prototype._getError = function (msg) {
    this.onError(msg);
  };

  Scanner.prototype.start = function () {
    var self = this;
    if (self.running) return;
    if (!self.isSupported()) {
      self._getError('当前浏览器不支持扫码,请使用 Chrome / Edge / Safari 最新版,或手动输入条码');
      return;
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      self._getError('当前环境无法访问摄像头');
      return;
    }

    navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' } },
      audio: false
    }).then(function (stream) {
      self.stream = stream;
      self.video.srcObject = stream;
      return self.video.play();
    }).then(function () {
      if (self._engine === 'native') {
        try {
          self._nativeDetector = new window.BarcodeDetector({ formats: NATIVE_FORMATS });
          self.running = true;
          self._loopNative();
        } catch (e) {
          // 原生初始化失败,降级 ZXing
          self._engine = 'zxing';
          self._startZXing();
        }
      } else {
        self._startZXing();
      }
    }).catch(function (e) {
      var name = (e && e.name) || '';
      var msg = (e && e.message) || String(e);
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        self._getError('您拒绝了摄像头权限,请在浏览器设置中允许后刷新');
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        self._getError('未检测到摄像头');
      } else if (name === 'NotReadableError' || name === 'TrackStartError') {
        self._getError('摄像头被其他应用占用');
      } else {
        self._getError('无法访问摄像头: ' + msg);
      }
    });
  };

  Scanner.prototype._startZXing = function () {
    var self = this;
    var ZX = getZXing();
    if (!ZX || !ZX.BrowserMultiFormatReader) {
      self._getError('扫码库加载失败');
      return;
    }
    try {
      var formats = pickZXingFormats();
      var hints = formats ? new Map([[ZX.DecodeHintType.POSSIBLE_FORMATS, formats]]) : null;
      self._zxingReader = new ZX.BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 200 });
      self.running = true;
      self._zxingReader.decodeFromVideoElement(self.video, function (result, err) {
        if (!self.running) return;
        if (result) {
          var value = result.getText ? result.getText() : (result.text || '');
          if (!value) return;
          var now = Date.now();
          if (value === self._lastValue && now - self._lastTime < 1500) return;
          self._lastValue = value;
          self._lastTime = now;
          self.running = false;
          self.onDetect(value);
        }
        // err 是 ZXing 内部的"未识别"提示,忽略
      });
    } catch (e) {
      self._getError('扫码初始化失败: ' + (e && e.message || e));
    }
  };

  Scanner.prototype._loopNative = function () {
    var self = this;
    if (!self.running) return;
    self._rafId = requestAnimationFrame(function () {
      if (!self.running) return;
      if (!self._nativeDetector) { self._loopNative(); return; }
      self._nativeDetector.detect(self.video).then(function (codes) {
        if (!self.running) return;
        if (codes && codes.length) {
          var value = codes[0].rawValue;
          var now = Date.now();
          if (value === self._lastValue && now - self._lastTime < 1500) {
            self._loopNative();
            return;
          }
          self._lastValue = value;
          self._lastTime = now;
          self.running = false;
          self.onDetect(value);
          return;
        }
        self._loopNative();
      }).catch(function () {
        self._loopNative();
      });
    });
  };

  Scanner.prototype.stop = function () {
    this.running = false;
    if (this._rafId) cancelAnimationFrame(this._rafId);
    this._rafId = null;

    // ZXing 的 reader 没有显式 stop,需要通过 controls 停止
    if (this._zxingReader && this._zxingReader.reset) {
      try { this._zxingReader.reset(); } catch (e) {}
    }

    if (this.stream) {
      try {
        var tracks = this.stream.getTracks();
        for (var i = 0; i < tracks.length; i++) tracks[i].stop();
      } catch (e) {}
      this.stream = null;
    }
    this.video.srcObject = null;
  };

  global.Scanner = Scanner;
  global.ScannerSupported = true; // 有 ZXing 兜底,所以基本都支持
  global.Scanner.isSupported = function () {
    return ('BarcodeDetector' in window) || !!getZXing();
  };
})(window);
