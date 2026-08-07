// 语音报价 (ES5 兼容)
(function (global) {
  var Speech = {
    speak: function (text) {
      try {
        if (!('speechSynthesis' in window)) return false;
        window.speechSynthesis.cancel();
        var u = new SpeechSynthesisUtterance(text);
        u.lang = 'zh-CN';
        u.rate = 1.0;
        u.pitch = 1.0;
        u.volume = 1.0;
        try {
          var voices = window.speechSynthesis.getVoices();
          for (var i = 0; i < voices.length; i++) {
            var v = voices[i];
            if (v.lang && /zh|cmn/i.test(v.lang)) { u.voice = v; break; }
            if (v.name && /Chinese/i.test(v.name)) { u.voice = v; break; }
          }
        } catch (e) {}
        window.speechSynthesis.speak(u);
        return true;
      } catch (e) {
        return false;
      }
    },
    stop: function () {
      try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch (e) {}
    }
  };

  if ('speechSynthesis' in window) {
    try {
      window.speechSynthesis.onvoiceschanged = function () {
        try { window.speechSynthesis.getVoices(); } catch (e) {}
      };
    } catch (e) {}
  }

  global.Speech = Speech;
})(window);
