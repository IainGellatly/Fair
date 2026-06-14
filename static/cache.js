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
  "faqs",
  "sponsors",
  "food",
  "vendor",
  "community",
  "animal",
  "events"
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

async getResourceData(resource) {

  const record = await this.getResource(resource);

  return record?.data || null;
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

if (resource.resource === "sponsors") {

  await this.syncSponsors(resource);

} else if (
  resource.resource === "food" ||
  resource.resource === "vendor" ||
  resource.resource === "community" ||
  resource.resource === "animal"
) {

  await this.syncTenant(resource);

} else if (
  resource.resource === "events"
) {

  await this.syncEvents(resource);

} else {

  await this.syncStaticResource(resource);

}

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

async syncSponsors(serverInfo) {

  try {

    const local = await this.getResource(
      "sponsors"
    );

    const needsUpdate =
      !local ||
      local.version !== serverInfo.version;

    if (!needsUpdate) {
      return;
    }

    console.log(
      "Updating sponsors cache"
    );

    const res = await fetch(
      `/api/sponsors?v=${serverInfo.version}`
    );

    const data = await res.json();

    await this.putResource({
      resource: "sponsors",
      version: serverInfo.version,
      updated: serverInfo.updated,
      data
    });

    console.log(
      "Sponsors cache updated"
    );

  } catch (err) {

    console.warn(
      "Sponsors update failed",
      err
    );
  }
}

async syncTenant(serverInfo) {

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
      `/api/tenants/${serverInfo.resource}?v=${serverInfo.version}`
    );

    const data = await res.json();

    await this.putResource({
      resource: serverInfo.resource,
      version: serverInfo.version,
      updated: serverInfo.updated,
      data
    });

    console.log(
      `${serverInfo.resource} cache updated`
    );

  } catch (err) {

    console.warn(
      `${serverInfo.resource} update failed`,
      err
    );

  }
}

async syncEvents(serverInfo) {

  try {

    const local = await this.getResource(
      "events"
    );

    const needsUpdate =
      !local ||
      local.version !== serverInfo.version;

    if (!needsUpdate) {
      return;
    }

    console.log(
      "Updating events cache"
    );

    const res = await fetch(
      `/api/events?v=${serverInfo.version}`
    );

    const data = await res.json();

    await this.putResource({
      resource: "events",
      version: serverInfo.version,
      updated: serverInfo.updated,
      data
    });

    console.log(
      "Events cache updated"
    );

  } catch (err) {

    console.warn(
      "Events update failed",
      err
    );

  }
}

}

window.CacheManager = new CacheManagerClass();