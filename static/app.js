// ---------------- SERVICE WORKER ----------------
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js');
}

// ---------------- HELPERS ----------------
function scrollToContent(){
  const el = document.getElementById('content');
  if (el){
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function goHome(){
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderLine(val){
  if (!val || val === 'null') return '';
  return `<div class="ui-card-body">${val}</div>`;
}

// ---------------- MORE ROW TOGGLE ----------------
function toggleMoreRow(){

  const items = document.querySelectorAll(".more-row");
  const isVisible = items[0].style.display === "block";

  items.forEach(el => {
    el.style.display = isVisible ? "none" : "block";
  });

  if (!isVisible && items.length > 0){
    items[0].scrollIntoView({
      behavior: 'smooth',
      block: 'center'
    });
  }
}

// ---------------- STATIC PAGE LOADER ----------------
async function loadStatic(page){

  const content = document.getElementById("content");

  try {
    const res = await fetch(`/static/${page}.html`);
    const html = await res.text();

    content.innerHTML = `
      <div class="card static-page">
        ${html}
      </div>
    `;

    scrollToContent();

  } catch {
    content.innerHTML = `<div class="card">Content not available</div>`;
  }
}

// ---------------- TENANT LIST LOADER ----------------
async function loadTenants(type){

  const content = document.getElementById("content");

  try {
    const res = await fetch(`/api/tenants/${type}`);
    const data = await res.json();

    let titleMap = {
      food: "Food Vendors",
      exhibit: "Exhibits",
      business: "Business",
      animal: "Animals"
    };

    let h = `<h2>${titleMap[type] || type}</h2>`;

    data.forEach(item => {

      const iconPath = item.icon
        ? `/static/icons/${item.icon}`
        : null;

      const featuredClass = item.featured == 1 ? 'style="background:#f4e7d3;"' : '';

      h += `
        <div class="ui-card" ${featuredClass}>

          ${iconPath ? `
            <div class="ui-card-media">
              <img src="${iconPath}" />
            </div>
          ` : ``}

          <div class="ui-card-content">
            <div class="ui-card-title">${item.name}</div>
            ${renderLine(item.description)}
            ${renderLine(item.location)}
            ${renderLine(item.times)}
          </div>

        </div>
      `;
    });

    content.innerHTML = h;
    scrollToContent();

  } catch (err){
    content.innerHTML = `<div class="card">Error loading data</div>`;
  }
}

// ---------------- SPONSORS LOADER ----------------
async function loadSponsors(){

  const content = document.getElementById("content");

  try {
    const res = await fetch(`/api/sponsors`);
    const data = await res.json();

    let h = `<h2>Sponsors</h2>`;

    data.forEach(item => {

      const iconPath = item.icon
        ? `/static/icons/${item.icon}`
        : null;

      h += `
        <div class="ui-card">

          ${iconPath ? `
            <div class="ui-card-media">
              <img src="${iconPath}" />
            </div>
          ` : ``}

          <div class="ui-card-content">
            <div class="ui-card-title">${item.name}</div>

            ${renderLine(item.description)}

            <div class="ui-card-body"></div>

            <div class="ui-card-body"><b>${item.tier || ''}</b></div>

          </div>

        </div>
      `;
    });

    content.innerHTML = h;
    scrollToContent();

  } catch (err){
    content.innerHTML = `<div class="card">Error loading sponsors</div>`;
  }
}

// ---------------- EVENTS LOADER ----------------
async function loadEvents(type){

  const content = document.getElementById("content");

  try {

    const url = type
      ? `/api/events/${type}`
      : `/api/events`;

    const res = await fetch(url);
    const data = await res.json();

    let h = '';
    let currentDay = '';

    data.forEach(item => {

      // ---------------- GROUP BY DAY ----------------
      if (item.day_date !== currentDay){
        currentDay = item.day_date;

        h += `<h2 style="margin-top:20px;"><b>${currentDay}</b></h2>`;
      }

      // ---------------- ICON ----------------
      const iconPath = item.icon
        ? `/static/icons/${item.icon}`
        : null;

      // ---------------- CARD COLOR LOGIC ----------------
      let bgStyle = '';

      if (item.status === 'cancelled'){
        bgStyle = 'style="background:#fdecea;"'; // light red
      }
      else if (item.status === 'rescheduled'){
        bgStyle = 'style="background:#fff8dc;"'; // light yellow
      }
      else if (item.featured == 1){
        bgStyle = 'style="background:#f4e7d3;"'; // light brown
      }

      // ---------------- TIME RANGE ----------------
      const timeRange = item.start_time && item.end_time
        ? `${item.start_time} - ${item.end_time}`
        : '';

      h += `
        <div class="ui-card" ${bgStyle}>

          ${iconPath ? `
            <div class="ui-card-media">
              <img src="${iconPath}" />
            </div>
          ` : ``}

          <div class="ui-card-content">
            <div class="ui-card-title">${item.name}</div>

            ${renderLine(item.description)}

            <div class="ui-card-body"><b>${item.price || ''}</b></div>

            ${renderLine(item.location)}

            ${renderLine(timeRange)}

          </div>

        </div>
      `;
    });

    content.innerHTML = h;
    scrollToContent();

  } catch (err){
    content.innerHTML = `<div class="card">Error loading events</div>`;
  }
}

// ---------------- MAP ----------------
function showMap(){

  document.getElementById('content').innerHTML = `
    <div class="card">
      Pinch and spread to explore. Red dot is your location. Tap yellow ? for info.
    </div>
    <div id="map"></div>
  `;

  scrollToContent();

  const MAP_BOUNDS = {
    north: 43.06114,
    south: 43.05628,
    west: -77.24221,
    east: -77.23547
  };

  const LAT_TOL = 0.0005;
  const LON_TOL = 0.0005;

  function isInside(lat, lon) {
    return (
      lat <= MAP_BOUNDS.north + LAT_TOL &&
      lat >= MAP_BOUNDS.south - LAT_TOL &&
      lon >= MAP_BOUNDS.west - LON_TOL &&
      lon <= MAP_BOUNDS.east + LON_TOL
    );
  }

  function latLonToPercent(lat, lon) {
    const x = (lon - MAP_BOUNDS.west) / (MAP_BOUNDS.east - MAP_BOUNDS.west);
    const y = (MAP_BOUNDS.north - lat) / (MAP_BOUNDS.north - MAP_BOUNDS.south);
    return { x: x * 100, y: y * 100 };
  }

  // ---------------- SMOOTHING ----------------
  let positionHistory = [];

  function smoothPosition(lat, lon) {
    positionHistory.push({ lat, lon });

    if (positionHistory.length > 5) {
      positionHistory.shift();
    }

    let avgLat = positionHistory.reduce((sum, p) => sum + p.lat, 0) / positionHistory.length;
    let avgLon = positionHistory.reduce((sum, p) => sum + p.lon, 0) / positionHistory.length;

    return { lat: avgLat, lon: avgLon };
  }

  // ---------------- MOVEMENT FILTER ----------------
  let lastLat = null;
  let lastLon = null;

  function hasMovedEnough(lat, lon) {
    if (!lastLat) return true;

    const dist = Math.sqrt(
      Math.pow(lat - lastLat, 2) +
      Math.pow(lon - lastLon, 2)
    );

    return dist > 0.00005;
  }

  const mapEl = document.getElementById('map');

  // ---------------- POI ZONES ----------------
  const POIS = [
    { id: "entertainment", left: 32.39, top: 17.61, width: 11.42, height: 9.35, text: "Beer tent, main stage and seating area" },
    { id: "grandstand", left: 38.58, top: 47.00, width: 12.24, height: 17.46, text: "Bleacher seating for demolition derby and track events" },
    { id: "midway", left: 33.06, top: 28.87, width: 12.24, height: 16.06, text: "Rides, games and more food" },
    { id: "food", left: 48.92, top: 23.19, width: 16.74, height: 5.17, text: "Snack, drinks and meals with bench seating" },
    { id: "entrance", left: 54.60, top: 6.61, width: 11.21, height: 14.77, text: "Flag pole seating area, Floral Hall and 4-H Building" },
    { id: "commercial", left: 44.89, top: 14.67, width: 8.73, height: 8.11, text: "Two buildings of commercial and organization information" },
    { id: "agriculture", left: 66.58, top: 16.22, width: 13.07, height: 13.38, text: "Livestock displays, judging and events" },
    { id: "stable", left: 73.14, top: 32.75, width: 9.81, height: 23.50, text: "Horse stables and track event preparation area" }
  ];

  POIS.forEach(poi => {
    const z = document.createElement('div');
    z.className = 'zone';

    z.style.left = poi.left + '%';
    z.style.top = poi.top + '%';
    z.style.width = poi.width + '%';
    z.style.height = poi.height + '%';

    z.addEventListener('click', (e) => {
      if (e.clientX === 0 && e.clientY === 0) return;
      showPOIPopup(poi, e);
    });

    mapEl.appendChild(z);
  });

  function showPOIPopup(poi, event){

    const existing = document.querySelector('.poi-popup');
    if (existing) existing.remove();

    const popup = document.createElement('div');
    popup.className = 'poi-popup';

    const content = document.createElement('div');
    content.className = 'poi-content';

    content.innerHTML = `
      <h3>${poi.id.toUpperCase()}</h3>
      <p>${poi.text}</p>
    `;

    popup.appendChild(content);
    document.body.appendChild(popup);

    let x = event.clientX || 0;
    let y = event.clientY || 0;

    if (x === 0 && y === 0 && event.target) {
      const r = event.target.getBoundingClientRect();
      x = r.left + r.width / 2;
      y = r.top + r.height / 2;
    }

    content.style.position = 'fixed';
    content.style.left = x + 'px';
    content.style.top = y + 'px';
    content.style.transform = 'translate(-50%, -110%)';

    const rect = content.getBoundingClientRect();

    if (rect.left < 10) content.style.left = '10px';
    if (rect.right > window.innerWidth - 10)
      content.style.left = (window.innerWidth - rect.width - 10) + 'px';

    if (rect.top < 10)
      content.style.top = (y + 20) + 'px';

    popup.addEventListener('click', () => popup.remove());
    content.addEventListener('click', (e) => e.stopPropagation());
  }

  let pin = document.createElement('div');
  pin.className = 'pin';
  mapEl.appendChild(pin);

  function updateUserPosition(pos) {

    const accuracy = pos.coords.accuracy;
    if (accuracy > 40) return;

    let lat = pos.coords.latitude;
    let lon = pos.coords.longitude;

    const smoothed = smoothPosition(lat, lon);

    if (!hasMovedEnough(smoothed.lat, smoothed.lon)) return;

    lastLat = smoothed.lat;
    lastLon = smoothed.lon;

    if (!isInside(smoothed.lat, smoothed.lon)) {
      pin.style.display = 'none';
      return;
    }

    const { x, y } = latLonToPercent(smoothed.lat, smoothed.lon);

    const clampedX = Math.min(100, Math.max(0, x));
    const clampedY = Math.min(100, Math.max(0, y));

    pin.style.display = 'block';
    pin.style.left = clampedX + '%';
    pin.style.top = clampedY + '%';

    const haloSize = Math.min(accuracy * 2, 60);
    pin.style.boxShadow = `0 0 ${haloSize}px rgba(255,0,0,0.5)`;
  }

  if (!navigator.geolocation) {
    alert("Location not supported");
    return;
  }

  navigator.geolocation.watchPosition(
    updateUserPosition,
    (err) => console.log(err),
    {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 10000
    }
  );
}

// ---------------- PAGE ROUTER ----------------
async function loadPage(page){

  // 🔴 Preserve "More row" behavior
  if (page !== "more"){
    const isMoreRowButton = document.querySelector(
      `.more-row[data-page="${page}"]`
    );

    if (!isMoreRowButton){
      document.querySelectorAll(".more-row").forEach(el => {
        el.style.display = "none";
      });
    }
  }

  // ---------------- MORE BUTTON ----------------
  if (page === "more"){
    toggleMoreRow();
    return;
  }

  // ---------------- STATIC PAGES ----------------
  const staticPages = {
    midway: "midway",
    facilities: "facilities",
    tickets: "tickets",
    faqs: "faqs",
    about: "about",
    firstaid: "firstaid"
  };

  if (staticPages[page]){
    loadStatic(staticPages[page]);
    return;
  }

  // ---------------- TENANT PAGES ----------------
  const tenantMap = {
    food: "food",
    exhibits: "exhibit",
    business: "business",
    animals: "animal"
  };

  if (tenantMap[page]){
    loadTenants(tenantMap[page]);
    return;
  }

  // ---------------- SPONSORS ----------------
  if (page === "sponsors"){
    loadSponsors();
    return;
  }

// ---------------- EVENTS PAGES ----------------
if (page === "music"){
  loadEvents("music");
  return;
}

if (page === "grandstand"){
  loadEvents("grandstand");
  return;
}

if (page === "calendar"){
  loadEvents(); // no type = full calendar
  return;
}

// ---------------- MAP ----------------
if (page === "map"){
  showMap();
  return;
}

  // ---------------- EVERYTHING ELSE (DISABLED FOR NOW) ----------------
  const content = document.getElementById("content");
  content.innerHTML = `
    <div class="card">
      Feature coming soon
    </div>
  `;
}

// ---------------- MENU BINDING ----------------
document.querySelectorAll(".icon-card").forEach(card => {

  const page = card.dataset.page;
  if (!page) return;

  card.addEventListener("click", () => loadPage(page));
});

// ---------------- GLOBAL SETTINGS ----------------

// Disable long-press context menu (mobile UX)
document.addEventListener("contextmenu", e => e.preventDefault());