// 简易商品数据存储 - 基于 localStorage (ES5 兼容)
(function (global) {
  var KEY = 'scan_price_products_v1';

  function readAll() {
    try {
      if (typeof localStorage === 'undefined') return [];
      var raw = localStorage.getItem(KEY);
      if (!raw) return [];
      var arr = JSON.parse(raw);
      return Object.prototype.toString.call(arr) === '[object Array]' ? arr : [];
    } catch (e) {
      return [];
    }
  }

  function writeAll(list) {
    try {
      if (typeof localStorage === 'undefined') return;
      localStorage.setItem(KEY, JSON.stringify(list));
    } catch (e) {}
  }

  function genId() {
    return 'p_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  var Storage = {
    list: function () { return readAll(); },

    getByBarcode: function (barcode) {
      if (!barcode) return null;
      var list = readAll();
      for (var i = 0; i < list.length; i++) {
        if (list[i].barcode === String(barcode)) return list[i];
      }
      return null;
    },

    getById: function (id) {
      if (!id) return null;
      var list = readAll();
      for (var i = 0; i < list.length; i++) {
        if (list[i].id === id) return list[i];
      }
      return null;
    },

    upsert: function (product) {
      var list = readAll();
      if (product.id) {
        for (var i = 0; i < list.length; i++) {
          if (list[i].id === product.id) {
            for (var k in product) { if (Object.prototype.hasOwnProperty.call(product, k)) list[i][k] = product[k]; }
            list[i].updatedAt = Date.now();
            writeAll(list);
            return { item: list[i], conflict: false };
          }
        }
      }
      for (var j = 0; j < list.length; j++) {
        if (list[j].barcode === product.barcode) {
          return { item: list[j], conflict: true };
        }
      }
      var newItem = {
        id: genId(),
        name: '',
        price: 0,
        spec: '',
        image: '',
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      for (var k2 in product) { if (Object.prototype.hasOwnProperty.call(product, k2)) newItem[k2] = product[k2]; }
      list.unshift(newItem);
      writeAll(list);
      return { item: newItem, conflict: false };
    },

    remove: function (id) {
      var list = readAll();
      var out = [];
      for (var i = 0; i < list.length; i++) {
        if (list[i].id !== id) out.push(list[i]);
      }
      writeAll(out);
    },

    seedIfEmpty: function () {
      var list = readAll();
      if (list.length > 0) return;
      var samples = [
        { id: genId(), barcode: '00223145', name: '日',         price: 58, spec: '',    image: '', createdAt: Date.now(), updatedAt: Date.now() },
        { id: genId(), barcode: '6976802610980', name: '哇哈哈', price: 10, spec: '500ml', image: '', createdAt: Date.now(), updatedAt: Date.now() }
      ];
      writeAll(samples);
    }
  };

  global.Storage = Storage;
})(window);
