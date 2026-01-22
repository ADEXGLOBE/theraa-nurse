// src/features/documents/idb.js
const DB_NAME = "theraa-nurse-db";
const DB_VERSION = 1;

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = () => {
      const db = req.result;

      if (!db.objectStoreNames.contains("documents")) {
        const store = db.createObjectStore("documents", { keyPath: "id" });
        store.createIndex("by_clientId", "clientId", { unique: false });
        store.createIndex("by_createdAt", "createdAt", { unique: false });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function withStore(storeName, mode, fn) {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, mode);
        const store = tx.objectStore(storeName);
        const result = fn(store, tx);

        tx.oncomplete = () => resolve(result);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      })
  );
}

export async function idbPut(storeName, value) {
  await withStore(storeName, "readwrite", (store) => store.put(value));
  return value;
}

export async function idbDelete(storeName, key) {
  await withStore(storeName, "readwrite", (store) => store.delete(key));
}

export async function idbGetAll(storeName) {
  return withStore(storeName, "readonly", (store) => {
    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result ?? []);
      req.onerror = () => reject(req.error);
    });
  });
}

export async function idbGetAllByIndex(storeName, indexName, query) {
  return withStore(storeName, "readonly", (store) => {
    return new Promise((resolve, reject) => {
      const idx = store.index(indexName);
      const req = idx.getAll(query);
      req.onsuccess = () => resolve(req.result ?? []);
      req.onerror = () => reject(req.error);
    });
  });
}
