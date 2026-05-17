const surveyConfig = [
  {
    id: 1,
    question: "What is your favorite Fair attraction?",
    max: 3,
    options: [
      {id:1, label:"Animals"},
      {id:2, label:"Food Vendors"},
      {id:3, label:"Music"},
      {id:4, label:"Midway"},
      {id:5, label:"Exhibitor Displays"},
      {id:6, label:"Business Booths"},
      {id:7, label:"Grandstand Events"},
      {id:8, label:"Entertainment Alley"},
      {id:9, label:"Other (add comment below)"}
    ]
  },
  {
    id: 2,
    question: "What would you like to see more of?",
    max: 3,
    options: [
      {id:1, label:"Animals"},
      {id:2, label:"Food Vendors"},
      {id:3, label:"Music"},
      {id:4, label:"Midway"},
      {id:5, label:"Exhibitor Displays"},
      {id:6, label:"Business Booths"},
      {id:7, label:"Grandstand Events"},
      {id:8, label:"Entertainment Alley"},
      {id:9, label:"Other (add comment below)"}
    ]
  },
  {
    id: 3,
    question: "How long are you staying today?",
    max: 1,
    options: [
      {id:1, label:"Less than 1 hour"},
      {id:2, label:"1-2 hours"},
      {id:3, label:"3-4 hours"},
      {id:4, label:"All Day"}
    ]
  }
];

let surveyAnswers = {};
let surveyComment = "";

const VAPID_PUBLIC_KEY = "BPAr2_PD2PGYvI0EsANa5gCXJ6z_hupiV6Bjdt7jxMaL_0D_QFdF-PbP3wDDNBM8PNzvbWRQegM9WH0yOyDVJ00";

// --------- PLATFORM DETECTION ----------
const isApple = /iphone|ipad|ipod/i.test(navigator.userAgent);
const isStandalone = window.matchMedia('(display-mode: standalone)').matches
  || window.navigator.standalone === true;

let todayRefreshTimer = null;

let subscriptionId = 0;
let pushAuthorized = false;
let alertSet = new Set();

let deviceId = localStorage.getItem("device_id");

if (!deviceId){
  deviceId = crypto.randomUUID();
  localStorage.setItem("device_id", deviceId);
}

function ordinal(n){
  if (n % 100 >= 11 && n % 100 <= 13) return n + "th";

  switch (n % 10){
    case 1: return n + "st";
    case 2: return n + "nd";
    case 3: return n + "rd";
    default: return n + "th";
  }
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function openVotePicker(category){

  const data = voteData[category];

  const overlay = document.createElement("div");
  overlay.className = "vote-modal";

  overlay.innerHTML = `
    <div class="vote-modal-content">

      <div class="vote-modal-header">
        Select ${category.charAt(0).toUpperCase() + category.slice(1)}
      </div>

      <input
        type="text"
        placeholder="Search..."
        oninput="filterVoteList(this.value)"
        class="vote-search"
      >

      <div id="vote-list">
        ${data.map(x => `
          <div class="vote-item ${voteSelection[category] === x.tenant_id ? 'selected' : ''}"
               onclick="selectVoteModal('${category}', ${x.tenant_id}, this)">
            ${x.name}
          </div>
        `).join('')}
      </div>

      <button onclick="closeVoteModal()">Close</button>

    </div>
  `;

  document.body.appendChild(overlay);
}

function closeVoteModal(){
  const modal = document.querySelector(".vote-modal");
  if (modal) modal.remove();
}

function selectVoteModal(category, id, el){

  voteSelection[category] = id;

  document.querySelectorAll(".vote-item")
    .forEach(x => x.classList.remove("selected"));

  el.classList.add("selected");

  setTimeout(() => {
    closeVoteModal();
    loadVotePage(); // refresh cards
  }, 150);
}

function filterVoteList(text){

  text = text.toLowerCase();

  document.querySelectorAll(".vote-item").forEach(el => {
    const match = el.innerText.toLowerCase().includes(text);
    el.style.display = match ? "block" : "none";
  });
}

function showInstallInstructions(){
  alert(
    "To install:\n\n" +
    "1. Tap the Share icon (square with arrow)\n" +
    "2. Select 'Add to Home Screen'\n" +
    "3. Open the app from your home screen\n" +
    "4. Then enable notifications"
  );
}

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

  // keep smooth scroll exactly as-is
  window.scrollTo({ top: 0, behavior: 'smooth' });

  // 🔥 clear AFTER scroll completes (timed)
  setTimeout(() => {

    // stop any running timers (like Today page)
    if (todayRefreshTimer){
      clearInterval(todayRefreshTimer);
      todayRefreshTimer = null;
    }

    const content = document.getElementById("content");
    if (content){
      content.innerHTML = '';
    }

  }, 600); // small delay so scroll happens first
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

function toggleVoteSection(id){

  const all = document.querySelectorAll('.vote-list');

  all.forEach(el => {
    if (el.id === 'vote-' + id){
      el.classList.toggle('active');
    } else {
      el.classList.remove('active');
    }
  });

  // optional: scroll opened section into view
  const el = document.getElementById('vote-' + id);
  if (el && el.classList.contains('active')){
    el.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    });
  }
}

// ---------------- STATIC PAGE LOADER ----------------
async function loadStatic(page){

  const content = document.getElementById("content");

  try {
    const version = localStorage.getItem("static_version") || "1";
    const res = await fetch(`/static/${page}.html?v=${version}`);
    const html = await res.text();

    let titleMap = {
      midway: "Midway Rides <br> and Entertainment",
      facilities: "Restroom Facilities",
      tickets: "Tickets",
      faqs: "Frequently Asked <br> Questions",
      about: "About the Fair",
      firstaid: "First Aid"
    };

    let title = titleMap[page] || '';

    let searchBox = '';

    if (page === 'faqs'){
      searchBox = `
        <input
          type="text"
          placeholder="Search FAQs..."
          class="faq-search"
          oninput="filterFAQs(this.value)"
        >
      `;
    }

    content.innerHTML = `
      <div class="vote-thanks">${title}</div>

      ${searchBox}

      <div class="card static-page" id="faqContainer">
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
      exhibit: "Exhibitor Displays",
      business: "Business Booths",
      animal: "Animals"
    };

    let subTitleMap = {
      food: "Snacks, drinks and meals for all tastes",
      exhibit: "Information and displays by police, <br> government and community organizations",
      business: "Home, farm and personal <br> business products and services",
      animal: "Animal displays, judging and <br> demonstrations for the whole family"
    };

    let h = `<div class="vote-thanks">${titleMap[type] || type}</div>`;
    h += `<div class="vote-thanks-note">${subTitleMap[type] || type}</div>`;

    data.forEach(item => {

      const iconPath = item.icon
        ? `/static/icons/${item.icon}`
        : null;

      const featuredClass = item.featured == 1
        ? 'style="background:#f4e7d3; border:2px solid #8b5a2b;"'
        : '';

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

    let h = `<div class="vote-thanks">Sponsors</div>`;
    h += `<div class="vote-thanks-note">Please support our sponsors</div>`;

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

    let titleMap = {
      today: "Today's Events",
      music: "Musical Entertainment",
      grandstand: "Grandstand Events",
      calendar: "Fair Calendar"
    };

    let subTitleMap = {
      today: "Happening today. <br>Get reminder notifications <br> of favorite events",
      music: "All music shows are free",
      grandstand: "Tap Tickets on main menu <br> for paid events",
      calendar: "Full week of shows and events"
    };

// determine title and subtitle

    let title = titleMap[type] || titleMap["calendar"];
    let subTitle = subTitleMap[type] || subTitleMap["calendar"];

    let h = `<div class="vote-thanks">${title}</div>`;
    h += `<div class="vote-thanks-note">${subTitle}</div>`;

    let currentDay = '';
    const today = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric'
    });

    data.forEach(item => {

      // ---------------- GROUP BY DAY ----------------
    if (item.day_date !== currentDay){
      currentDay = item.day_date;

      // remove commas/ordinals for comparison
      const normalizedCurrent = currentDay
        .replace(/,/g, '')
        .replace(/\b(\d+)(st|nd|rd|th)\b/g, '$1');

      const normalizedToday = today.replace(/,/g, '');

      const scrollTag =
        normalizedCurrent.includes(normalizedToday)
          ? 'data-scroll-day="today"'
          : '';

      h += `
        <h2
          style="margin-top:20px;"
          ${scrollTag}
        >
          <b>${currentDay}</b>
        </h2>
      `;
    }

      // ---------------- ICON ----------------
      const iconPath = item.icon
        ? `/static/icons/${item.icon}`
        : null;

      // ---------------- CARD COLOR LOGIC ----------------
        let bgStyle = '';

        if (item.status === 'cancelled'){
          bgStyle = 'style="background:#fdecea; border:2px solid #c62828;"'; // dark red
        }
        else if (item.status === 'changed'){
          bgStyle = 'style="background:#fff8dc; border:2px solid #e6c200;"'; // dark yellow
        }
        else if (item.featured == 1){
          bgStyle = 'style="background:#f4e7d3; border:2px solid #8b5a2b;"'; // dark brown
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

    // 🔥 SMART CALENDAR SCROLL
    if (!type){

      const todayEl = document.querySelector('[data-scroll-day="today"]');

    function scrollWithOffset(el){

      const offset = 12;

      const targetY =
        el.getBoundingClientRect().top
        + window.pageYOffset
        - offset;

      const startY = window.pageYOffset;
      const distance = targetY - startY;

      const duration = 2400; // milliseconds (adjust to taste)

      let startTime = null;

      function easeInOutQuad(t){
        return t < 0.5
          ? 2 * t * t
          : 1 - Math.pow(-2 * t + 2, 2) / 2;
      }

      function animateScroll(currentTime){

        if (!startTime){
          startTime = currentTime;
        }

        const elapsed = currentTime - startTime;

        const progress = Math.min(elapsed / duration, 1);

        const eased = easeInOutQuad(progress);

        window.scrollTo(
          0,
          startY + (distance * eased)
        );

        if (progress < 1){
          requestAnimationFrame(animateScroll);
        }
      }

      requestAnimationFrame(animateScroll);
    }

      if (todayEl){
        scrollWithOffset(todayEl);
      } else {
        scrollToContent();
      }

    } else {
      scrollToContent();
    }

  } catch (err){
    content.innerHTML = `<div class="card">Error loading events</div>`;
  }
}

// ---------------- VOTE ---------------
async function loadVotePage(){

  const content = document.getElementById("content");

  const votedRes = await fetch(`/api/vote/status/${deviceId}`);
  const voted = await votedRes.json();

    let note = '';

    if (true) { // always show if you want
      note = `<div class="vote-thanks-note">Vote once per day to see results</div>`;
    }

  if (voted.length > 0){
    loadVoteResults();
    return;
  }

  const [food, exhibit, business] = await Promise.all([
    fetch("/api/tenants/food").then(r=>r.json()),
    fetch("/api/tenants/exhibit").then(r=>r.json()),
    fetch("/api/tenants/business").then(r=>r.json())
  ]);

  // store globally for picker
  window.voteData = { food, exhibit, business };

    function renderCard(label, category, icon){

      const selected = voteSelection[category];

      let name = "&lt;None Selected&gt;";

      if (selected){
        const found = voteData[category].find(x => x.tenant_id === selected);
        if (found){
          name = found.name;
        }
      }

    return `
      <div class="ui-card vote-card">

        <div class="ui-card-media">
          <img src="/static/icons/menu/${icon}.webp">
        </div>

        <div class="ui-card-content">

          <div class="ui-card-title">${label}</div>

          <div class="ui-card-body"></div>   <!-- blank line -->

          <div class="ui-card-body ${selected ? '' : 'placeholder'}">
            ${name}
          </div>

        </div>

        <!-- ✅ MOVED OUTSIDE -->
        <div class="ui-card-actions">
          <button
            class="alert-btn ${selected ? 'active' : ''}"
            onclick="openVotePicker('${category}')"
          >
            ${selected ? 'Change' : 'Select'}
          </button>
        </div>

      </div>
    `;
    }

  content.innerHTML = `
    <div class="vote-thanks">Vote for Best of Fair</div>
    ${note}
    ${renderCard("Best Food Vendor", "food", "food")}
    ${renderCard("Best Exhibitor Display", "exhibit", "exhibits")}
    ${renderCard("Best Business Booth", "business", "business")}

    <button class="vote-submit-btn" onclick="submitVote()">Submit Ballot</button>
  `;

  scrollToContent();
}

setTimeout(() => {
  toggleVoteSection('food');
}, 100);

let voteSelection = {
  food: null,
  exhibit: null,
  business: null
};

function selectVote(category, id, el){

  voteSelection[category] = id;

  document.querySelectorAll(`#vote-${category} .vote-option`)
    .forEach(x => x.classList.remove("selected"));

  el.classList.add("selected");
}

async function submitVote(){

  const hasSelection =
    voteSelection.food ||
    voteSelection.exhibit ||
    voteSelection.business;

  if (!hasSelection){
    alert("Please select at least one category");
    return;
  }

  if (!confirm("Submit your vote? This cannot be changed.")) return;

  const res = await fetch("/api/vote", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({
      device_id: deviceId,
      votes: voteSelection
    })
  });

  const result = await res.json();

    if (result.status === "ok" || result.status === "already_voted"){
      loadVoteResults();
    } else {
      alert("Vote failed");
    }
}

async function loadVoteResults(){

  const content = document.getElementById("content");

  const res = await fetch("/api/vote/results");
  const data = await res.json();

  const now = new Date();
  const ts = now.toLocaleString();

  function renderCard(title, icon, list){

    return `
      <div class="ui-card vote-result-card">

        <div class="ui-card-media">
          <img src="/static/icons/menu/${icon}.webp">
        </div>

        <div class="ui-card-content">

          <div class="vote-result-header">
            <div class="vote-result-title">${title}</div>
            <div class="vote-result-votes">Votes</div>
          </div>

          ${list.map((x,i)=>`
            <div class="vote-result-row">
              <div class="vote-result-name">
                <span class="vote-rank">${ordinal(i+1)}</span> ${x.tenant_name}
              </div>
              <div class="vote-result-count">
                ${x.vote_count}
              </div>
            </div>
          `).join('')}

        </div>

      </div>
    `;
  }

content.innerHTML = `

  <div class="vote-thanks">Thanks for Voting Today!</div>

  <div class="vote-thanks-note">Vote again tomorrow. Refresh anytime.</div>

  <button class="vote-submit-btn" onclick="refreshVoteResults()">
    Refresh
  </button>

  <h2 class="vote-results-heading">Ranking at ${ts}</h2>

  ${renderCard("Best Food Vendor", "food", data.food)}
  ${renderCard("Best Exhibitor Display", "exhibits", data.exhibit)}
  ${renderCard("Best Business Booth", "business", data.business)}

`;

  scrollToContent();
}

async function refreshVoteResults(){

  // save current scroll position
  const scrollPos = window.scrollY;

  const content = document.getElementById("content");

  const res = await fetch("/api/vote/results");
  const data = await res.json();

  const now = new Date();
  const ts = now.toLocaleString();

  function renderCard(title, icon, list){
    return `
      <div class="ui-card vote-result-card">

        <div class="ui-card-media">
          <img src="/static/icons/menu/${icon}.webp">
        </div>

        <div class="ui-card-content">

          <div class="vote-result-header">
            <div class="vote-result-title">${title}</div>
            <div class="vote-result-votes">Votes</div>
          </div>

          ${list.map((x,i)=>`
            <div class="vote-result-row">
              <div class="vote-result-name">
                <span class="vote-rank">${ordinal(i+1)}</span> ${x.tenant_name}
              </div>
              <div class="vote-result-count">
                ${x.vote_count}
              </div>
            </div>
          `).join('')}

        </div>

      </div>
    `;
  }

  content.innerHTML = `

    <div class="vote-thanks">Thanks for Voting Today!</div>

    <div class="vote-thanks-note">Vote again tomorrow. Refresh anytime.</div>

    <button class="vote-submit-btn" onclick="refreshVoteResults()">
      Refresh
    </button>

    <h2 class="vote-results-heading">Ranking at ${ts}</h2>

    ${renderCard("Best Food Vendor", "food", data.food)}
    ${renderCard("Best Exhibitor Display", "exhibits", data.exhibit)}
    ${renderCard("Best Business Booth", "business", data.business)}
  `;

  // 🔥 restore exact scroll position
  window.scrollTo(0, scrollPos);
}

// ---------------- SURVEY -------------
async function loadSurvey(){

  const content = document.getElementById("content");

  const res = await fetch(`/api/survey/status/${deviceId}`);
  const status = await res.json();

  if (status.submitted){
    renderSurveyThankYou();
    return;
  }

    let h = `
      <div class="vote-thanks">Fair Survey</div>
    `;

    h += `
      <div class="vote-thanks-note">
        Answer a few quick questions and <br>
        get a 10% off discount coupon<br>
        for the Wayne County Fair Store.
      </div>
    `;

  surveyConfig.forEach(q => {

    h += `
      <div class="ui-card">

        <div class="ui-card-media">
          <img src="/static/icons/fair.webp" />
        </div>

        <div class="ui-card-content">
          <div class="ui-card-title">${q.question}</div>
          <div class="ui-card-body">(Pick up to ${q.max})</div>

          <div class="survey-options">
            ${q.options.map(o => `
              <button class="survey-btn"
                onclick="toggleSurvey(${q.id}, ${o.id}, ${q.max}, this)">
                ${o.label}
              </button>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  });

  h += `
    <div class="ui-card">

      <div class="ui-card-media">
        <img src="/static/icons/fair.webp" />
      </div>

      <div class="ui-card-content">
        <div class="ui-card-title">Comments?</div>
        <textarea class="survey-comment"
          oninput="updateSurveyComment(this.value)"></textarea>
      </div>
    </div>

    <button id="surveySubmitBtn" class="vote-submit-btn" disabled onclick="submitSurvey()">
      Submit Survey
    </button>
  `;

  content.innerHTML = h;
  scrollToContent();
}

function toggleSurvey(qid, aid, max, btn){

  if (!surveyAnswers[qid]){
    surveyAnswers[qid] = new Set();
  }

  const set = surveyAnswers[qid];

  if (set.has(aid)){
    set.delete(aid);
    btn.classList.remove("active");
  }
  else {
    if (set.size >= max) return;

    if (max === 1){
      set.clear();
      document.querySelectorAll(`[onclick^="toggleSurvey(${qid},"]`)
        .forEach(b => b.classList.remove("active"));
    }

    set.add(aid);
    btn.classList.add("active");
  }

  updateSurveySubmit();
}

function updateSurveyComment(val){
  surveyComment = val;
  updateSurveySubmit();
}

function updateSurveySubmit(){

  const hasAnswer = Object.values(surveyAnswers)
    .some(set => set.size > 0);

  const hasComment = surveyComment.trim().length > 0;

  document.getElementById("surveySubmitBtn").disabled =
    !(hasAnswer || hasComment);
}

async function submitSurvey(){

  if (!confirm("Submit survey? Answers cannot be changed.")) return;

  let payload = [];

  Object.entries(surveyAnswers).forEach(([qid, set]) => {
    set.forEach(aid => {
      payload.push({
        question_id: Number(qid),
        answer_id: aid
      });
    });
  });

  const res = await fetch("/api/survey/submit", {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({
      device_id: deviceId,
      answers: payload,
      comment: surveyComment
    })
  });

  const result = await res.json();

  if (result.status === "ok" || result.status === "already_submitted"){
    renderSurveyThankYou();
  } else {
    alert("Submission failed");
  }
}

function renderSurveyThankYou(){

  const content = document.getElementById("content");

    content.innerHTML = `
      <div class="vote-thanks">Thanks <br>for Your Input!</div>
      <div class="vote-thanks-note">
        Use your coupon at the Fair Store
      </div>

      <div class="ui-card coupon-card coupon-large">

        <img src="/static/icons/fair.webp" class="coupon-logo" />

        <div class="coupon-amount">10% OFF</div>

        <div class="coupon-location">Wayne County Fair Store</div>
        <div class="coupon-location">Inside Floral Hall</div>

        <div class="coupon-note">
          Show this screen to redeem
        </div>

      </div>
    `;

  scrollToContent();
}

// ---------------- MAP ----------------
function showMap(){

  document.getElementById('content').innerHTML = `

    <div class="vote-thanks">Fairground Map</div>

    <div class="vote-thanks-note">
      Pinch and spread to explore.<br>
      Red dot is your location.<br>
      Tap yellow ? for info.
    </div>
    <div id="map">
      <div id="mapInner"></div>
    </div>
  `;

  scrollToContent();

  const MAP_BOUNDS = {
    north: 43.061104,
    south: 43.056393,
    west: -77.240839,
    east: -77.236086
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
    const mapInner = document.getElementById('mapInner');

let currentScale = 1;

let startDistance = 0;
let startScale = 1;

let currentX = 0;
let currentY = 0;

let startPanX = 0;
let startPanY = 0;

let isDragging = false;

function applyMapTransform(){

  mapInner.style.transform =
    `translate(${currentX}px, ${currentY}px) scale(${currentScale})`;
}

function getDistance(touches){

  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;

  return Math.sqrt(dx * dx + dy * dy);
}

/* ---------- PINCH START ---------- */

mapEl.addEventListener('touchstart', (e) => {

  /* pinch zoom */
  if (e.touches.length === 2){

    startDistance = getDistance(e.touches);
    startScale = currentScale;
  }

  /* drag pan */
  if (e.touches.length === 1){

    isDragging = true;

    startPanX = e.touches[0].clientX - currentX;
    startPanY = e.touches[0].clientY - currentY;
  }

}, { passive:false });

/* ---------- TOUCH MOVE ---------- */

mapEl.addEventListener('touchmove', (e) => {

  e.preventDefault();

  /* ---------- PINCH ---------- */

  if (e.touches.length === 2){

    const distance = getDistance(e.touches);

    currentScale =
      startScale * (distance / startDistance);

    currentScale =
      Math.max(1, Math.min(currentScale, 4));

    applyMapTransform();
  }

  /* ---------- PAN ---------- */

  else if (e.touches.length === 1 && isDragging){

    currentX =
      e.touches[0].clientX - startPanX;

    currentY =
      e.touches[0].clientY - startPanY;

    applyMapTransform();
  }

}, { passive:false });

/* ---------- TOUCH END ---------- */

mapEl.addEventListener('touchend', () => {

  isDragging = false;

}, { passive:false });

  // ---------------- POI ZONES ----------------
  const POIS = [
    { id: "Entertainment",
        left: 15.77, top: 14.43, width: 15.62, height: 9.71,
        text: "Beer tent, main stage and seating area" },
    { id: "Grandstand",
        left: 20.66, top: 45.44, width: 17.15, height: 19.26,
        text: "Bleacher seating for demolition derby and track events" },
    { id: "Midway",
        left: 14.96, top: 25.11, width: 17.3, height: 19.53,
        text: "Rides, games and more food" },
    { id: "Food Court",
        left: 38.32, top: 22.10, width: 17.01, height: 5.53,
        text: "Snack, drinks and meals with ample seating" },
    { id: "Main Gate",
        left: 49.78, top: 3.38, width: 7.3, height: 8.85,
        text: "Gate, flag pole, seating and welcome area" },
    {
        id: "Commercial 1",
        left: 38.10,
        top: 14.43,
        width: 5.11,
        height: 7.14,
        text: "Business and organization booths and displays",

        modal: {
          title: "Commercial Building 1",
          image: "/static/maps/commercial_1_plan.webp"
        }
    },
    {
        id: "Commercial 2",
        left: 31.75,
        top: 14.22,
        width: 5.99,
        height: 9.44,
        text: "Business and organization booths and displays",

        modal: {
          title: "Commercial Building 2",
          image: "/static/maps/commercial_2_plan.webp"
        }
    },
    { id: "Information",
        left: 43.94, top: 18.13, width: 6.28, height: 3.76,
        text: "Information and announcer booth" },
    { id: "4-H Building",
        left: 57.96, top: 3.33, width: 7.52, height: 9.17,
        text: "4-H exhibits and demonstrations" },
    { id: "History Building",
        left: 56.86, top: 23.23, width: 9.85, height: 5.53,
        text: "Historical museum" },
    {
        id: "Floral Hall",
        left: 50.44,
        top: 12.77,
        width: 7.37,
        height: 8.91,
        text: "Government and organization exhibits, domestics",

        modal: {
          title: "Floral Hall",
          image: "/static/maps/floral_plan.webp"
        }
    },
    { id: "Livestock Tent",
        left: 61.97, top: 14.27, width: 8.76, height: 8.53,
        text: "Animal exhibits and demonstrations" },
    { id: "Cattle Barn",
        left: 71.02, top: 14.16, width: 9.78, height: 13.89,
        text: "Animal exhibits and demonstrations" },
    { id: "Horse Barn",
        left: 72.12, top: 29.67, width: 13.07, height: 26.23,
        text: "Horse stables and tack displays" },
    { id: "Weekly Events",
        left: 41.39, top: 3.43, width: 7.52, height: 9.82,
        text: "Weekly show tent, Sunshine shed and greased pole contest" },
    { id: "Track Area",
        left: 56.28, top: 29.45, width: 13.94, height: 19.80,
        text: "Antiques, Livestock judging and exhibition ring" }
  ];

  POIS.forEach(poi => {
    const z = document.createElement('div');
    z.className = 'zone';

    z.style.left = poi.left + '%';
    z.style.top = poi.top + '%';
    z.style.width = poi.width + '%';
    z.style.height = poi.height + '%';

    z.addEventListener('click', (e) => {

      // rich fullscreen modal POIs
      if (poi.modal){
        showPOIModal(poi);
        return;
      }

      // existing lightweight popup POIs
      showPOIPopup(poi, e);
    });

    mapInner.appendChild(z);
  });

   function showPOIModal(poi){

      // remove existing popup if open
      const existingPopup = document.querySelector('.poi-popup');
      if (existingPopup){
        existingPopup.remove();
      }

      // remove existing modal if open
      const existingModal = document.querySelector('.poi-modal');
      if (existingModal){
        existingModal.remove();
      }

      // lock body scroll while modal open
      document.body.style.overflow = 'hidden';

      const modal = document.createElement('div');
      modal.className = 'poi-modal';

      modal.innerHTML = `
        <div class="poi-modal-content">

          <button class="poi-modal-close">
            ✕
          </button>

          <div class="poi-modal-title">
            ${poi.modal.title}
          </div>

          <div class="poi-modal-text">
            ${poi.text}
          </div>

<div class="poi-modal-image-wrap">

  <div class="poi-modal-image-inner">

    <img
      src="${poi.modal.image}"
      class="poi-modal-image"
      alt="${poi.modal.title}"
    >

  </div>

</div>

        </div>
      `;

      document.body.appendChild(modal);

const imageWrap =
  modal.querySelector('.poi-modal-image-wrap');

const imageInner =
  modal.querySelector('.poi-modal-image-inner');

let scale = 1;

let startDistance = 0;
let startScale = 1;

let x = 0;
let y = 0;

let startX = 0;
let startY = 0;

let dragging = false;

function applyTransform(){

  imageInner.style.transform =
    `translate(${x}px, ${y}px) scale(${scale})`;
}

function getDistance(touches){

  const dx =
    touches[0].clientX -
    touches[1].clientX;

  const dy =
    touches[0].clientY -
    touches[1].clientY;

  return Math.sqrt(dx * dx + dy * dy);
}

/* ---------- START ---------- */

imageWrap.addEventListener('touchstart', (e) => {

  if (e.touches.length === 2){

    startDistance = getDistance(e.touches);
    startScale = scale;
  }

  if (e.touches.length === 1){

    dragging = true;

    startX =
      e.touches[0].clientX - x;

    startY =
      e.touches[0].clientY - y;
  }

}, { passive:false });

/* ---------- MOVE ---------- */

imageWrap.addEventListener('touchmove', (e) => {

  e.preventDefault();

  /* pinch zoom */
  if (e.touches.length === 2){

    const distance =
      getDistance(e.touches);

    scale =
      startScale *
      (distance / startDistance);

    scale =
      Math.max(1, Math.min(scale, 5));

    applyTransform();
  }

  /* pan */
  else if (
    e.touches.length === 1 &&
    dragging
  ){

    x =
      e.touches[0].clientX - startX;

    y =
      e.touches[0].clientY - startY;

    applyTransform();
  }

}, { passive:false });

/* ---------- END ---------- */

imageWrap.addEventListener('touchend', () => {

  dragging = false;

}, { passive:false });

      function closeModal(){
        document.body.style.overflow = '';
        modal.remove();
      }

      // close button
      modal
        .querySelector('.poi-modal-close')
        .addEventListener('click', closeModal);

      // tap dark background
      modal.addEventListener('click', (e) => {
        if (e.target === modal){
          closeModal();
        }
      });
    }

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

    let x = 0;
    let y = 0;

    // ✅ Normal click
    if (event.clientX && event.clientY){
      x = event.clientX;
      y = event.clientY;
    }

    // 🍎 iOS touch fallback
    else if (event.touches && event.touches.length > 0){
      x = event.touches[0].clientX;
      y = event.touches[0].clientY;
    }

    // ✅ Final fallback (center of tapped zone)
    if (!x || !y){
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
  mapInner.appendChild(pin);

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

    if (todayRefreshTimer){
      clearInterval(todayRefreshTimer);
      todayRefreshTimer = null;
    }

  // 🔴 Preserve "More row" behavior
// 🔥 HANDLE MORE ROW VISIBILITY (supports multiple rows)
if (page !== "more"){

  // check if clicked item exists in ANY more-row
  const isMoreRowButton = document.querySelector(
    `.more-row[data-page="${page}"]`
  );

  // if NOT part of expanded rows → collapse all
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

// -------------- SURVEY ---------------
if (page === "survey"){
  loadSurvey();
  return;
}

// ---------------- MAP ----------------
if (page === "map"){
  showMap();
  return;
}

// -------------- TODAY ----------------
if (page === "today"){
  loadTodayEvents();
  return;
}

// --------------- VOTE ----------------
if (page === "vote"){
  loadVotePage();
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

card.addEventListener("click", () => {

  // 🔥 fire-and-forget analytics
  fetch("/api/analytics", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({
      event: "menu_click",
      value: page,
      device_id: deviceId
    })
  }).catch(()=>{}); // ignore errors

  loadPage(page);
});
});

// ---------------- GLOBAL SETTINGS ----------------

// Disable long-press context menu (mobile UX)
document.addEventListener("contextmenu", e => e.preventDefault());

//------------ TODAY EVENTS AND NOTIFICATIONS -------------
async function initSubscription(){

  try {

    if (!('serviceWorker' in navigator)) return;

    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();

    if (!sub) return;

    const endpoint = sub.endpoint;

    const res = await fetch('/api/get_sub_id', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ endpoint })
    });

    const id = Number(await res.json());

    if (id > 0){
      subscriptionId = id;
      pushAuthorized = true;

      const a = await fetch(`/api/alerts/${subscriptionId}`);
      const ids = await a.json();
      alertSet = new Set(ids);
    }

  } catch (err){
    console.error("initSubscription failed:", err);
    // 🔥 DO NOT THROW — fail silently
  }
}


async function subscribeUser(){

    // 🍎 block invalid Apple usage
    if (isApple && !isStandalone){
      alert("Install the app first: Share → Add to Home Screen");
      return;
    }

  try {

    const reg = await navigator.serviceWorker.ready;

    // 🔥 STEP 1: check existing subscription
    let sub = await reg.pushManager.getSubscription();

    // 🔥 STEP 2: only create if missing
    if (!sub){
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });
    }

    console.log("SUB OBJECT:", sub);

    const json = sub.toJSON();

    const payload = {
      endpoint: sub.endpoint,
      keys: {
        p256dh: json.keys.p256dh,
        auth: json.keys.auth
      }
    };

    console.log("PAYLOAD:", payload);

    const res = await fetch('/api/subscribe', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(payload)
    });

    const result = await res.json();
    console.log("SERVER RESPONSE:", result);

    subscriptionId = Number(result);

    // 🔥 IMPORTANT: only mark authorized if backend succeeded
    if (subscriptionId > 0){
      pushAuthorized = true;
    } else {
      throw new Error("Subscription not saved on server");
    }

    // reload alerts
    const a = await fetch(`/api/alerts/${subscriptionId}`);
    const ids = await a.json();
    alertSet = new Set(ids);

    // 🔥 FORCE UI refresh
    loadTodayEvents();

  } catch (err){
    console.error("SUBSCRIBE FAILED:", err);
    alert("Subscription failed. Try again.");
  }
}

function renderPushCard(){

  // already subscribed → no card
  if (pushAuthorized) return '';

    if (isApple && !isStandalone){
      return `
        <div class="ui-card push-card ios-note">

          <div class="push-title">
            Stay Updated
          </div>

          <div class="push-text">
            Install this app to enable notifications.
          </div>

          <div class="push-action">
            <button class="alert-btn" onclick="loadStatic('install_ios')">
              Install App
            </button>
          </div>

        </div>
      `;
    }

  // ✅ Normal case (Android OR iOS installed)
  return `
    <div class="ui-card push-card">

      <div class="push-title">
        Stay Updated
      </div>

      <div class="push-text">
        Tap Enable Notifications. If blocked, check browser settings.
      </div>

      <div class="push-action">
        <button class="alert-btn" onclick="subscribeUser()">
          Enable Notifications
        </button>
      </div>

    </div>
  `;
}

async function loadTodayEvents(preserveScroll = false){

    const content = document.getElementById("content");
    let scrollPos = 0;
    if (preserveScroll){
      scrollPos = window.scrollY;
    }

    // stop any existing timer first
    if (todayRefreshTimer){
      clearInterval(todayRefreshTimer);
    }

  try {

    // 🔥 ENSURE subscription + alerts are ready
    if (!pushAuthorized && subscriptionId === 0){
      await initSubscription();
    }

    const res = await fetch('/api/events/today');

    if (!res.ok){
        console.error("Events API failed:", res.status);
        content.innerHTML = `<div class="card">Error loading today's events</div>`;
        return;
    }

    const data = await res.json();

    let h = `
      <div class="vote-thanks">Today's Events</div>
    `;
    h += `<div class="vote-thanks-note">
        Happening today. <br>Get reminders too for your favorite events
        </div>`;
    h += renderPushCard();

    const now = new Date();
    let currentDay = '';

    data.forEach(item => {

        if (item.day_date !== currentDay){
          currentDay = item.day_date;

          h += `<h2 style="margin-top:20px;"><b>${currentDay}</b></h2>`;
        }

      const iconPath = item.icon
        ? `/static/icons/${item.icon}`
        : null;

      let bgStyle = '';

      // ---------- BASE STATUS (unchanged logic) ----------
      if (item.status === 'cancelled'){
        bgStyle = 'style="background:#fdecea; border:2px solid #c62828;"';
      }
      else if (item.status === 'changed'){
        bgStyle = 'style="background:#fff8dc; border:2px solid #e6c200;"';
      }
      else if (item.featured == 1){
        bgStyle = 'style="background:#f4e7d3; border:2px solid #8b5a2b;"';
      }

      // ---------- REAL TIME CALC ----------
      const start = new Date(item.start_datetime);
      const end = new Date(item.end_datetime);

      const diffMin = Math.floor((start - now) / 60000);

      let statusLine = '';

      if (item.status !== 'cancelled') {
        if (diffMin <= 90 && diffMin > 0){
          statusLine = `Event starts in ${diffMin} minutes`;
        }
        else if (now >= start && now <= end){
          statusLine = 'Happening Now';
          bgStyle = 'style="background:#e8f5e9; border:2px solid #2e7d32;"';
        }
        else if (now > end){
          statusLine = 'Ended';
        }
      }

      // ---------- ALERT BUTTON RULES ----------
      let showButton = false;

      if (
          pushAuthorized &&
          diffMin > 10 &&
          now < start &&
          item.status !== 'cancelled'
      ){
        showButton = true;
      }

      const hasAlert = alertSet.has(item.event_id);

      const timeRange = `${item.start_time} - ${item.end_time}`;

            let scrollTag = '';

            if (item.status !== 'cancelled') {
              if (now >= start && now <= end){
                scrollTag = 'data-scroll="now"';
              }
              else if (now < start && !scrollTag){
                scrollTag = 'data-scroll="next"';
              }
            }

            h += `
              <div class="ui-card" ${bgStyle} ${scrollTag}>

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

              ${statusLine ? `
                <div class="ui-card-body"><b>${statusLine}</b></div>
              ` : ''}
            </div>

            ${showButton ? `
              <div class="ui-card-actions">
                <button
                  class="alert-btn ${hasAlert ? 'active' : ''}"
                  onclick="toggleAlert(${item.event_id}, this)">
                  ${hasAlert ? 'Remove Alert' : 'Alert Me'}
                </button>
              </div>
            ` : ''}

          </div>
        `;
    });

    content.innerHTML = h;

// 🔥 SMART SCROLL (only on first load + ONLY if subscribed)
if (!preserveScroll){

  if (pushAuthorized){

    const nowEl = document.querySelector('[data-scroll="now"]');
    const nextEl = document.querySelector('[data-scroll="next"]');

    function scrollWithOffset(el){
      const offset = 12;

      const y = el.getBoundingClientRect().top + window.pageYOffset - offset;

      window.scrollTo({
        top: y,
        behavior: 'smooth'
      });
    }

    if (nowEl){
      scrollWithOffset(nowEl);
    }
    else if (nextEl){
      scrollWithOffset(nextEl);
    }
    else {
      scrollToContent(); // fallback
    }

  } else {
    // 🔥 NOT subscribed → always show top (push card visible)
    scrollToContent();
  }

} else {
  // preserve existing scroll during refresh
  window.scrollTo(0, scrollPos);
}

  } catch (err) {
    console.error("loadTodayEvents error:", err);
    content.innerHTML = `<div class="card">Error loading today's events</div>`;
  }

// start auto refresh (once per minute)
todayRefreshTimer = setInterval(() => {
  loadTodayEvents(true);   // ✅ preserve scroll on refresh
}, 60000);

if (preserveScroll){
  window.scrollTo(0, scrollPos);
}

}

async function toggleAlert(eventId, btn){

  if (!subscriptionId || subscriptionId === 0){
    alert("Enable notifications first");
    return;
  }

  // 🔒 prevent double taps
  if (btn.disabled) return;
  btn.disabled = true;

  const hasAlert = alertSet.has(eventId);

  // ---------- OPTIMISTIC UI UPDATE ----------
  if (!hasAlert){
    alertSet.add(eventId);
    btn.innerText = "Remove Alert";
    btn.classList.add("active");
  } else {
    alertSet.delete(eventId);
    btn.innerText = "Alert Me";
    btn.classList.remove("active");
  }

  try {
    // ---------- BACKGROUND REQUEST ----------
    const url = !hasAlert
      ? `/api/alerts/add/${subscriptionId}/${eventId}`
      : `/api/alerts/remove/${subscriptionId}/${eventId}`;

    const res = await fetch(url, { method: 'POST' });

    if (!res.ok){
      throw new Error("Server error");
    }

  } catch (err){

    console.error("Alert toggle failed:", err);

    // ---------- ROLLBACK UI ----------
    if (!hasAlert){
      alertSet.delete(eventId);
      btn.innerText = "Alert Me";
      btn.classList.remove("active");
    } else {
      alertSet.add(eventId);
      btn.innerText = "Remove Alert";
      btn.classList.add("active");
    }

    alert("Failed to update alert. Try again.");

  } finally {
    // 🔓 re-enable after short delay (prevents spam taps)
    setTimeout(() => {
      btn.disabled = false;
    }, 1200);
  }
}

initSubscription().catch(() => {});

window.addEventListener("load", async () => {

  // 🔥 check static version on app load
  await checkStaticVersion();

  const params = new URLSearchParams(window.location.search);
  const page = params.get("page");

  if (page === "today"){
    loadTodayEvents();
  }
});

// 🔄 periodic version check (every 3 hours)
setInterval(() => {
  checkStaticVersion();
}, 3 * 60 * 60 * 1000);

function filterFAQs(text){

  text = text.toLowerCase();

  const container = document.getElementById("faqContainer");
  if (!container) return;

  const cards = container.querySelectorAll(".ui-card");

  cards.forEach(card => {
    const content = card.innerText.toLowerCase();
    const match = content.includes(text);
    card.style.display = match ? "flex" : "none";
  });
}

async function checkStaticVersion(){

  try {

    const res = await fetch("/api/static_version");
    const data = await res.json();

    const current = localStorage.getItem("static_version");

    if (current != data.version){

      // 🔥 clear cached static pages
      Object.keys(localStorage).forEach(k => {
        if (k.startsWith("static_")){
          localStorage.removeItem(k);
        }
      });

      localStorage.setItem("static_version", data.version);
    }

  } catch (err){
    console.log("static version check failed");
  }
}

