/**
 * TJG Trestles API Worker
 * Proxies all Trestles (CoreLogic CRMLS) requests server-side so
 * the client_id / client_secret never touch the browser.
 *
 * Credentials (set via `wrangler secret put`):
 *   TRESTLES_CLIENT_ID
 *   TRESTLES_CLIENT_SECRET
 *
 * Routes:
 *   GET /search   - listing search (filter, sort, paginate)
 *   GET /map      - lightweight pin data only (lat/lng/price)
 *   GET /listing/:key - single listing detail
 */

const TRESTLES_BASE = 'https://api.cotality.com';
const TOKEN_URL     = 'https://api.cotality.com/trestle/oidc/connect/token';
const PROPERTY_URL  = `${TRESTLES_BASE}/trestle/odata/Property`;

// Fields needed for listing cards
const CARD_FIELDS = [
  'ListingKey', 'ListingId', 'ListPrice',
  'BedroomsTotal', 'BathroomsTotalInteger', 'LivingArea',
  'StreetNumber', 'StreetName', 'StreetSuffix', 'UnitNumber',
  'City', 'StateOrProvince', 'PostalCode',
  'StandardStatus', 'PropertyType', 'PropertySubType',
  'Latitude', 'Longitude',
  'ModificationTimestamp', 'ListingContractDate', 'OnMarketDate',
  'AssociationFee', 'YearBuilt', 'LotSizeSquareFeet', 'GarageSpaces',
  'ListOfficeName', 'ListAgentFullName', 'ListAgentStateLicense',
  'PublicRemarks'
].join(',');

// Fields needed for the full detail page (superset of CARD_FIELDS)
const DETAIL_FIELDS = CARD_FIELDS + ',' + [
  'PublicRemarks',
  // Bedrooms / Bathrooms
  'BathroomsFull', 'BathroomsHalf',
  // Interior
  'Stories', 'InteriorFeatures', 'Appliances', 'LaundryFeatures',
  'FireplacesTotal', 'FireplaceYN', 'FireplaceFeatures',
  'HeatingYN', 'Heating', 'CoolingYN', 'Cooling',
  'Flooring', 'CommonWalls',
  // Exterior
  'ArchitecturalStyle', 'GarageYN', 'ParkingTotal', 'ParkingFeatures',
  'PoolPrivateYN', 'PoolFeatures', 'SpaYN',
  'Sewer', 'WaterSource', 'Utilities',
  // Site / lot
  'LotSizeAcres', 'View',
  // Community / location
  'MLSAreaMajor', 'SubdivisionName', 'CountyOrParish',
  'CommunityFeatures', 'AssociationAmenities',
  'ElementarySchool', 'MiddleOrJuniorSchool', 'HighSchool',
  'SeniorCommunityYN', 'Zoning',
  // Financial
  'TaxAnnualAmount', 'AssociationName', 'AssociationFeeFrequency',
  'TaxOtherAnnualAssessmentAmount',
  // Transaction
  'CloseDate', 'ClosePrice',
  'DaysOnMarket',
  // Agent / office
  'ListAgentDirectPhone', 'ListAgentMobilePhone', 'ListAgentEmail',
  'VirtualTourURLUnbranded', 'VirtualTourURLBranded'
].join(',');

// ── KV cache helpers ──────────────────────────────────────────────────────────
// TTLs (seconds): searches are short-lived; detail pages longer.
const TTL_SEARCH    = 5 * 60;   // 5 min  — browsing queries
const TTL_DETAIL    = 20 * 60;  // 20 min — individual listing
const TTL_OH        = 10 * 60;  // 10 min — open houses
const TTL_MAP       = 5 * 60;   // 5 min  — map pins

async function cacheGet(env, key) {
  if (!env.CACHE) return null;
  try {
    const val = await env.CACHE.get(key);
    return val ? JSON.parse(val) : null;
  } catch { return null; }
}

async function cachePut(env, key, data, ttl) {
  if (!env.CACHE) return;
  try {
    await env.CACHE.put(key, JSON.stringify(data), { expirationTtl: ttl });
  } catch { /* non-fatal */ }
}

// In-memory token cache (persists within a warm Worker isolate)
let _cachedToken = null;
let _tokenExpiry = 0;

async function getToken(env) {
  if (_cachedToken && Date.now() < _tokenExpiry) return _cachedToken;

  const resp = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: env.TRESTLES_CLIENT_ID,
      client_secret: env.TRESTLES_CLIENT_SECRET,
      scope: 'api'
    })
  });

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Trestles token error ${resp.status}: ${body}`);
  }

  const data = await resp.json();
  _cachedToken = data.access_token;
  _tokenExpiry = Date.now() + (data.expires_in - 60) * 1000; // expire 1 min early
  return _cachedToken;
}

// Build a $filter string from URL search params
function buildFilter(params) {
  const filters = [];

  // Rent mode: Residential Lease listings (mutually exclusive with StandardStatus filter)
  const rentMode = params.get('rentMode');
  if (rentMode === 'true') {
    filters.push("PropertyType eq 'Residential Lease'");
    filters.push("StandardStatus eq 'Active'");
  } else {
    const rawStatuses = params.get('status');
    if (rawStatuses) {
      const statuses = rawStatuses.split(',').map(s => s.trim()).filter(Boolean);
      if (statuses.length) {
        filters.push('(' + statuses.map(s => `StandardStatus eq '${s}'`).join(' or ') + ')');
      }
    }
  }

  // Price range
  const minPrice = params.get('minPrice');
  const maxPrice = params.get('maxPrice');
  if (minPrice) filters.push(`ListPrice ge ${parseInt(minPrice)}`);
  if (maxPrice) filters.push(`ListPrice le ${parseInt(maxPrice)}`);

  // Beds / Baths
  const minBeds = params.get('minBeds');
  const maxBeds = params.get('maxBeds');
  const minBaths = params.get('minBaths');
  if (minBeds) filters.push(`BedroomsTotal ge ${parseInt(minBeds)}`);
  if (maxBeds) filters.push(`BedroomsTotal le ${parseInt(maxBeds)}`);
  if (minBaths) filters.push(`BathroomsTotalInteger ge ${parseInt(minBaths)}`);

  // City
  const city = params.get('city');
  if (city) filters.push(`City eq '${city.replace(/'/g, "''")}'`);

  // Property type  (e.g. Residential, Residential Income, Land)
  const type = params.get('type');
  if (type) filters.push(`PropertyType eq '${type}'`);

  // Property subtype (e.g. Single Family Residence, Condominium, Townhouse)
  const subtype = params.get('subtype');
  if (subtype) filters.push(`PropertySubType eq '${subtype.replace(/'/g, "''")}'`);

  // Multi property type OR filter (comma-separated PropertyType values)
  const ptypes = params.get('ptypes');
  if (ptypes && !type) {
    const typeList = ptypes.split(',').map(t => t.trim()).filter(Boolean);
    if (typeList.length === 1) {
      filters.push(`PropertyType eq '${typeList[0]}'`);
    } else if (typeList.length > 1) {
      filters.push(`(${typeList.map(t => `PropertyType eq '${t}'`).join(' or ')})`);
    }
  }

  // Map bounding box
  const north = params.get('north');
  const south = params.get('south');
  const east  = params.get('east');
  const west  = params.get('west');
  if (north && south && east && west) {
    filters.push(`Latitude le ${north}`);
    filters.push(`Latitude ge ${south}`);
    filters.push(`Longitude le ${east}`);
    filters.push(`Longitude ge ${west}`);
  }

  // Keyword / zip / subdivision
  const zip = params.get('zip');
  if (zip) filters.push(`PostalCode eq '${zip}'`);

  // Multi-zip default area filter (comma-separated list)
  const zips = params.get('zips');
  if (zips) {
    const zipArr = zips.split(',').map(z => z.trim()).filter(Boolean);
    if (zipArr.length === 1) filters.push(`PostalCode eq '${zipArr[0]}'`);
    else if (zipArr.length > 1) filters.push('(' + zipArr.map(z => `PostalCode eq '${z}'`).join(' or ') + ')');
  }

  const subdivision = params.get('subdivision');
  if (subdivision) filters.push(`SubdivisionName eq '${subdivision.replace(/'/g, "''")}'`);

  // ── All-Filters modal params ──────────────────────────────────────────────

  // Exact bedroom match (modal chips: studio=0, 1-4 exact, 5+ means ge 5)
  const exactBeds = params.get('exactBeds');
  if (exactBeds !== null && exactBeds !== '') {
    const n = parseInt(exactBeds);
    if (n === 5) filters.push('BedroomsTotal ge 5');
    else         filters.push(`BedroomsTotal eq ${n}`);
  }

  // Exact bathroom match (modal chips: 1, 1.5, 2, 3, 4, 5+)
  const exactBaths = params.get('exactBaths');
  if (exactBaths !== null && exactBaths !== '') {
    const n = parseFloat(exactBaths);
    if (n === 5) filters.push('BathroomsTotalInteger ge 5');
    else         filters.push(`BathroomsTotalInteger eq ${Math.floor(n)}`);
  }

  // Square footage
  const minSqft = params.get('minSqft');
  const maxSqft = params.get('maxSqft');
  if (minSqft) filters.push(`LivingArea ge ${parseInt(minSqft)}`);
  if (maxSqft) filters.push(`LivingArea le ${parseInt(maxSqft)}`);

  // Lot size (sq ft)
  const minLot = params.get('minLot');
  const maxLot = params.get('maxLot');
  if (minLot) filters.push(`LotSizeSquareFeet ge ${parseInt(minLot)}`);
  if (maxLot) filters.push(`LotSizeSquareFeet le ${parseInt(maxLot)}`);

  // Year built
  const minYear = params.get('minYear');
  const maxYear = params.get('maxYear');
  if (minYear) filters.push(`YearBuilt ge ${parseInt(minYear)}`);
  if (maxYear) filters.push(`YearBuilt le ${parseInt(maxYear)}`);

  // Garage spaces
  const minGarage = params.get('minGarage');
  if (minGarage) filters.push(`GarageSpaces ge ${parseInt(minGarage)}`);

  // Stories
  const stories = params.get('stories');
  if (stories) filters.push(`Stories eq ${parseInt(stories)}`);

  // Days on market
  const dom = params.get('dom');
  if (dom) filters.push(`DaysOnMarket le ${parseInt(dom)}`);

  // Property features
  if (params.get('pool') === 'true')       filters.push('PoolPrivateYN eq true');
  if (params.get('waterfront') === 'true') filters.push('WaterfrontYN eq true');
  if (params.get('fireplace') === 'true')  filters.push('FireplacesTotal gt 0');
  if (params.get('virtualTour') === 'true') filters.push("VirtualTourURLUnbranded ne null");
  if (params.get('view') === 'true')       filters.push("View ne null");

  // HOA / Association fee
  const hasHoa = params.get('hasHoa');
  if (hasHoa === 'yes') filters.push('AssociationFee gt 0');
  if (hasHoa === 'no')  filters.push('AssociationFee eq 0');
  const maxHoa = params.get('maxHoa');
  if (maxHoa) filters.push(`AssociationFee le ${parseInt(maxHoa)}`);

  // Keyword search — address fields, city, MLS#, and public remarks
  const keyword = params.get('keyword');
  if (keyword) {
    const k = keyword.replace(/'/g, "''");
    filters.push(`(contains(StreetName,'${k}') or contains(City,'${k}') or contains(ListingId,'${k}') or contains(PostalCode,'${k}') or contains(PublicRemarks,'${k}'))`);
  };

  // Exclude specific listings by ListingKey (comma-separated)
  const excludeKeys = params.get('excludeKeys');
  if (excludeKeys) {
    const keys = excludeKeys.split(',').map(k => k.trim()).filter(Boolean);
    keys.forEach(k => filters.push(`ListingKey ne '${k}'`));
  }

  // Listed since date (YYYY-MM-DD) — for new listings feature
  const listedSince = params.get('listedSince');
  if (listedSince) filters.push(`OnMarketDate ge '${listedSince}'`);

  // Open house
  if (params.get('openHouse') === 'true') filters.push("OpenHouseRemarks ne null");

  // MLS Area text search
  const mlsAreaSearch = params.get('mlsAreaSearch');
  if (mlsAreaSearch) filters.push(`contains(MLSAreaMajor,'${mlsAreaSearch.replace(/'/g, "''")}')`);

  // Subdivision text search (contains, since it's a typeahead)
  const subdivisionSearch = params.get('subdivisionSearch');
  if (subdivisionSearch) filters.push(`contains(SubdivisionName,'${subdivisionSearch.replace(/'/g, "''")}')`);

  // Advanced multi-select checkbox filters
  const advancedRaw = params.get('advanced');
  if (advancedRaw) {
    try {
      const advancedFieldMap = {
        'Accessibility Features': 'AccessibilityFeatures',
        'Appliances': 'Appliances',
        'Architectural Style': 'ArchitecturalStyle',
        'Association Amenities': 'AssociationAmenities',
        'Basement': 'Basement',
        'Community Features': 'CommunityFeatures',
        'Cooling': 'Cooling',
        'Exterior Features': 'ExteriorFeatures',
        'Fireplace Features': 'FireplaceFeatures',
        'Flooring': 'Flooring',
        'Foundation Details': 'FoundationDetails',
        'Heating': 'Heating',
        'Interior Features': 'InteriorFeatures',
        'Laundry Features': 'LaundryFeatures',
        'Parking Features': 'ParkingFeatures',
        'Patio And Porch Features': 'PatioAndPorchFeatures',
        'Pool Features': 'PoolFeatures',
        'Roof': 'Roof',
        'Security Features': 'SecurityFeatures',
        'Sewer': 'Sewer',
        'Utilities': 'Utilities',
        'Water Source': 'WaterSource',
        'Waterfront Features': 'WaterfrontFeatures',
        'Window Features': 'WindowFeatures'
      };
      const advanced = JSON.parse(advancedRaw);
      for (const [cat, vals] of Object.entries(advanced)) {
        const field = advancedFieldMap[cat];
        if (!field || !vals || !vals.length) continue;
        const esc = v => v.replace(/'/g, "''");
        const orParts = vals.map(v => `contains(${field},'${esc(v)}')`);
        filters.push(orParts.length === 1 ? orParts[0] : '(' + orParts.join(' or ') + ')');
      }
    } catch (e) {
      // ignore malformed JSON
    }
  }

  return filters.join(' and ');
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'no-store'
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' }
  });
}

// ── Admin ─────────────────────────────────────────────────────────────────────

const ADMIN_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>TJG &middot; Leads Admin</title>
<link href="https://fonts.googleapis.com/css2?family=Marcellus&family=Lato:wght@300;400;700&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Lato',sans-serif;background:#f0f2f5;min-height:100vh;color:#333}
#login-screen{display:flex;align-items:center;justify-content:center;min-height:100vh;background:#1C3063}
.login-box{background:#fff;padding:48px 40px;width:380px;text-align:center}
.login-box h1{font-family:'Marcellus',serif;font-size:26px;color:#1C3063;margin-bottom:6px}
.login-box p{color:#aaa;font-size:13px;margin-bottom:32px}
.login-box input{width:100%;border:1px solid #ddd;padding:12px 14px;font-size:14px;font-family:'Lato',sans-serif;margin-bottom:14px;outline:none}
.login-box input:focus{border-color:#1C3063}
.login-btn{width:100%;background:#1C3063;color:#fff;border:none;padding:14px;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;cursor:pointer;font-family:'Lato',sans-serif}
.login-btn:hover{background:#243d82}
#login-error{color:#e74c3c;font-size:12px;margin-top:10px;min-height:18px}
#app{display:none}
header{background:#1C3063;color:#fff;padding:0 32px;display:flex;align-items:center;justify-content:space-between;height:60px;position:sticky;top:0;z-index:100}
header h1{font-family:'Marcellus',serif;font-size:18px;font-weight:400;letter-spacing:.5px}
.hdr-right{display:flex;align-items:center;gap:16px}
#lead-count-hdr{font-size:12px;color:rgba(255,255,255,.45)}
.btn{padding:9px 18px;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;cursor:pointer;border:none;font-family:'Lato',sans-serif;transition:.15s}
.btn-primary{background:#1C3063;color:#fff}.btn-primary:hover{background:#243d82}
.btn-gold{background:#c9a96e;color:#fff}.btn-gold:hover{background:#b8935a}
.btn-danger{background:#e74c3c;color:#fff}.btn-danger:hover{background:#c0392b}
.btn-ghost{background:transparent;border:1px solid #ccc;color:#666}.btn-ghost:hover{border-color:#999;color:#333}
.toolbar{padding:20px 32px;display:flex;align-items:center;gap:12px;flex-wrap:wrap;min-height:64px}
#bulk-bar{display:none;align-items:center;gap:10px}
#bulk-bar.visible{display:flex}
#bulk-count{font-size:13px;color:#555;font-weight:700}
#status-msg{font-size:12px;color:#888;margin-left:auto}
.table-wrap{margin:0 32px 48px;background:#fff;box-shadow:0 1px 6px rgba(0,0,0,.07);overflow-x:auto}
table{width:100%;border-collapse:collapse;font-size:13px}
thead th{padding:11px 14px;text-align:left;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#999;border-bottom:1px solid #eee;background:#fafafa;white-space:nowrap}
tbody tr{border-bottom:1px solid #f3f3f3;transition:background .1s}
tbody tr:hover{background:#f9f9ff}
td{padding:12px 14px;vertical-align:middle}
.td-name{font-weight:700;color:#1C3063}.td-email{color:#555}.td-phone{color:#888}
.td-source{font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:#bbb}
.td-date{color:#aaa;font-size:12px;white-space:nowrap}
.badge{display:inline-block;padding:3px 11px;border-radius:20px;font-size:10px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;cursor:pointer;user-select:none;transition:.15s}
.badge-active{background:#e8f5e9;color:#2e7d32}.badge-active:hover{background:#c8e6c9}
.badge-inactive{background:#f5f5f5;color:#aaa}.badge-inactive:hover{background:#e0e0e0}
.td-count{text-align:center;font-weight:700;color:#1C3063}
.td-count-zero{text-align:center;color:#ddd}
td.td-actions{white-space:nowrap;text-align:right}
.btn-del{background:none;border:none;cursor:pointer;color:#ddd;font-size:15px;padding:4px 6px;transition:color .15s;line-height:1}
.btn-del:hover{color:#e74c3c}
.empty-row td{text-align:center;padding:60px;color:#bbb;font-family:'Marcellus',serif;font-size:16px}
.overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:1000;align-items:center;justify-content:center}
.overlay.open{display:flex}
.modal{background:#fff;width:460px;max-width:95vw;padding:36px 40px;position:relative}
.modal h2{font-family:'Marcellus',serif;font-size:22px;color:#1C3063;margin-bottom:26px}
.modal-close{position:absolute;top:16px;right:18px;background:none;border:none;font-size:22px;cursor:pointer;color:#bbb;line-height:1}
.modal-close:hover{color:#333}
.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.form-field label{display:block;font-size:10px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:#aaa;margin-bottom:6px}
.form-field input{width:100%;border:1px solid #e0e0e0;padding:10px 12px;font-size:14px;font-family:'Lato',sans-serif;outline:none;transition:.15s}
.form-field input:focus{border-color:#1C3063}
.form-full{grid-column:span 2}
.modal-actions{display:flex;gap:10px;justify-content:flex-end;margin-top:24px}
</style>
</head>
<body>

<div id="login-screen">
  <div class="login-box">
    <h1>TJG Admin</h1>
    <p>Leads Management</p>
    <input type="password" id="pw" placeholder="Password" />
    <button class="login-btn" onclick="doLogin()">Sign In</button>
    <div id="login-error"></div>
  </div>
</div>

<div id="app">
  <header>
    <h1>The Jaiswal Group &mdash; Leads</h1>
    <div class="hdr-right">
      <span id="lead-count-hdr"></span>
      <button class="btn btn-gold" onclick="openModal()">+ New Lead</button>
    </div>
  </header>
  <div class="toolbar">
    <div id="bulk-bar">
      <span id="bulk-count"></span>
      <button class="btn btn-ghost" onclick="bulkAction('activate')">Activate</button>
      <button class="btn btn-ghost" onclick="bulkAction('deactivate')">Deactivate</button>
      <button class="btn btn-danger" onclick="bulkAction('delete')">Delete</button>
    </div>
    <span id="status-msg"></span>
  </div>
  <div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th style="width:36px"><input type="checkbox" id="sel-all" onchange="toggleAll(this)"></th>
          <th>Name</th><th>Email</th><th>Phone</th><th>Source</th><th>Status</th><th>Created</th>
          <th style="text-align:center">Searches</th>
          <th style="text-align:center">Properties</th>
          <th style="text-align:center">Reports</th>
          <th></th>
        </tr>
      </thead>
      <tbody id="tbody">
        <tr class="empty-row"><td colspan="11">Loading&hellip;</td></tr>
      </tbody>
    </table>
  </div>
</div>

<div class="overlay" id="modal" onclick="overlayClick(event)">
  <div class="modal">
    <button class="modal-close" onclick="closeModal()">&times;</button>
    <h2>Create Lead</h2>
    <div class="form-grid">
      <div class="form-field"><label>First Name</label><input type="text" id="f-first" placeholder="Jane" /></div>
      <div class="form-field"><label>Last Name</label><input type="text" id="f-last" placeholder="Doe" /></div>
      <div class="form-field form-full"><label>Email *</label><input type="email" id="f-email" placeholder="jane@example.com" /></div>
      <div class="form-field form-full"><label>Phone</label><input type="tel" id="f-phone" placeholder="(858) 555-0100" /></div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="createLead()">Create &amp; Push to FUB</button>
    </div>
  </div>
</div>

<script>
var TOKEN = '';
var leads = [];
var BASE  = window.location.origin;

function hdrs() {
  return { 'Content-Type': 'application/json', 'X-Admin-Token': TOKEN };
}

async function doLogin() {
  var pw = document.getElementById('pw').value.trim();
  if (!pw) return;
  document.getElementById('login-error').textContent = '';
  try {
    var r = await fetch(BASE + '/admin/leads', { headers: { 'X-Admin-Token': pw } });
    if (r.status === 401) { document.getElementById('login-error').textContent = 'Incorrect password.'; return; }
    TOKEN = pw;
    sessionStorage.setItem('tjg_admin', pw);
    showApp(await r.json());
  } catch(e) { document.getElementById('login-error').textContent = 'Connection error.'; }
}

document.getElementById('pw').addEventListener('keydown', function(e) { if (e.key === 'Enter') doLogin(); });

async function tryAutoLogin() {
  var saved = sessionStorage.getItem('tjg_admin');
  if (!saved) return;
  try {
    var r = await fetch(BASE + '/admin/leads', { headers: { 'X-Admin-Token': saved } });
    if (r.ok) { TOKEN = saved; showApp(await r.json()); }
    else sessionStorage.removeItem('tjg_admin');
  } catch(e) {}
}

function showApp(data) {
  leads = Array.isArray(data) ? data : [];
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  render();
}

function fmtDate(iso) {
  if (!iso) return '&mdash;';
  var d = new Date(iso);
  return d.toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });
}

function render() {
  document.getElementById('lead-count-hdr').textContent = leads.length + (leads.length === 1 ? ' lead' : ' leads');
  var tbody = document.getElementById('tbody');
  if (!leads.length) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="11">No leads yet. Create your first one above.</td></tr>';
    return;
  }
  tbody.innerHTML = leads.map(function(l) {
    var name  = [l.first_name, l.last_name].filter(Boolean).join(' ') || '&mdash;';
    var phone = l.phone ? l.phone : '<span style="color:#ddd">&mdash;</span>';
    var n = l.saved_searches_count        || 0;
    var p = l.saved_properties_count      || 0;
    var m = l.saved_market_reports_count  || 0;
    return '<tr>' +
      '<td><input type="checkbox" class="rc" value="' + l.id + '" onchange="updateBulk()"></td>' +
      '<td class="td-name">' + name + '</td>' +
      '<td class="td-email">' + l.email + '</td>' +
      '<td class="td-phone">' + phone + '</td>' +
      '<td class="td-source">' + (l.source || 'manual') + '</td>' +
      '<td><span class="badge badge-' + l.status + '" onclick="toggleStatus(\\'' + l.id + '\\',\\'' + l.status + '\\')">' + l.status + '</span></td>' +
      '<td class="td-date">' + fmtDate(l.created_at) + '</td>' +
      '<td class="' + (n > 0 ? 'td-count' : 'td-count-zero') + '">' + n + '</td>' +
      '<td class="' + (p > 0 ? 'td-count' : 'td-count-zero') + '">' + p + '</td>' +
      '<td class="' + (m > 0 ? 'td-count' : 'td-count-zero') + '">' + m + '</td>' +
      '<td class="td-actions"><button class="btn-del" title="Delete" onclick="delLead(\\'' + l.id + '\\')">&#128465;</button></td>' +
    '</tr>';
  }).join('');
}

function updateBulk() {
  var checked = document.querySelectorAll('.rc:checked');
  document.getElementById('bulk-count').textContent = checked.length + ' selected';
  document.getElementById('bulk-bar').classList.toggle('visible', checked.length > 0);
}

function toggleAll(cb) {
  document.querySelectorAll('.rc').forEach(function(c) { c.checked = cb.checked; });
  updateBulk();
}

function selIds() {
  return Array.from(document.querySelectorAll('.rc:checked')).map(function(c) { return c.value; });
}

function flash(msg) {
  var el = document.getElementById('status-msg');
  el.textContent = msg;
  setTimeout(function() { el.textContent = ''; }, 3500);
}

async function toggleStatus(id, cur) {
  var next = cur === 'active' ? 'inactive' : 'active';
  var r = await fetch(BASE + '/admin/leads/' + id, { method:'PATCH', headers:hdrs(), body:JSON.stringify({ status:next }) });
  if (r.ok) {
    leads = leads.map(function(l) { return l.id === id ? Object.assign({}, l, { status:next }) : l; });
    render();
  }
}

async function delLead(id) {
  if (!confirm('Delete this lead permanently?')) return;
  var r = await fetch(BASE + '/admin/leads/' + id, { method:'DELETE', headers:hdrs() });
  if (r.ok) { leads = leads.filter(function(l) { return l.id !== id; }); render(); flash('Lead deleted.'); }
}

async function bulkAction(action) {
  var ids = selIds();
  if (!ids.length) return;
  if (action === 'delete' && !confirm('Permanently delete ' + ids.length + ' lead(s)?')) return;
  var r = await fetch(BASE + '/admin/leads/bulk', { method:'POST', headers:hdrs(), body:JSON.stringify({ ids:ids, action:action }) });
  if (r.ok) {
    if (action === 'delete') {
      leads = leads.filter(function(l) { return ids.indexOf(l.id) === -1; });
    } else {
      var ns = action === 'activate' ? 'active' : 'inactive';
      leads = leads.map(function(l) { return ids.indexOf(l.id) > -1 ? Object.assign({}, l, { status:ns }) : l; });
    }
    render();
    document.getElementById('sel-all').checked = false;
    updateBulk();
    flash(ids.length + ' lead(s) updated.');
  }
}

function openModal() {
  document.getElementById('modal').classList.add('open');
  setTimeout(function() { document.getElementById('f-email').focus(); }, 50);
}

function closeModal() {
  document.getElementById('modal').classList.remove('open');
  ['f-first','f-last','f-email','f-phone'].forEach(function(id) { document.getElementById(id).value = ''; });
}

function overlayClick(e) { if (e.target === document.getElementById('modal')) closeModal(); }

async function createLead() {
  var payload = {
    first_name: document.getElementById('f-first').value.trim(),
    last_name:  document.getElementById('f-last').value.trim(),
    email:      document.getElementById('f-email').value.trim(),
    phone:      document.getElementById('f-phone').value.trim()
  };
  if (!payload.email) { alert('Email is required.'); return; }
  var r = await fetch(BASE + '/admin/leads', { method:'POST', headers:hdrs(), body:JSON.stringify(payload) });
  if (r.ok) {
    var lead = await r.json();
    leads = [lead].concat(leads);
    render();
    closeModal();
    flash('Lead created and pushed to FUB.');
  } else {
    var err = await r.json().catch(function() { return { error:'Unknown error' }; });
    alert('Error: ' + (err.error || 'Unknown error'));
  }
}

tryAutoLogin();
</script>
</body>
</html>`;

function sbHeaders(env) {
  return {
    'apikey':        env.SUPABASE_KEY,
    'Authorization': 'Bearer ' + env.SUPABASE_KEY,
    'Content-Type':  'application/json',
    'Prefer':        'return=representation'
  };
}

async function sbFetch(env, path, opts) {
  opts = opts || {};
  return fetch(
    env.SUPABASE_URL + '/rest/v1' + path,
    Object.assign({}, opts, { headers: Object.assign({}, sbHeaders(env), opts.headers || {}) })
  );
}

async function pushToFUB(env, data) {
  if (!env.FUB_API_KEY) return;
  return fetch('https://api.followupboss.com/v1/events', {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + btoa(env.FUB_API_KEY + ':'),
      'Content-Type':  'application/json',
      'X-System':      'The Jaiswal Group Website',
      'X-System-Key':  env.FUB_API_KEY
    },
    body: JSON.stringify({
      source: data.source || 'Website',
      system: 'The Jaiswal Group Website',
      type:   'Registration',
      people: [{
        firstName: data.first_name || '',
        lastName:  data.last_name  || '',
        emails:    [{ value: data.email }],
        phones:    data.phone ? [{ value: data.phone }] : []
      }]
    })
  });
}

async function handleAdmin(request, url, env) {
  const method = request.method;

  // Serve admin HTML (open — login is handled client-side)
  if (method === 'GET' && (url.pathname === '/admin' || url.pathname === '/admin/')) {
    return new Response(ADMIN_HTML, {
      headers: { 'Content-Type': 'text/html;charset=UTF-8', 'Cache-Control': 'no-store' }
    });
  }

  // All API routes require admin token
  if (!env.ADMIN_TOKEN || request.headers.get('X-Admin-Token') !== env.ADMIN_TOKEN) {
    return json({ error: 'Unauthorized' }, 401);
  }

  // GET /admin/leads
  if (url.pathname === '/admin/leads' && method === 'GET') {
    const r = await sbFetch(env, '/leads?select=*&order=created_at.desc');
    const data = await r.json();
    return json(Array.isArray(data) ? data : []);
  }

  // POST /admin/leads — create single lead
  if (url.pathname === '/admin/leads' && method === 'POST') {
    const body = await request.json();
    if (!body.email) return json({ error: 'email required' }, 400);

    const record = {
      first_name: body.first_name || '',
      last_name:  body.last_name  || '',
      email:      body.email.toLowerCase().trim(),
      phone:      body.phone  || '',
      source:     body.source || 'manual',
      status:     'active'
    };

    const r = await sbFetch(env, '/leads', { method: 'POST', body: JSON.stringify(record) });
    if (!r.ok) {
      const err = await r.text();
      if (r.status === 409) return json({ error: 'A lead with this email already exists.' }, 409);
      return json({ error: err }, r.status);
    }

    const created = await r.json();
    const lead = Array.isArray(created) ? created[0] : created;

    pushToFUB(env, record).catch(e => console.error('FUB push:', e.message));
    return json(lead);
  }

  // POST /admin/leads/bulk — bulk activate / deactivate / delete
  if (url.pathname === '/admin/leads/bulk' && method === 'POST') {
    const { ids, action } = await request.json();
    if (!ids?.length || !action) return json({ error: 'ids and action required' }, 400);

    const filter = '/leads?id=in.(' + ids.join(',') + ')';
    const minimal = { 'Prefer': 'return=minimal' };

    if (action === 'delete') {
      const r = await sbFetch(env, filter, { method: 'DELETE', headers: minimal });
      if (!r.ok) return json({ error: await r.text() }, r.status);
      return json({ ok: true });
    }

    if (action === 'activate' || action === 'deactivate') {
      const status = action === 'activate' ? 'active' : 'inactive';
      const r = await sbFetch(env, filter, { method: 'PATCH', headers: minimal, body: JSON.stringify({ status }) });
      if (!r.ok) return json({ error: await r.text() }, r.status);
      return json({ ok: true });
    }

    return json({ error: 'Unknown action' }, 400);
  }

  // /admin/leads/:id routes
  const idMatch = url.pathname.match(/^\/admin\/leads\/([a-f0-9-]{36})$/i);

  if (idMatch && method === 'PATCH') {
    const r = await sbFetch(env, '/leads?id=eq.' + idMatch[1], {
      method: 'PATCH', headers: { 'Prefer': 'return=minimal' }, body: JSON.stringify(await request.json())
    });
    if (!r.ok) return json({ error: await r.text() }, r.status);
    return json({ ok: true });
  }

  if (idMatch && method === 'DELETE') {
    const r = await sbFetch(env, '/leads?id=eq.' + idMatch[1], {
      method: 'DELETE', headers: { 'Prefer': 'return=minimal' }
    });
    if (!r.ok) return json({ error: await r.text() }, r.status);
    return json({ ok: true });
  }

  return json({ error: 'Admin route not found' }, 404);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });

    // Admin routes — no Trestles auth needed, handles own auth
    if (url.pathname === '/admin' || url.pathname.startsWith('/admin/')) {
      return handleAdmin(request, url, env);
    }

    if (request.method !== 'GET' && request.method !== 'POST')
      return json({ error: 'Method not allowed' }, 405);

    // Reject if credentials not configured yet (safe to call without creds during dev)
    if (!env.TRESTLES_CLIENT_ID || env.TRESTLES_CLIENT_ID === 'PLACEHOLDER') {
      return json({
        error: 'Trestles credentials not yet configured.',
        hint: 'Run: wrangler secret put TRESTLES_CLIENT_ID && wrangler secret put TRESTLES_CLIENT_SECRET'
      }, 503);
    }

    try {
      const token = await getToken(env);
      const auth  = { Authorization: `Bearer ${token}` };

      // ── /search ─────────────────────────────────────────────────────────────
      if (url.pathname === '/search') {
        const cacheKey = 'search:' + url.search;
        const cached = await cacheGet(env, cacheKey);
        if (cached) return json(cached);

        const params = url.searchParams;
        const pageSize = Math.min(parseInt(params.get('limit') || '48'), 200);
        const page     = Math.max(parseInt(params.get('page')  || '0'), 0);
        const skip     = page * pageSize;

        const sortMap = {
          newest:        'ModificationTimestamp desc',
          oldest:        'ModificationTimestamp asc',
          price_asc:     'ListPrice asc',
          price_desc:    'ListPrice desc',
          sqft_desc:     'LivingArea desc',
          listed_newest: 'OnMarketDate desc'
        };
        const orderby = sortMap[params.get('sort')] || sortMap.newest;

        const tUrl = new URL(PROPERTY_URL);
        tUrl.searchParams.set('$filter',  buildFilter(params));
        tUrl.searchParams.set('$select',  CARD_FIELDS);
        tUrl.searchParams.set('$top',     pageSize);
        tUrl.searchParams.set('$skip',    skip);
        tUrl.searchParams.set('$orderby', orderby);
        tUrl.searchParams.set('$count',   'true');
        tUrl.searchParams.set('$expand',  'Media');

        const resp = await fetch(tUrl.toString(), { headers: auth });
        if (!resp.ok) return json({ error: `Trestles search error: ${resp.status}` }, resp.status);

        const data = await resp.json();
        // Cotality MediaURLs redirect to media.crmls.org with ?preset=X-Large which returns 404.
        // Resolve each photo URL via HEAD to get the clean final URL (strips the broken preset).
        const listings = await Promise.all((data.value ?? []).map(async l => {
          let media = [];
          if (l.Media?.length) {
            let resolvedUrl = l.Media[0].MediaURL;
            try {
              const mr = await fetch(resolvedUrl, { method: 'HEAD', redirect: 'follow' });
              if (mr.url) resolvedUrl = mr.url.split('?')[0];
            } catch { /* keep original on error */ }
            media = [{ ...l.Media[0], MediaURL: resolvedUrl }];
          }
          return { ...l, Media: media };
        }));
        const result = { total: data['@odata.count'] ?? null, page, pageSize, listings };
        await cachePut(env, cacheKey, result, TTL_SEARCH);
        return json(result);
      }

      // ── /open-houses ─────────────────────────────────────────────────────────
      if (url.pathname === '/open-houses') {
        const ohCacheKey = 'oh:' + url.search;
        const ohCached = await cacheGet(env, ohCacheKey);
        if (ohCached) return json(ohCached);

        const zip = url.searchParams.get('zip') || '';
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

        // Strategy: query Properties in the zip first (PostalCode is on Property, not OpenHouse),
        // then look up OpenHouse events for those listing keys + date filter.

        // Step 1: Get active listing keys in the requested zip(s)
        const zipParts = zip.split(',').map(z => z.trim()).filter(Boolean);
        const zipFilterClause = zipParts.length === 1
          ? `PostalCode eq '${zipParts[0]}'`
          : zipParts.length > 1
            ? '(' + zipParts.map(z => `PostalCode eq '${z}'`).join(' or ') + ')'
            : '';

        const propUrl = new URL(PROPERTY_URL);
        propUrl.searchParams.set('$filter', ["StandardStatus eq 'Active'", zipFilterClause].filter(Boolean).join(' and '));
        propUrl.searchParams.set('$select', CARD_FIELDS);
        propUrl.searchParams.set('$expand', 'Media');
        propUrl.searchParams.set('$top', '200');

        const propResp = await fetch(propUrl.toString(), { headers: auth });
        if (!propResp.ok) {
          const errBody = await propResp.text();
          return json({ error: `Property error: ${propResp.status}`, detail: errBody }, propResp.status);
        }
        const propData = await propResp.json();
        const props = propData.value ?? [];
        if (!props.length) return json({ openHouses: [] });

        // Build a map of ListingKey → property for quick lookup
        const propMap = {};
        for (const l of props) propMap[l.ListingKey] = l;

        // Step 2: Query OpenHouse for these listing keys + upcoming dates
        const keySet = Object.keys(propMap);
        // OData filter: (ListingKey eq 'X' or ...) and OpenHouseDate ge today
        // Split into batches if keySet is large to avoid URL length limits
        const BATCH = 50;
        let allEvents = [];
        for (let i = 0; i < keySet.length; i += BATCH) {
          const batch = keySet.slice(i, i + BATCH);
          const keyFilter = batch.map(k => `ListingKey eq '${k}'`).join(' or ');
          const ohUrl = new URL(`${TRESTLES_BASE}/trestle/odata/OpenHouse`);
          ohUrl.searchParams.set('$filter', `(${keyFilter}) and OpenHouseDate ge ${today}`);
          ohUrl.searchParams.set('$select', 'ListingKey,OpenHouseDate,OpenHouseStartTime,OpenHouseEndTime,OpenHouseType,OpenHouseStatus,OpenHouseRemarks');
          ohUrl.searchParams.set('$orderby', 'OpenHouseDate asc,OpenHouseStartTime asc');
          ohUrl.searchParams.set('$top', '100');

          const ohResp = await fetch(ohUrl.toString(), { headers: auth });
          if (ohResp.ok) {
            const ohData = await ohResp.json();
            allEvents = allEvents.concat(ohData.value ?? []);
          }
        }

        // Filter out cancelled and sort by date
        const events = allEvents
          .filter(e => e.OpenHouseStatus !== 'Cancelled')
          .sort((a, b) => {
            const da = (a.OpenHouseDate || '') + (a.OpenHouseStartTime || '');
            const db = (b.OpenHouseDate || '') + (b.OpenHouseStartTime || '');
            return da < db ? -1 : da > db ? 1 : 0;
          });

        if (!events.length) return json({ openHouses: [] });

        // Step 3: Resolve photo URLs (strip broken ?preset param) and merge
        const resolvePhoto = async (mediaUrl) => {
          if (!mediaUrl) return '';
          try {
            const r = await fetch(mediaUrl, { method: 'HEAD', redirect: 'follow' });
            return r.url ? r.url.split('?')[0] : mediaUrl;
          } catch { return mediaUrl; }
        };

        const openHouses = await Promise.all(events.map(async evt => {
          const prop = propMap[evt.ListingKey];
          if (!prop) return null;
          const photoUrl = prop.Media?.[0]?.MediaURL ? await resolvePhoto(prop.Media[0].MediaURL) : '';
          return {
            ...prop,
            Media: photoUrl ? [{ MediaURL: photoUrl }] : [],
            OpenHouseDate: evt.OpenHouseDate,
            OpenHouseStartTime: evt.OpenHouseStartTime,
            OpenHouseEndTime: evt.OpenHouseEndTime,
            OpenHouseType: evt.OpenHouseType,
            OpenHouseRemarks: evt.OpenHouseRemarks,
          };
        }));

        const ohResult = { openHouses: openHouses.filter(Boolean) };
        await cachePut(env, ohCacheKey, ohResult, TTL_OH);
        return json(ohResult);
      }

      // ── /map ─────────────────────────────────────────────────────────────────
      if (url.pathname === '/map') {
        const mapKey = 'map:' + url.search;
        const mapCached = await cacheGet(env, mapKey);
        if (mapCached) return json(mapCached);

        const tUrl = new URL(PROPERTY_URL);
        tUrl.searchParams.set('$filter',  buildFilter(url.searchParams));
        tUrl.searchParams.set('$select',  'ListingKey,ListingId,ListPrice,StandardStatus,Latitude,Longitude,BedroomsTotal,BathroomsTotalInteger,LivingArea,StreetNumber,StreetName,StreetSuffix,City,StateOrProvince,PostalCode');
        tUrl.searchParams.set('$top',     '500');
        tUrl.searchParams.set('$expand',  'Media');

        const resp = await fetch(tUrl.toString(), { headers: auth });
        if (!resp.ok) return json({ error: `Trestles map error: ${resp.status}` }, resp.status);

        const data = await resp.json();
        const pins = (data.value ?? []).map(l => ({
          ...l,
          Media: l.Media?.length ? [l.Media[0]] : []
        }));
        await cachePut(env, mapKey, pins, TTL_MAP);
        return json(pins);
      }

      // ── /listing/:key ────────────────────────────────────────────────────────
      const detailMatch = url.pathname.match(/^\/listing\/([^/]+)$/);
      if (detailMatch) {
        const key = decodeURIComponent(detailMatch[1]);
        const detailKey = 'listing:' + key;
        const detailCached = await cacheGet(env, detailKey);
        if (detailCached) return json(detailCached);

        const tUrl = new URL(PROPERTY_URL);
        tUrl.searchParams.set('$filter',  `ListingKey eq '${key}'`);
        tUrl.searchParams.set('$select',  DETAIL_FIELDS);
        tUrl.searchParams.set('$expand',  'Media');
        tUrl.searchParams.set('$top',     '1');

        const resp = await fetch(tUrl.toString(), { headers: auth });
        if (!resp.ok) { const errBody = await resp.text(); return json({ error: `Trestles detail error: ${resp.status}`, detail: errBody }, resp.status); }

        const body = await resp.json();
        const listing = body?.value?.[0];
        if (!listing) return json({ error: 'Listing not found' }, 404);
        await cachePut(env, detailKey, listing, TTL_DETAIL);
        return json(listing);
      }

      // ── POST /share-listing ──────────────────────────────────────────────────
      if (url.pathname === '/share-listing' && request.method === 'POST') {
        const {
          firstName, lastName, email, phone,
          recipientEmail, message,
          listingUrl, listingAddr, listingId,
          listingPrice, listingBeds, listingBaths, listingSqft, listingPhoto
        } = await request.json();

        if (!recipientEmail || !email) {
          return json({ error: 'Missing required fields: email, recipientEmail' }, 400);
        }

        const serif = "Georgia,'Times New Roman',serif";
        const htmlBody = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#efefef;font-family:Arial,sans-serif;">
<div style="max-width:620px;margin:24px auto;background:#fff;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,0.10);">

  <!-- Header -->
  <div style="background:#18254B;padding:36px 32px 28px;text-align:center;">
    <h1 style="margin:0 0 10px;font-family:${serif};font-size:32px;font-weight:400;letter-spacing:4px;text-transform:uppercase;line-height:1.2;">
      <span style="color:#ffffff;">A HOME YOU MIGHT </span><span style="color:#c9a96e;">LOVE</span>
    </h1>
    <p style="margin:0;color:rgba(255,255,255,0.55);font-size:13px;font-style:italic;font-family:${serif};">Sharing this beautiful home with you.</p>
  </div>

  <!-- Sender -->
  <div style="padding:28px 32px 24px;border-bottom:1px solid #efefef;">
    <p style="margin:0 0 14px;font-size:16px;color:#444;line-height:1.75;font-family:${serif};">
      <span style="color:#c9a96e;font-style:italic;">${firstName} ${lastName}</span>
      <span style="color:#555;"> thought you'd love this home and wanted to share it with you.</span>
    </p>
    ${message ? `<div style="border-left:3px solid #c9a96e;padding:10px 18px;background:#fdf9f3;">
      <p style="margin:0;font-size:15px;color:#666;font-style:italic;line-height:1.7;font-family:${serif};">"${message}"</p>
    </div>` : ''}
  </div>

  <!-- Listing card: photo left, details right -->
  <div style="padding:24px 32px;">
    <table style="width:100%;border-collapse:collapse;border:1px solid #e8e8e8;" cellspacing="0" cellpadding="0">
      <tr>
        ${listingPhoto ? `<td style="width:210px;vertical-align:top;padding:0;">
          <img src="${listingPhoto}" alt="${listingAddr}" width="210" style="display:block;width:210px;height:185px;object-fit:cover;">
        </td>` : ''}
        <td style="padding:16px 20px;vertical-align:top;">
          <p style="margin:0 0 8px;font-size:13px;color:#444;text-transform:uppercase;letter-spacing:1px;font-family:Arial,sans-serif;">&#128205; ${listingAddr}</p>
          ${listingPrice ? `<p style="margin:0 0 8px;font-size:24px;font-weight:700;color:#18254B;font-family:Arial,sans-serif;">${listingPrice}</p>` : ''}
          <p style="margin:0 0 10px;font-size:13px;color:#555;font-family:Arial,sans-serif;">
            ${[listingBeds ? `<strong style="color:#18254B;">${listingBeds}</strong> bd` : '', listingBaths ? `<strong style="color:#18254B;">${listingBaths}</strong> ba` : '', listingSqft ? `<strong style="color:#18254B;">${Number(listingSqft).toLocaleString()}</strong> sqft` : ''].filter(Boolean).join('&nbsp;&nbsp;&nbsp;')}
          </p>
          ${listingId ? `<p style="margin:0 0 14px;font-size:11px;color:#bbb;font-family:Arial,sans-serif;">MLS# ${listingId}</p>` : '<div style="height:14px;"></div>'}
          <a href="${listingUrl}" style="display:inline-block;background:#18254B;color:#ffffff;padding:10px 20px;text-decoration:none;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;font-family:Arial,sans-serif;">VIEW LISTING &rarr;</a>
        </td>
      </tr>
    </table>
  </div>

  <!-- Footer: logo + contact -->
  <div style="padding:20px 32px 24px;background:#f8f8f8;border-top:1px solid #e8e8e8;">
    <table style="width:100%;border-collapse:collapse;" cellspacing="0" cellpadding="0">
      <tr>
        <td style="vertical-align:middle;width:140px;padding-right:20px;">
          <img src="https://thejaiswalgroup.com/LOGOS/JaiswalGroupLogo_RE.png" alt="The Jaiswal Group" width="130" style="display:block;max-width:130px;height:auto;">
        </td>
        <td style="vertical-align:middle;border-left:1px solid #ddd;padding-left:20px;">
          <p style="margin:0 0 2px;font-size:11px;font-weight:700;color:#18254B;letter-spacing:1.5px;text-transform:uppercase;font-family:Arial,sans-serif;">Lynnette Jaiswal</p>
          <p style="margin:0 0 8px;font-size:11px;color:#999;font-family:Arial,sans-serif;">The Jaiswal Group Real Estate</p>
          <p style="margin:0;font-size:12px;color:#666;line-height:1.9;font-family:Arial,sans-serif;">
            858-290-7531<br>
            <a href="mailto:lynnette@thejaiswalgroup.com" style="color:#c9a96e;text-decoration:none;">lynnette@thejaiswalgroup.com</a><br>
            <a href="https://thejaiswalgroup.com" style="color:#999;text-decoration:none;">thejaiswalgroup.com</a>
          </p>
        </td>
        <td style="vertical-align:middle;text-align:right;padding-left:16px;white-space:nowrap;">
          <p style="margin:0;font-size:13px;color:#18254B;font-style:italic;font-family:${serif};line-height:1.7;">Local Expertise.<br>Exceptional Results.</p>
        </td>
      </tr>
    </table>
    <p style="margin:16px 0 0;font-size:10px;color:#ccc;text-align:center;font-family:Arial,sans-serif;">
      Listing data provided by CRMLS &middot; Information deemed reliable but not guaranteed
    </p>
  </div>

</div>
</body></html>`;

        const errors = [];

        // 1. Send email via Resend
        try {
          const resendResp = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${env.RESEND_API_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              from: 'The Jaiswal Group Real Estate <no-reply@thejaiswalgroup.com>',
              to: [recipientEmail],
              reply_to: email,
              subject: `${firstName} thought you'd love this home — ${listingAddr}`,
              html: htmlBody
            })
          });
          if (!resendResp.ok) {
            const t = await resendResp.text();
            errors.push(`Resend: ${resendResp.status} ${t}`);
          }
        } catch (e) {
          errors.push(`Resend: ${e.message}`);
        }

        // 2. Capture sender as lead in FUB
        try {
          const fubResp = await fetch('https://api.followupboss.com/v1/events', {
            method: 'POST',
            headers: {
              'Authorization': 'Basic ' + btoa(env.FUB_API_KEY + ':'),
              'Content-Type': 'application/json',
              'X-System': 'The Jaiswal Group Website',
              'X-System-Key': env.FUB_API_KEY
            },
            body: JSON.stringify({
              source: 'Website - Listing Share',
              type: 'Property Inquiry',
              message: `Shared ${listingAddr} (MLS# ${listingId}) with ${recipientEmail}. "${message}"`,
              uri: listingUrl,
              person: {
                firstName,
                lastName,
                email,
                ...(phone ? { phone } : {})
              }
            })
          });
          if (!fubResp.ok) {
            const t = await fubResp.text();
            errors.push(`FUB: ${fubResp.status} ${t}`);
          }
        } catch (e) {
          errors.push(`FUB: ${e.message}`);
        }

        if (errors.length) console.error('share-listing errors:', errors.join(' | '));
        // Return ok even if FUB fails — email delivery is what matters to the user
        return json({ ok: true, errors: errors.length ? errors : undefined });
      }

      if (url.pathname === '/fub-lead' && request.method === 'POST') {
        const { firstName, lastName, email, phone, source, note } = await request.json();
        if (!email) return json({ error: 'email required' }, 400);

        const fubResp = await fetch('https://api.followupboss.com/v1/events', {
          method: 'POST',
          headers: {
            'Authorization': 'Basic ' + btoa(env.FUB_API_KEY + ':'),
            'Content-Type': 'application/json',
            'X-System': 'The Jaiswal Group Website',
            'X-System-Key': env.FUB_API_KEY
          },
          body: JSON.stringify({
            source: source || 'Website - Save Search',
            type: 'Registration',
            message: note || '',
            person: {
              firstName: firstName || '',
              lastName:  lastName  || '',
              email,
              ...(phone ? { phone } : {})
            }
          })
        });

        if (!fubResp.ok) {
          const t = await fubResp.text();
          console.error('FUB lead error:', fubResp.status, t);
          return json({ error: `FUB ${fubResp.status}` }, 502);
        }
        return json({ ok: true });
      }

      return json({ error: 'Route not found' }, 404);

    } catch (err) {
      console.error('Worker error:', err);
      return json({ error: err.message }, 500);
    }
  }
};
