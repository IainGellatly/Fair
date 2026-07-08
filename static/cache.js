// cache.js

const CACHE_DB_NAME = "fairapp";
const CACHE_DB_VERSION = 7;

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
  "events",
  "media",
  "app"
];

class CacheManagerClass {

  constructor() {
    this.db = null;
    this.syncTimer = null;
    this.mediaUrls = new Map();
    this.appUrls = new Map();
  }

  async init() {

    this.db = await this.openDB();

    console.log("CacheManager initialized");

    this.startBackgroundSync();

  }

    async startBackgroundSync() {

        try {

            const lastCheck =
                await this.getMetadata(
                    "last_resource_check"
                );

            const now = Date.now();

            if (
                !lastCheck ||
                (now - lastCheck) > 120000
            ) {

                console.log(
                    "Running startup resource sync"
                );

                await this.syncResources();

            } else {

                console.log(
                    "Skipping startup resource sync"
                );

            }

            // Download the latest vote results if we are online.
            // If we are offline, keep whatever is already cached.

            try {
                await this.refreshVoteResults();
            } catch (err) {
                // Offline - cached vote results remain available.
            }

            await this.syncAnalytics();
            await this.syncSurveys();
            await this.syncVotes();
            await this.syncAlerts();

        } catch (err) {

            console.warn(
                "Startup sync failed",
                err
            );

        }

        this.syncTimer = setInterval(() => {
            this.syncResources();
        }, 120000);

        this.analyticsTimer = setInterval(() => {

            this.syncAnalytics();
            this.syncSurveys();
            this.syncVotes();
            this.syncAlerts();

        }, 300000);

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

        if (!db.objectStoreNames.contains("analytics")) {

          db.createObjectStore(
            "analytics",
            {
              keyPath: "id",
              autoIncrement: true
            }
          );
        }

        if (!db.objectStoreNames.contains("surveys")) {

          db.createObjectStore(
            "surveys",
            {
              keyPath: "id",
              autoIncrement: true
            }
          );
        }

        if (!db.objectStoreNames.contains("votes")) {

          db.createObjectStore(
            "votes",
            {
              keyPath: "id",
              autoIncrement: true
            }
          );
        }

        if (!db.objectStoreNames.contains("alerts")) {

          db.createObjectStore(
            "alerts",
            {
              keyPath: "id",
              autoIncrement: true
            }
          );
        }

        if (!db.objectStoreNames.contains("media")) {

          db.createObjectStore(
            "media",
            { keyPath: "name" }
          );
        }

        if (!db.objectStoreNames.contains("app")) {

            db.createObjectStore(
              "app",
              { keyPath: "name" }
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

    async getMedia(name) {

      return new Promise((resolve, reject) => {

        const tx = this.db.transaction(
          "media",
          "readonly"
        );

        const store = tx.objectStore(
          "media"
        );

        const req = store.get(name);

        req.onsuccess = () =>
          resolve(req.result);

        req.onerror = () =>
          reject(req.error);

      });
    }

    async getMediaUrl(name) {

      // Already have a Blob URL?
      if (this.mediaUrls.has(name)) {
        return this.mediaUrls.get(name);
      }

      const media = await this.getMedia(name);

      if (!media) {
        return null;
      }

      const url = URL.createObjectURL(media.blob);

      this.mediaUrls.set(name, url);

      return url;
    }


    async putMedia(record) {

      if (this.mediaUrls.has(record.name)) {

        URL.revokeObjectURL(
          this.mediaUrls.get(record.name)
        );

        this.mediaUrls.delete(record.name);
      }

      return new Promise((resolve, reject) => {

        const tx = this.db.transaction(
          "media",
          "readwrite"
        );

        const store = tx.objectStore(
          "media"
        );

        const req = store.put(record);

        req.onsuccess = () =>
          resolve();

        req.onerror = () =>
          reject(req.error);

      });
    }

    async hasMedia(name) {

      const media =
        await this.getMedia(name);

      return media !== undefined &&
             media !== null;
    }

    async setImage(element, mediaName) {

        const url =
            await this.getMediaUrl(
                mediaName
            );

        if (url) {
            element.src = url;
        }
    }

    async localizeImages(root = document) {

        const images =
            root.querySelectorAll("img");

        console.log("localizing images!!!");

        for (const img of images) {

            const src = img.dataset.originalSrc;

            if (!src) {
                continue;
            }

            if (!src.startsWith("/static/")) {
                continue;
            }

            console.log("Found image:", src);

            const mediaName = src.split("?")[0];

            const url = await this.getMediaUrl(mediaName);

            console.log("Media:", mediaName);
            console.log("Blob URL:", url);

            if (url) {
                img.src = url;
                img.removeAttribute("srcset");
                console.log("Replaced with blob");
            } else {
                img.src = src;
                console.warn("NOT FOUND:", mediaName);
            }

        }

    }

async renderHtml(target, html) {

    console.log("renderHtml()", target);

    const wrapper = document.createElement("div");

    wrapper.innerHTML = html;

    for (const img of wrapper.querySelectorAll("img")) {

        img.dataset.originalSrc = img.getAttribute("src");
        img.removeAttribute("src");

    }

    await this.localizeImages(wrapper);

    target.replaceChildren(...wrapper.childNodes);
}

    async getMediaStats() {

      return new Promise((resolve, reject) => {

        const tx =
          this.db.transaction(
            "media",
            "readonly"
          );

        const store =
          tx.objectStore("media");

        const req = store.getAll();

        req.onsuccess = () => {

          const files = req.result;

          let bytes = 0;

          files.forEach(f => {

            bytes +=
              f.media_size || 0;

          });

          resolve({

            files: files.length,

            bytes,

            mb:
              (bytes / 1048576)
              .toFixed(2)

          });

        };

        req.onerror = () =>
          reject(req.error);

      });
    }

    async getApp(name) {

      return new Promise((resolve, reject) => {

        const tx = this.db.transaction(
          "app",
          "readonly"
        );

        const store = tx.objectStore("app");

        const req = store.get(name);

        req.onsuccess = () =>
          resolve(req.result);

        req.onerror = () =>
          reject(req.error);

      });

    }

    async putApp(record) {

      if (this.appUrls.has(record.name)) {

        URL.revokeObjectURL(
          this.appUrls.get(record.name)
        );

        this.appUrls.delete(record.name);

      }

      return new Promise((resolve, reject) => {

        const tx = this.db.transaction(
          "app",
          "readwrite"
        );

        const store = tx.objectStore("app");

        const req = store.put(record);

        req.onsuccess = () => resolve();

        req.onerror = () =>
          reject(req.error);

      });

    }

    async getAppUrl(name) {

      if (this.appUrls.has(name)) {
        return this.appUrls.get(name);
      }

      const file = await this.getApp(name);

      if (!file) {
        return null;
      }

      const url =
        URL.createObjectURL(file.blob);

      this.appUrls.set(name, url);

      return url;

    }

    async hasApp(name) {

      const file =
        await this.getApp(name);

      return file !== undefined &&
             file !== null;

    }

    async getAppStats() {

      return new Promise((resolve, reject) => {

        const tx = this.db.transaction(
          "app",
          "readonly"
        );

        const store =
          tx.objectStore("app");

        const req =
          store.getAll();

        req.onsuccess = () => {

          const files = req.result;

          let bytes = 0;

          files.forEach(f => {

            bytes +=
              f.app_size || 0;

          });

          resolve({

            files: files.length,

            bytes,

            mb:
              (bytes / 1048576)
              .toFixed(2)

          });

        };

        req.onerror = () =>
          reject(req.error);

      });

    }

    async getMetadata(key) {

      return new Promise((resolve, reject) => {

        const tx = this.db.transaction(
          "metadata",
          "readonly"
        );

        const store = tx.objectStore(
          "metadata"
        );

        const req = store.get(key);

        req.onsuccess = () =>
          resolve(req.result?.value);

        req.onerror = () =>
          reject(req.error);

      });
    }

    async setMetadata(key, value) {

      return new Promise((resolve, reject) => {

        const tx = this.db.transaction(
          "metadata",
          "readwrite"
        );

        const store = tx.objectStore(
          "metadata"
        );

        const req = store.put({
          key,
          value
        });

        req.onsuccess = () => resolve();

        req.onerror = () =>
          reject(req.error);

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

if (
  resource.resource === "media"
) {

  await this.syncMedia(resource);

}
else if (
  resource.resource === "app"
) {

  await this.syncApp(resource);

}
else if (resource.resource === "sponsors") {

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

    await this.setMetadata(
      "last_resource_check",
      Date.now()
    );


    } catch (err) {

    if (navigator.onLine) {

        console.warn(
            "Resource sync failed",
            err
        );

}

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

async syncMedia(serverInfo) {

  try {

    const local =
      await this.getResource(
        "media"
      );

    const needsUpdate =
      !local ||
      local.version !==
      serverInfo.version;

    if (!needsUpdate) {
      return;
    }

    console.log(
      "Updating media cache"
    );

    const res =
      await fetch(
        `/api/media?v=${serverInfo.version}`
      );

    const manifest =
      await res.json();

    for (const file of manifest) {

      const cached =
        await this.getMedia(
          file.name
        );

      const needsFile =

        !cached ||

        cached.version <
        file.version;

      if (!needsFile) {
        continue;
      }

      console.log(
        `Downloading media ${file.name}`
      );

        const fileRes =
            await fetch(file.name);

      const blob =
        await fileRes.blob();

      await this.putMedia({

        name:
          file.name,

        version:
          file.version,

        media_size:
          file.media_size,

        updated:
          file.updated,

        blob

      });
    }

    await this.putResource({

      resource: "media",

      version:
        serverInfo.version,

      updated:
        serverInfo.updated,

      data: manifest

    });

    console.log(
      "Media cache updated"
    );

  } catch (err) {

    console.warn(
      "Media update failed",
      err
    );

  }
}

async syncApp(serverInfo) {

  try {

    const local =
      await this.getResource("app");

    const needsUpdate =
      !local ||
      local.version !==
      serverInfo.version;

    if (!needsUpdate) {
      return;
    }

    console.log(
      "Updating app cache"
    );

    const res =
      await fetch(
        `/api/app?v=${serverInfo.version}`
      );

    const manifest =
      await res.json();

    for (const file of manifest) {

      const cached =
        await this.getApp(file.name);

      const needsFile =

        !cached ||

        cached.version <
        file.version;

      if (!needsFile) {
        continue;
      }

      console.log(
        `Downloading app ${file.name}`
      );

      const fileRes =
        await fetch(`${file.name}`);

      const blob =
        await fileRes.blob();

      await this.putApp({

        name:
          file.name,

        version:
          file.version,

        app_size:
          file.app_size,

        updated:
          file.updated,

        blob

      });

    }

    await this.putResource({

      resource: "app",

      version:
        serverInfo.version,

      updated:
        serverInfo.updated,

      data: manifest

    });

    console.log(
      "App cache updated"
    );

  } catch (err) {

    console.warn(
      "App update failed",
      err
    );

  }

}

async getAppText(name) {

    const file = await this.getApp(name);

    if (!file) {
        return null;
    }

    return await file.blob.text();

}

async loadCachedStyle() {

    console.log("loadCachedStyle() called");

    const css =
        await this.getAppText(
            "static/styles.css"
        );

    if (!css) {

        console.log(
            "No cached stylesheet"
        );

        return false;
    }

    const style =
        document.createElement("style");

    style.id = "cached-style";

    style.textContent = css;

    document.head.appendChild(style);

    console.log(
        "Loaded stylesheet from app cache"
    );

    return true;

}

async loadCachedScript() {

    const js =
        await this.getAppText(
            "static/app.js"
        );

    if (!js) {

        console.log(
            "No cached app.js"
        );

        return false;
    }

    console.log(
        "Loaded app.js from app cache"
    );

    const script =
        document.createElement("script");

    script.textContent = js;

    document.body.appendChild(script);

    return true;

}

async queueAnalytics(event) {

  return new Promise((resolve, reject) => {

    const tx = this.db.transaction(
      "analytics",
      "readwrite"
    );

    const store = tx.objectStore(
      "analytics"
    );

    const req = store.add(event);

    req.onsuccess = () => resolve();

    req.onerror = () => reject(req.error);

  });
}

async getAnalyticsBatch() {

  return new Promise((resolve, reject) => {

    const tx = this.db.transaction(
      "analytics",
      "readonly"
    );

    const store = tx.objectStore(
      "analytics"
    );

    const req = store.getAll();

    req.onsuccess = () =>
      resolve(req.result);

    req.onerror = () =>
      reject(req.error);

  });
}

async clearAnalytics(ids) {

  return new Promise((resolve, reject) => {

    const tx = this.db.transaction(
      "analytics",
      "readwrite"
    );

    const store = tx.objectStore(
      "analytics"
    );

    ids.forEach(id => store.delete(id));

    tx.oncomplete = () => resolve();

    tx.onerror = () =>
      reject(tx.error);

  });
}

async syncAnalytics() {

  try {

    const batch =
      await this.getAnalyticsBatch();

    if (!batch.length) {
      return;
    }

    console.log(
      `Uploading ${batch.length} analytics events`
    );

    const res = await fetch(
      "/api/analytics",
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json"
        },
        body: JSON.stringify({
          events: batch
        })
      }
    );

    const result =
      await res.json();

    if (result.status === "ok") {

      await this.clearAnalytics(
        batch.map(x => x.id)
      );

      console.log(
        "Analytics upload complete"
      );
    }

  } catch (err) {

    console.warn(
      "Analytics upload failed",
      err
    );

  }
}

async queueSurvey(survey) {

  return new Promise((resolve, reject) => {

    const tx = this.db.transaction(
      "surveys",
      "readwrite"
    );

    const store =
      tx.objectStore("surveys");

    const req = store.add(survey);

    req.onsuccess = () => resolve();

    req.onerror = () =>
      reject(req.error);

  });
}

async getSurveyBatch() {

  return new Promise((resolve, reject) => {

    const tx = this.db.transaction(
      "surveys",
      "readonly"
    );

    const store =
      tx.objectStore("surveys");

    const req = store.getAll();

    req.onsuccess = () =>
      resolve(req.result);

    req.onerror = () =>
      reject(req.error);

  });
}

async clearSurveys(ids) {

  return new Promise((resolve, reject) => {

    const tx = this.db.transaction(
      "surveys",
      "readwrite"
    );

    const store =
      tx.objectStore("surveys");

    ids.forEach(id =>
      store.delete(id)
    );

    tx.oncomplete = () =>
      resolve();

    tx.onerror = () =>
      reject(tx.error);

  });
}

async syncSurveys() {

  try {

    const batch =
      await this.getSurveyBatch();

    if (!batch.length) {
      return;
    }

    console.log(
      `Uploading ${batch.length} surveys`
    );

    for (const survey of batch) {

      const res = await fetch(
        "/api/survey/submit",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json"
          },
          body: JSON.stringify(
            survey.payload
          )
        }
      );

      const result =
        await res.json();

      if (
        result.status === "ok" ||
        result.status === "already_submitted"
      ) {

        await this.clearSurveys([
          survey.id
        ]);
      }
    }

  } catch (err) {

    console.warn(
      "Survey upload failed",
      err
    );

  }
}

async queueVote(vote) {

  return new Promise((resolve, reject) => {

    const tx = this.db.transaction(
      "votes",
      "readwrite"
    );

    const store =
      tx.objectStore("votes");

    const req = store.add(vote);

    req.onsuccess = () => resolve();

    req.onerror = () =>
      reject(req.error);

  });
}

async getVoteBatch() {

  return new Promise((resolve, reject) => {

    const tx = this.db.transaction(
      "votes",
      "readonly"
    );

    const store =
      tx.objectStore("votes");

    const req = store.getAll();

    req.onsuccess = () =>
      resolve(req.result);

    req.onerror = () =>
      reject(req.error);

  });
}

async clearVotes(ids) {

  return new Promise((resolve, reject) => {

    const tx = this.db.transaction(
      "votes",
      "readwrite"
    );

    const store =
      tx.objectStore("votes");

    ids.forEach(id =>
      store.delete(id)
    );

    tx.oncomplete = () =>
      resolve();

    tx.onerror = () =>
      reject(tx.error);

  });
}

async syncVotes() {

  try {

    const batch =
      await this.getVoteBatch();

    if (!batch.length) {
      return;
    }

    console.log(
      `Uploading ${batch.length} votes`
    );

    for (const vote of batch) {

      const res = await fetch(
        "/api/vote",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json"
          },
          body: JSON.stringify(
            vote.payload
          )
        }
      );

      const result =
        await res.json();

      if (
        result.status === "ok" ||
        result.status === "already_voted"
      ) {

        await this.clearVotes([
          vote.id
        ]);
      }
    }

    await this.refreshVoteResults();

  } catch (err) {

    console.warn(
      "Vote upload failed",
      err
    );
  }
}

async refreshVoteResults() {

  const res = await fetch(
    "/api/vote/results"
  );

  const data = await res.json();

  await this.setMetadata(
    "vote_results",
    data
  );

  await this.setMetadata(
    "vote_results_time",
    Date.now()
  );
}

async queueAlert(alert) {

  return new Promise((resolve, reject) => {

    const tx = this.db.transaction(
      "alerts",
      "readwrite"
    );

    const store =
      tx.objectStore("alerts");

    const req = store.add(alert);

    req.onsuccess = () => resolve();

    req.onerror = () =>
      reject(req.error);

  });
}

async getAlertBatch() {

  return new Promise((resolve, reject) => {

    const tx = this.db.transaction(
      "alerts",
      "readonly"
    );

    const store =
      tx.objectStore("alerts");

    const req = store.getAll();

    req.onsuccess = () =>
      resolve(req.result);

    req.onerror = () =>
      reject(req.error);

  });
}

async clearAlerts(ids) {

  return new Promise((resolve, reject) => {

    const tx = this.db.transaction(
      "alerts",
      "readwrite"
    );

    const store =
      tx.objectStore("alerts");

    ids.forEach(id =>
      store.delete(id)
    );

    tx.oncomplete = () =>
      resolve();

    tx.onerror = () =>
      reject(tx.error);

  });
}

async syncAlerts() {

  try {

    const batch =
      await this.getAlertBatch();

    if (!batch.length) {
      return;
    }

    console.log(
      `Uploading ${batch.length} alert changes`
    );

    for (const alert of batch) {

      let url;

      if (alert.action === "add") {

        url =
          `/api/alerts/add/${alert.subscriptionId}/${alert.eventId}`;

      } else {

        url =
          `/api/alerts/remove/${alert.subscriptionId}/${alert.eventId}`;

      }

      const res = await fetch(
        url,
        {
          method: "POST"
        }
      );

      if (res.ok) {

        await this.clearAlerts([
          alert.id
        ]);
      }
    }

  } catch (err) {

    console.warn(
      "Alert sync failed",
      err
    );

  }
}

}

window.CacheManager = new CacheManagerClass();