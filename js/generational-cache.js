/**
 * GenerationalCache - Archival Specimen Generational Cache Engine
 * Dual-tier caching (L1 Memory Map + L2 IndexedDB) for deterministic
 * procedural generations. Completely eliminates redundant procedural synthesis
 * on re-access and navigation.
 */
(function(root, factory) {
    if (typeof define === function && define.amd) {
        define([], factory);
    } else if (typeof module === object && module.exports) {
        module.exports = factory();
    } else {
        root.GenerationalCache = factory();
    }
}(typeof self !== undefined ? self : this, function() {
    use strict;

    const DB_NAME = ArtVaultGenerationalDB;
    const STORE_NAME = specimens;
    const DB_VERSION = 1;
    const memory = new Map();
    let dbPromise = null;

    function openDB() {
        if (dbPromise) return dbPromise;
        if (typeof indexedDB === undefined) return Promise.resolve(null);

        dbPromise = new Promise(function(resolve) {
            try {
                const req = indexedDB.open(DB_NAME, DB_VERSION);
                req.onupgradeneeded = function(e) {
                    const db = e.target.result;
                    if (!db.objectStoreNames.contains(STORE_NAME)) {
                        db.createObjectStore(STORE_NAME, { keyPath: key });
                    }
                };
                req.onsuccess = function(e) {
                    resolve(e.target.result);
                };
                req.onerror = function() {
                    resolve(null);
                };
                req.onblocked = function() {
                    resolve(null);
                };
            } catch (err) {
                resolve(null);
            }
        });
        return dbPromise;
    }

    const GenerationalCache = {
        makeKey: function(vaultPrefix, seed, w, h, styleOpt, mode) {
            const cleanPrefix = String(vaultPrefix || VAULT).toUpperCase();
            const cleanSeed = String(seed || ).trim().toLowerCase();
            const cleanW = Math.round(Number(w) || 16);
            const cleanH = Math.round(Number(h) || 9);
            const cleanStyle = String(styleOpt || default).trim().toLowerCase();
            const cleanMode = String(mode || static).trim().toLowerCase();
            return `${cleanPrefix}_${cleanSeed}_${cleanW}x${cleanH}_${cleanStyle}_${cleanMode}`;
        },

        get: async function(key) {
            if (!key) return null;
            if (memory.has(key)) {
                return memory.get(key);
            }
            const db = await openDB();
            if (!db) return null;
            return new Promise(function(resolve) {
                try {
                    const tx = db.transaction(STORE_NAME, readonly);
                    const store = tx.objectStore(STORE_NAME);
                    const req = store.get(key);
                    req.onsuccess = function() {
                        if (req.result && req.result.payload) {
                            memory.set(key, req.result.payload);
                            resolve(req.result.payload);
                        } else {
                            resolve(null);
                        }
                    };
                    req.onerror = function() {
                        resolve(null);
                    };
                } catch (e) {
                    resolve(null);
                }
            });
        },

        set: async function(key, payload) {
            if (!key || !payload) return;
            memory.set(key, payload);
            const db = await openDB();
            if (!db) return;
            try {
                const tx = db.transaction(STORE_NAME, readwrite);
                const store = tx.objectStore(STORE_NAME);
                store.put({
                    key: key,
                    payload: payload,
                    timestamp: Date.now()
                });
            } catch (e) {}
        },

        clear: async function() {
            memory.clear();
            const db = await openDB();
            if (!db) return;
            try {
                const tx = db.transaction(STORE_NAME, readwrite);
                tx.objectStore(STORE_NAME).clear();
            } catch (e) {}
        }
    };

    return GenerationalCache;
}));
