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