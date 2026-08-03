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
  'StreetNumber', 'StreetName', 'StreetSuffix',
  'City', 'StateOrProvince', 'PostalCode',
  'StandardStatus', 'PropertyType', 'PropertySubType',
  'Latitude', 'Longitude',
  'ModificationTimestamp', 'ListingContractDate', 'OnMarketDate',
  'AssociationFee', 'YearBuilt', 'LotSizeSquareFeet', 'GarageSpaces',
  'ListOfficeName', 'ListAgentFullName', 'ListAgentStateLicense'
].join(',');

// Fields needed for the full detail page (superset of CARD_FIELDS)
const DETAIL_FIELDS = CARD_FIELDS + ',' + [
  'PublicRemarks', 'PrivateRemarks',
  'BathroomsFull', 'BathroomsHalf',
  'Stories', 'Levels', 'FireplacesTotal',
  'PoolPrivateYN', 'SpaYN', 'WaterfrontYN',
  'Heating', 'Cooling', 'Flooring',
  'ParkingFeatures', 'GarageYN',
  'MLSAreaMajor', 'SubdivisionName',
  'ElementarySchool', 'MiddleOrJuniorSchool', 'HighSchool',
  'TaxAnnualAmount', 'AssociationName', 'AssociationFeeFrequency',
  'CloseDate', 'ClosePrice',
  'DaysOnMarket', 'CumulativeDaysOnMarket',
  'VirtualTourURLUnbranded', 'VirtualTourURLBranded',
  'OpenHouseRemarks'
].join(',');

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
  const minBaths = params.get('minBaths');
  if (minBeds) filters.push(`BedroomsTotal ge ${parseInt(minBeds)}`);
  if (minBaths) filters.push(`BathroomsTotalDecimal ge ${parseFloat(minBaths)}`);

  // City
  const city = params.get('city');
  if (city) filters.push(`City eq '${city.replace(/'/g, "''")}'`);

  // Property type  (e.g. Residential, Residential Income, Land)
  const type = params.get('type');
  if (type) filters.push(`PropertyType eq '${type}'`);

  // Property subtype (e.g. Single Family Residence, Condominium, Townhouse)
  const subtype = params.get('subtype');
  if (subtype) filters.push(`PropertySubType eq '${subtype.replace(/'/g, "''")}'`);

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
    if (n === 5) filters.push('BathroomsTotalDecimal ge 5');
    else         filters.push(`BathroomsTotalDecimal eq ${n}`);
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

  // Keyword search in public remarks
  const keyword = params.get('keyword');
  if (keyword) filters.push(`contains(PublicRemarks,'${keyword.replace(/'/g, "''")}')`);

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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
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
        const params = url.searchParams;
        const pageSize = Math.min(parseInt(params.get('limit') || '48'), 200);
        const page     = Math.max(parseInt(params.get('page')  || '0'), 0);
        const skip     = page * pageSize;

        const sortMap = {
          newest:     'ModificationTimestamp desc',
          oldest:     'ModificationTimestamp asc',
          price_asc:  'ListPrice asc',
          price_desc: 'ListPrice desc',
          sqft_desc:  'LivingArea desc'
        };
        const orderby = sortMap[params.get('sort')] || sortMap.newest;

        const tUrl = new URL(PROPERTY_URL);
        tUrl.searchParams.set('$filter',  buildFilter(params));
        tUrl.searchParams.set('$select',  CARD_FIELDS);
        tUrl.searchParams.set('$top',     pageSize);
        tUrl.searchParams.set('$skip',    skip);
        tUrl.searchParams.set('$orderby', orderby);
        tUrl.searchParams.set('$count',   'true');
        // Grab just 1 photo per listing for the card thumbnail
        tUrl.searchParams.set('$expand',  'Media');

        const resp = await fetch(tUrl.toString(), { headers: auth });
        if (!resp.ok) return json({ error: `Trestles search error: ${resp.status}` }, resp.status);

        const data = await resp.json();
        // Trestles doesn't support $top inside $expand, so we get all photos — trim to first only
        const listings = (data.value ?? []).map(l => ({
          ...l,
          Media: l.Media?.length ? [l.Media[0]] : []
        }));
        return json({ total: data['@odata.count'] ?? null, page, pageSize, listings });
      }

      // ── /map ─────────────────────────────────────────────────────────────────
      // Lightweight endpoint — only fields needed for map pins.
      // Fetches up to 500 so the map shows a full area without loading full cards.
      if (url.pathname === '/map') {
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
        return json(pins);
      }

      // ── /listing/:key ────────────────────────────────────────────────────────
      const detailMatch = url.pathname.match(/^\/listing\/([^/]+)$/);
      if (detailMatch) {
        const key  = decodeURIComponent(detailMatch[1]);
        const tUrl = `${PROPERTY_URL}('${key}')?$select=${DETAIL_FIELDS}&$expand=Media`;

        const resp = await fetch(tUrl, { headers: auth });
        if (resp.status === 404) return json({ error: 'Listing not found' }, 404);
        if (!resp.ok) return json({ error: `Trestles detail error: ${resp.status}` }, resp.status);

        return json(await resp.json());
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
          <p style="margin:0 0 8px;font-size:11px;color:#aaa;text-transform:uppercase;letter-spacing:1px;font-family:Arial,sans-serif;">&#128205; ${listingAddr}</p>
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
          <p style="margin:0;font-size:13px;color:#bbb;font-style:italic;font-family:${serif};line-height:1.7;">Local Expertise.<br>Exceptional Results.</p>
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
