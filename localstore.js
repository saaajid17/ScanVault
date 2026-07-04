/**
 * localstore.js
 * Adapted from the pwa-storage-abstraction skill for a plain <script> tag
 * context (no bundler, no ES modules yet). References
 * window.Capacitor?.Plugins?.Preferences directly at call time instead of
 * import { Preferences } — that's how Capacitor's runtime bridge exposes
 * plugins to a WebView without a build step, and it correctly resolves to
 * undefined pre-Capacitor, so everything routes through localStorage now
 * and will switch over automatically once Session 6 wraps this in Capacitor.
 */

var _localStoreCache = {};

function _isNativeWithPreferences() {
  return (
    typeof window !== 'undefined' &&
    window.Capacitor?.isNativePlatform?.() === true &&
    Boolean(window.Capacitor?.Plugins?.Preferences)
  );
}

var LocalStore = {
  getItem(key) {
    return Object.prototype.hasOwnProperty.call(_localStoreCache, key)
      ? _localStoreCache[key]
      : null;
  },

  async setItem(key, value) {
    const str = String(value);
    _localStoreCache[key] = str;
    if (_isNativeWithPreferences()) {
      await window.Capacitor.Plugins.Preferences.set({ key, value: str });
    } else {
      window.localStorage.setItem(key, str);
    }
  },

  async removeItem(key) {
    delete _localStoreCache[key];
    if (_isNativeWithPreferences()) {
      await window.Capacitor.Plugins.Preferences.remove({ key });
    } else {
      window.localStorage.removeItem(key);
    }
  },

  async clear() {
    for (const k of Object.keys(_localStoreCache)) delete _localStoreCache[k];
    if (_isNativeWithPreferences()) {
      await window.Capacitor.Plugins.Preferences.clear();
    } else {
      window.localStorage.clear();
    }
  },
};

async function preloadStorage(keys) {
  if (_isNativeWithPreferences()) {
    for (const key of keys) {
      const { value } = await window.Capacitor.Plugins.Preferences.get({ key });
      if (value !== null && value !== undefined) _localStoreCache[key] = value;
    }
  } else {
    for (const key of keys) {
      const value = window.localStorage.getItem(key);
      if (value !== null) _localStoreCache[key] = value;
    }
  }
}

const CONFIG = {
  SK: {
    APP_DATA: 'scanvault_data',
  },
};
