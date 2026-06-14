// cache.js

const CACHE_DB_NAME = "fairapp";
const CACHE_DB_VERSION = 1;

const CACHED_RESOURCES = [
  "facilities",
  "midway",
  "tickets",
  "firstaid",
  "parade",
  "tasting",
  "exhibits",
  "about",
  "faqs"
];

class CacheManagerClass {

  constructor() {
    this.db = null;
    this.syncTimer = null;
  }

  async init() {

    this.db = await this.openDB();

    console.log("CacheManager initialized");

    // immediate sync on startup
    await this.syncResources();

    // every 2 minutes
    this.syncTimer = setInterval(() => {
      this.syncResources();
    }, 120000);
  }

  openDB() {

    return new Promise((resolve, reject) => {

      const request = indexedDB.open(
        CACHE_DB_NAME,
        CACHE_DB_VERSION
      );

      request.onupgradeneeded = (event) => {

        const db = event.target.result;

        if (!db.objectStoreNames.contains("resources")) {

          db.createObjectStore(
            "resources",
            { keyPath: "resource" }
          );
        }

        if (!db.objectStoreNames.contains("metadata")) {

          db.createObjectStore(
            "metadata",
            { keyPath: "key" }
          );
        }
      };

      request.onsuccess = () => resolve(request.result);

      request.onerror = () => reject(request.error);

    });
  }

  async getResource(resource) {

    return new Promise((resolve, reject) => {

      const tx = this.db.transaction(
        "resources",
        "readonly"
      );

      const store = tx.objectStore("resources");

      const req = store.get(resource);

      req.onsuccess = () => resolve(req.result);

      req.onerror = () => reject(req.error);

    });
  }

async getResourceHtml(resource) {

  const record = await this.getResource(resource);

  return record?.html || null;
}

  async putResource(record) {

    return new Promise((resolve, reject) => {

      const tx = this.db.transaction(
        "resources",
        "readwrite"
      );

      const store = tx.objectStore("resources");

      const req = store.put(record);

      req.onsuccess = () => resolve();

      req.onerror = () => reject(req.error);

    });
  }

  async syncResources() {

    try {

      console.log("Checking resource versions...");

      const res = await fetch("/api/resource");

      const resources = await res.json();

    for (const resource of resources) {

      if (
        CACHED_RESOURCES.includes(
          resource.resource
        )
      ) {

        await this.syncStaticResource(
          resource
        );

      }
    }

    } catch (err) {

      console.warn(
        "Resource sync failed",
        err
      );

      // keep running
    }
  }

    async syncStaticResource(serverInfo) {

    try {

        const local = await this.getResource(
          serverInfo.resource
        );

      const needsUpdate =
        !local ||
        local.version !== serverInfo.version;

      if (!needsUpdate) {
        return;
      }

    console.log(
      `Updating ${serverInfo.resource} cache`
    );

    const res = await fetch(
      `/static/pages/${serverInfo.resource}.html?v=${serverInfo.version}`
    );

      const html = await res.text();

      await this.putResource({
        resource: serverInfo.resource,
        version: serverInfo.version,
        updated: serverInfo.updated,
        html
      });

    console.log(
      `${serverInfo.resource} cache updated`
    );

    } catch (err) {

      console.warn(
        `${serverInfo.resource} update failed`,
        err
      );

      // keep running
    }
  }

}

window.CacheManager = new CacheManagerClass();