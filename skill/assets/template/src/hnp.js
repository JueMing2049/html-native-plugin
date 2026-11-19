/*!
 * HNP 路 HTML Native Plugin  v0.1.0
 * 闆朵緷璧?路 鍘熺敓 API 路 娉ㄥ唽鍒朵氦浜掓彃浠惰繍琛屾椂
 * 鍔犱竴琛?script銆佸啓涓€涓?data-hnp锛岄〉闈㈠氨闀垮嚭浜や簰锛涘弻鍑?HTML 鍗冲彲鐢紝涓嶉渶瑕佷换浣曚汉瀹夎涓滆タ銆? */
(function (global) {
  'use strict';

  var VERSION = '0.2.0';
  var ATTR = 'data-hnp';

  var registry = Object.create(null);
  var order = [];
  var mounted = new WeakMap();   // Element -> { name: true }
  var live = [];                 // { name, el, ctx }
  var bus = Object.create(null);
  var booted = false;

  function warn() {
    if (!global.console || !console.warn) return;
    var args = ['[hnp]'].concat(Array.prototype.slice.call(arguments));
    console.warn.apply(console, args);
  }

  function reducedMotion() {
    return !!(global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  /* ---------- 浜嬩欢鎬荤嚎 ---------- */
  function on(evt, fn) {
    (bus[evt] || (bus[evt] = [])).push(fn);
    return function () { off(evt, fn); };
  }

  function off(evt, fn) {
    var list = bus[evt];
    if (!list) return;
    var i = list.indexOf(fn);
    if (i > -1) list.splice(i, 1);
  }

  function emit(evt, payload) {
    (bus[evt] || []).slice().forEach(function (fn) {
      try { fn(payload); } catch (e) { warn('璁㈤槄鑰呭嚭閿欙細' + evt, e); }
    });
    (bus['*'] || []).slice().forEach(function (fn) {
      try { fn({ type: evt, payload: payload }); } catch (e) { /* 閫氶厤璁㈤槄澶辫触涓嶅奖鍝嶄富娴佺▼ */ }
    });
  }

  /* ---------- 甯﹀懡鍚嶇┖闂寸殑瀹夊叏瀛樺偍 ---------- */
  function store(ns) {
    var prefix = 'hnp:' + ns + ':';
    function run(fn, fallback) {
      try { return fn(); } catch (e) { return fallback; }
    }
    return {
      get: function (k, d) {
        var v = run(function () { return global.localStorage.getItem(prefix + k); }, null);
        return v === null || v === undefined ? d : v;
      },
      set: function (k, v) { run(function () { global.localStorage.setItem(prefix + k, String(v)); }); },
      remove: function (k) { run(function () { global.localStorage.removeItem(prefix + k); }); },
      getJSON: function (k, d) {
        var raw = this.get(k, null);
        if (!raw) return d;
        return run(function () { return JSON.parse(raw); }, d);
      },
      setJSON: function (k, v) { this.set(k, JSON.stringify(v)); }
    };
  }

  /* ---------- 澶嶅埗鍒板壀璐存澘锛堝惈 execCommand 鍏滃簳锛?---------- */
  function copy(text) {
    var done = false;
    if (global.navigator && navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(function () { fallback(); });
      done = true;
    }
    if (!done) fallback();

    function fallback() {
      var ta = global.document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      global.document.body.appendChild(ta);
      ta.select();
      try { global.document.execCommand('copy'); } catch (e) { warn('澶嶅埗澶辫触', e); }
      global.document.body.removeChild(ta);
    }
  }

  /* ---------- 鍏冪礌閫夐」 ---------- */
  function readOpts(el) {
    var out = {};
    if (!el || !el.attributes) return out;
    for (var i = 0; i < el.attributes.length; i++) {
      var a = el.attributes[i];
      if (a.name.indexOf('data-hnp-') !== 0) continue;
      var key = a.name.slice(9).replace(/-([a-z])/g, function (m, c) { return c.toUpperCase(); });
      out[key] = a.value;
    }
    return out;
  }

  /* ---------- 涓婁笅鏂?---------- */
  function makeCtx(name, spec, el) {
    var disposers = [];
    var opts = {};
    var defaults = spec.defaults || {};
    var raw = readOpts(el);
    Object.keys(defaults).forEach(function (k) { opts[k] = defaults[k]; });
    Object.keys(raw).forEach(function (k) { opts[k] = raw[k]; });

    var ctx = {
      name: name,
      el: el,
      opts: opts,
      document: global.document,
      reducedMotion: reducedMotion(),
      emit: emit,
      store: store(name),
      on: function (target, type, fn, opt) {
        if (!target || !target.addEventListener) return fn;
        target.addEventListener(type, fn, opt);
        disposers.push(function () { target.removeEventListener(type, fn, opt); });
        return fn;
      },
      every: function (ms, fn) {
        var id = global.setInterval(fn, ms);
        disposers.push(function () { global.clearInterval(id); });
        return id;
      },
      later: function (ms, fn) {
        var id = global.setTimeout(fn, ms);
        disposers.push(function () { global.clearTimeout(id); });
        return id;
      },
      observer: function (io, target) {
        if (!io || !target) return;
        io.observe(target);
        disposers.push(function () { try { io.unobserve(target); } catch (e) {} });
      },
      dispose: function () {
        var list = disposers.splice(0);
        list.forEach(function (d) { try { d(); } catch (e) {} });
      }
    };
    return ctx;
  }

  /* ---------- 娉ㄥ唽 ---------- */
  function define(name, spec) {
    if (!name || typeof name !== 'string') {
      warn('define 闇€瑕佷竴涓彃浠跺悕');
      return false;
    }
    if (!spec || typeof spec.mount !== 'function') {
      warn('鎻掍欢 "' + name + '" 缂哄皯 mount 鏂规硶');
      return false;
    }
    if (registry[name]) warn('鎻掍欢 "' + name + '" 宸茶瑕嗙洊娉ㄥ唽');
    else order.push(name);
    registry[name] = spec;
    return true;
  }

  function defined(name) { return !!registry[name]; }
  function plugins() { return order.slice(); }

  /* ---------- 鎸傝浇 ---------- */
  function mountOne(el, name) {
    var spec = registry[name];
    if (!spec) { warn('鎻掍欢 "' + name + '" 鏈敞鍐岋紝宸茶烦杩?); return false; }

    var set = mounted.get(el);
    if (!set) { set = Object.create(null); mounted.set(el, set); }
    if (set[name]) return false;              // 骞傜瓑锛氬悓涓€鍏冪礌鍚屼竴鎻掍欢鍙寕涓€娆?
    var ctx = makeCtx(name, spec, el);
    try {
      spec.mount(el, ctx);
    } catch (e) {
      warn('鎻掍欢 "' + name + '" 鎸傝浇澶辫触', e);
      ctx.dispose();
      return false;
    }
    set[name] = true;
    live.push({ name: name, el: el, ctx: ctx });
    emit('hnp:mount', { name: name, el: el });
    return true;
  }

  function mount(root, options) {
    var scope = root || global.document;
    if (!scope || !scope.querySelectorAll) return 0;
    var only = options && options.plugins ? options.plugins : null;
    var hit = [];

    if (scope.nodeType === 1 && scope.hasAttribute && scope.hasAttribute(ATTR)) hit.push(scope);
    Array.prototype.forEach.call(scope.querySelectorAll('[' + ATTR + ']'), function (el) { hit.push(el); });

    var count = 0;
    hit.forEach(function (el) {
      String(el.getAttribute(ATTR) || '').split(/\s+/).forEach(function (name) {
        if (!name) return;
        if (only && only.indexOf(name) === -1) return;
        if (mountOne(el, name)) count++;
      });
    });
    return count;
  }

  /* ---------- 鍗歌浇 ---------- */
  function unmount(root, name) {
    var scope = root || global.document;
    var removed = 0;
    live.slice().forEach(function (item) {
      if (name && item.name !== name) return;
      if (scope !== global.document && scope !== global.document.body &&
          item.el !== scope && !scope.contains(item.el)) return;

      var spec = registry[item.name];
      try { if (spec && typeof spec.unmount === 'function') spec.unmount(item.el, item.ctx); } catch (e) { warn('鎻掍欢 "' + item.name + '" 鍗歌浇澶辫触', e); }
      item.ctx.dispose();

      var set = mounted.get(item.el);
      if (set) delete set[item.name];

      var i = live.indexOf(item);
      if (i > -1) live.splice(i, 1);
      removed++;
      emit('hnp:unmount', { name: item.name, el: item.el });
    });
    return removed;
  }

  /* ---------- 鑷淇℃伅锛堢粰 demo 涓庢祴璇曠敤锛?---------- */
  function inspect() {
    var byName = {};
    live.forEach(function (item) { byName[item.name] = (byName[item.name] || 0) + 1; });
    return {
      version: VERSION,
      registered: plugins(),
      installed: live.length,
      byName: byName
    };
  }

  /* ---------- 鎸夊悕鍙栫敤 ---------- */
  function use(name) {
    if (!registry[name]) warn('鎻掍欢 "' + name + '" 鏈敞鍐?);
    return { mount: function (root) { return mount(root, { plugins: [name] }); } };
  }

  /* ---------- 鍚姩 ---------- */
  function boot() {
    if (booted) return;
    booted = true;
    var html = global.document.documentElement;
    var manual = html && html.getAttribute('data-hnp-auto') === 'false';
    var count = manual ? 0 : mount(global.document);
    emit('hnp:ready', { version: VERSION, mounted: count, auto: !manual });
  }

  global.HNP = {
    version: VERSION,
    define: define,
    defined: defined,
    plugins: plugins,
    use: use,
    mount: mount,
    unmount: unmount,
    on: on,
    off: off,
    emit: emit,
    store: store,
    copy: copy,
    inspect: inspect
  };

  if (global.document) {
    if (global.document.readyState === 'loading') {
      global.document.addEventListener('DOMContentLoaded', boot);
    } else {
      boot();
    }
  }
}(typeof window !== 'undefined' ? window : this));
