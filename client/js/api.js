'use strict';

/* Shared client helpers: API wrapper, HTML escaping, formatting, UI widgets.
   Loaded as a plain <script> (CSP forbids inline scripts). */

(function () {
  const API = {
    async request(path, options) {
      const opts = Object.assign({ method: 'GET', headers: {} }, options || {});
      if (opts.body !== undefined && typeof opts.body !== 'string' && !(opts.body instanceof FormData)) {
        opts.headers['Content-Type'] = 'application/json';
        opts.body = JSON.stringify(opts.body);
      }
      const res = await fetch(path, Object.assign({ credentials: 'same-origin' }, opts));
      let data = null;
      try {
        data = await res.json();
      } catch (_) {
        /* non-JSON */
      }
      if (!res.ok) {
        const err = new Error((data && data.error && data.error.message) || 'Request failed');
        err.status = res.status;
        err.code = data && data.error && data.error.code;
        err.fields = data && data.error && data.error.details;
        throw err;
      }
      return data;
    },
    get(path) { return this.request(path); },
    post(path, body) { return this.request(path, { method: 'POST', body }); },
    patch(path, body) { return this.request(path, { method: 'PATCH', body }); },
    put(path, body) { return this.request(path, { method: 'PUT', body }); },
    del(path) { return this.request(path, { method: 'DELETE' }); },
    /* Multipart upload with progress callbacks (fetch cannot report upload %). */
    uploadWithProgress(path, formData, onProgress) {
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', path);
        xhr.withCredentials = true;
        if (onProgress) {
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
          };
        }
        xhr.onload = () => {
          let data = null;
          try { data = JSON.parse(xhr.responseText); } catch (_) { /* non-JSON */ }
          if (xhr.status >= 200 && xhr.status < 300) return resolve(data);
          const err = new Error((data && data.error && data.error.message) || 'Request failed');
          err.status = xhr.status;
          err.code = data && data.error && data.error.code;
          reject(err);
        };
        xhr.onerror = () => reject(new Error('Network error during upload'));
        xhr.send(formData);
      });
    },
  };

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function fmtMoney(cents, currency, locale) {
    try {
      return new Intl.NumberFormat(locale || document.documentElement.lang || undefined, { style: 'currency', currency }).format((cents || 0) / 100);
    } catch (_) {
      return ((cents || 0) / 100).toFixed(2) + ' ' + currency;
    }
  }

  function fmtDateTime(value, locale) {
    try {
      return new Date(value).toLocaleString(locale || document.documentElement.lang || undefined);
    } catch (_) {
      return String(value);
    }
  }

  function qsParam(name) {
    return new URLSearchParams(location.search).get(name);
  }

  function debounce(fn, ms) {
    let t = null;
    return function () {
      clearTimeout(t);
      const args = arguments;
      t = setTimeout(() => fn.apply(null, args), ms);
    };
  }

  function toast(message, type) {
    let zone = document.querySelector('.toast-zone');
    if (!zone) {
      zone = document.createElement('div');
      zone.className = 'toast-zone';
      document.body.appendChild(zone);
    }
    const el = document.createElement('div');
    el.className = 'toast' + (type === 'error' ? ' error' : type === 'success' ? ' success' : '');
    el.textContent = message;
    zone.appendChild(el);
    setTimeout(() => {
      el.style.opacity = '0';
      setTimeout(() => el.remove(), 250);
    }, 3200);
  }

  const STATUS_LABELS = {
    pending: 'Pending',
    confirmed: 'Confirmed',
    preparing: 'Preparing',
    ready: 'Ready',
    out_for_delivery: 'Out for delivery',
    completed: 'Completed',
    cancelled: 'Cancelled',
  };

  /* ---------------- client-side image compression ---------------- */
  /* Re-encode restaurant images to WebP (downscaled) before upload so
     nothing bigger than needed is ever stored or transferred. */
  function loadImageElement(file) {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
      img.src = url;
    });
  }

  function canvasToBlob(canvas, quality) {
    return new Promise((resolve) => {
      try {
        const done = (b) => resolve(b && b.size ? b : null);
        if (canvas.toBlob) canvas.toBlob(done, 'image/webp', quality);
        else resolve(null);
      } catch (_) {
        resolve(null);
      }
    });
  }

  /**
   * Downscale (never upscale) + re-encode a chosen file to WebP at the given
   * quality. Returns the original File untouched if it's already a small WebP
   * or if anything fails, so uploads are never blocked by compression.
   */
  async function compressImage(file, opts) {
    if (!file || !/(image\/(jpeg|png|webp))/.test(file.type)) return file;
    const max = (opts && opts.max) || 1200;
    const quality = (opts && opts.quality) || 0.75;
    try {
      if (file.type === 'image/webp' && file.size <= 48 * 1024) return file;
      const img = await loadImageElement(file);
      if (!img || !img.width || !img.height) return file;
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const width = Math.max(1, Math.round(img.width * scale));
      const height = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);
      const blob = await canvasToBlob(canvas, quality);
      if (blob && blob.size < file.size) return blob;
      return file; // never store something bigger than the original
    } catch (_) {
      return file;
    }
  }

  /* ---------------- shared theme (colour) utilities ---------------- */
  function hexToRgb(hex) {
    const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex || '');
    return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : null;
  }
  function toHex(rgb) {
    return '#' + rgb.map((c) => Math.max(0, Math.min(255, Math.round(c)))
      .toString(16).padStart(2, '0')).join('');
  }
  function luminance(rgb) {
    const [r, g, b] = rgb.map((c) => c / 255).map((c) =>
      c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
  function contrastText(rgb) {
    return luminance(rgb) > 0.5 ? '#111827' : '#ffffff';
  }
  function mix(a, b, t) {
    return a.map((v, i) => v + (b[i] - v) * t);
  }
  // Default brand colours used whenever a restaurant has none configured.
  const DEFAULT_PRIMARY = '#e11d48';
  const DEFAULT_SECONDARY = '#111827';
  // Compute the full semantic token map from the two restaurant colours.
  // Falls back to designer defaults only when a colour is missing/invalid.
  function buildTokens(primaryColor, secondaryColor) {
    const primary = hexToRgb(primaryColor) || hexToRgb(DEFAULT_PRIMARY);
    const secondary = hexToRgb(secondaryColor) || hexToRgb(DEFAULT_SECONDARY);
    return {
      '--primary': toHex(primary),
      '--secondary': toHex(secondary),
      '--primary-pattern': toHex(primary),
      '--secondary-pattern': toHex(mix(secondary, [255, 255, 255], 0.35)),
      '--primary-dark': toHex(mix(primary, [0, 0, 0], 0.22)),
      '--primary-light': toHex(mix(primary, [255, 255, 255], 0.88)),
      '--primary-soft': toHex(mix(primary, [255, 255, 255], 0.92)),
      '--secondary-dark': toHex(mix(secondary, [0, 0, 0], 0.25)),
      '--secondary-soft': toHex(mix(secondary, [255, 255, 255], 0.9)),
      '--on-primary': contrastText(primary),
      '--on-secondary': contrastText(secondary),
    };
  }

  window.App = { api: API, esc, fmtMoney, fmtDateTime, qsParam, debounce, toast, compressImage, STATUS_LABELS, theme: { buildTokens, hexToRgb, toHex } };
})();
