
// ══════════════════════════════════════════════════════════════════
// BAZI 八字排盘  (requires lunar.js loaded first)
// ══════════════════════════════════════════════════════════════════

// ── Element lookups ──────────────────────────────────────────────
const BZ_GAN_ELEM  = {甲:'木',乙:'木',丙:'火',丁:'火',戊:'土',己:'土',庚:'金',辛:'金',壬:'水',癸:'水'};
const BZ_ZHI_ELEM  = {子:'水',丑:'土',寅:'木',卯:'木',辰:'土',巳:'火',午:'火',未:'土',申:'金',酉:'金',戌:'土',亥:'水'};
const BZ_ELEM_CSS  = {木:'bz-c-mu',火:'bz-c-huo',土:'bz-c-tu',金:'bz-c-jin',水:'bz-c-shui'};
const BZ_ELEM_BG   = {木:'#5a9e7a',火:'#b03030',土:'#c47a2a',金:'#8a9ca8',水:'#2c7a7b'};
const BZ_ELEM_LIGHT= {木:'#eaf6ef',火:'#fce8e8',土:'#fdf3e5',金:'#eff2f4',水:'#e5f2f2'};
const BZ_SHICHEN   = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
const BZ_ZODIAC    = ['鼠','牛','虎','兔','龙','蛇','马','羊','猴','鸡','狗','猪'];
// 藏干 (hidden stems in branches) - main + sub
const BZ_HIDE = {
  子:['癸'],丑:['己','癸','辛'],寅:['甲','丙','戊'],卯:['乙'],
  辰:['戊','乙','癸'],巳:['丙','庚','戊'],午:['丁','己'],未:['己','丁','乙'],
  申:['庚','壬','戊'],酉:['辛'],戌:['戊','辛','丁'],亥:['壬','甲']
};
// BZ_REGION is loaded from bazi_region.js (injected before this block)

// ── Profile state ─────────────────────────────────────────────────
let bzProfiles   = JSON.parse(localStorage.getItem('bz_profiles') || '[]');
let bzEditId     = null;
let bzGender     = 'female';
let bzCurrentPid = null;
// picker state
let bzPickerMode = 'solar';
let bzPickY=1990, bzPickM=1, bzPickD=1, bzPickH=12, bzPickMin=0;
// lunar picker state
let bzLPickY=1990, bzLPickH=12;
let bzLMonths = []; // [{month, leap, dayCount, label}]
let bzLPgm=false, bzLYTmr=null, bzLMTmr=null;
// location state
let bzLocation   = '';   // province name, e.g. '北京'
let bzTzOffset   = 0;   // minutes offset from East-8 (Beijing) time

// ── True solar time helper ────────────────────────────────────────
function bzGetSolar(p) {
  const off = p.tzOffset || 0;
  const baseMin = p.minute || 0;
  if (!off) return Solar.fromYmdHms(p.year, p.month, p.day, p.hour, baseMin, 0);
  const totalMin = p.hour * 60 + baseMin + off;
  let h = Math.floor(totalMin / 60);
  const m = ((totalMin % 60) + 60) % 60;
  let y = p.year, mo = p.month, d = p.day;
  if (h < 0) {
    const prev = new Date(y, mo - 1, d - 1);
    y = prev.getFullYear(); mo = prev.getMonth() + 1; d = prev.getDate(); h += 24;
  } else if (h >= 24) {
    const next = new Date(y, mo - 1, d + 1);
    y = next.getFullYear(); mo = next.getMonth() + 1; d = next.getDate(); h -= 24;
  }
  return Solar.fromYmdHms(y, mo, d, h, m, 0);
}

// ── Timezone label helper ─────────────────────────────────────────
function bzTzLabel(offset) {
  if (!offset) return '【东8】中国标准时间';
  const absMin = Math.abs(offset);
  const h = Math.floor(absMin / 60), m = absMin % 60;
  const diff = offset >= 0 ? `+${h}h${m ? m + 'm' : ''}` : `-${h}h${m ? m + 'm' : ''}`;
  const zone = 8 + offset / 60;
  return `【东${zone.toFixed(1).replace('.0','')}】真太阳时 (${diff})`;
}

// ── Navigation ───────────────────────────────────────────────────
function openBz() {
  document.getElementById('bzOv').classList.add('bz-show');
  bzGoHome();
}
function closeBz() {
  document.getElementById('bzOv').classList.remove('bz-show');
}
function bzGoHome() {
  bzShowPage('bzPgHome');
  bzRenderHome();
}
function bzGoForm(id) {
  try {
    bzEditId = id;
    bzGender = 'female';
    bzLocation = '';
    bzTzOffset = 0;
    const gf = document.getElementById('bzGF');
    const gm = document.getElementById('bzGM');
    if (gf) gf.classList.add('bz-sel');
    if (gm) gm.classList.remove('bz-sel');
    const nameEl = document.getElementById('bzFName');
    if (nameEl) nameEl.value = '';
    const tdEl = document.getElementById('bzFTimeDisp');
    if (tdEl) { tdEl.textContent = '请选择'; tdEl.classList.add('bz-form-ph'); }
    const locEl = document.getElementById('bzFLocDisp');
    if (locEl) { locEl.textContent = '请选择'; locEl.classList.add('bz-form-ph'); }
    const tzEl = document.getElementById('bzFTzDisp');
    if (tzEl) tzEl.textContent = '【东8】中国标准时间';
    if (id !== null) {
      const p = bzProfiles.find(x=>x.id===id);
      if (p) {
        if (nameEl) nameEl.value = p.name||'';
        bzGender = p.gender||'female';
        bzPickY=p.year; bzPickM=p.month; bzPickD=p.day; bzPickH=p.hour; bzPickMin=p.minute||0;
        bzLocation = p.location||'';
        bzTzOffset = p.tzOffset||0;
        if (tdEl) {
          tdEl.textContent = `${p.year}年${p.month}月${p.day}日 ${p.hour}:${String(p.minute||0).padStart(2,'0')}`;
          tdEl.classList.remove('bz-form-ph');
        }
        if (locEl) {
          if (bzLocation) {
            const parts = bzLocation.split('/');
            locEl.textContent = parts.length >= 3 ? `${parts[1]} ${parts[2]}` : bzLocation;
            locEl.classList.remove('bz-form-ph');
          }
        }
        if (tzEl && bzTzOffset) tzEl.textContent = bzTzLabel(bzTzOffset);
        if (p.gender==='male') {
          if (gm) gm.classList.add('bz-sel');
          if (gf) gf.classList.remove('bz-sel');
        }
      }
    }
    bzShowPage('bzPgForm');
  } catch(e) {
    document.title = 'bzGoForm ERR: ' + e.message;
    console.error('bzGoForm error:', e);
  }
}
function bzShowPage(id) {
  ['bzPgHome','bzPgForm','bzPgDetail'].forEach(p=>{
    const el = document.getElementById(p);
    if (el) el.classList.toggle('bz-active', p === id);
  });
}

// ── Home render ──────────────────────────────────────────────────
function bzRenderHome() {
  const empty = document.getElementById('bzEmpty');
  const list  = document.getElementById('bzProfileList');
  if (!bzProfiles.length) {
    empty.style.display = 'flex';
    list.style.display  = 'none';
    return;
  }
  empty.style.display = 'none';
  list.style.display  = 'block';
  const now = new Date();
  list.innerHTML = bzProfiles.map(p => {
    const age = now.getFullYear() - p.year + 1;
    const elem = BZ_GAN_ELEM[p.dayGan] || '?';
    const bg   = BZ_ELEM_BG[elem] || '#999';
    return `<div class="bz-pcard" onclick="bzShowDetail('${p.id}')">
      <div style="width:50px;height:50px;border-radius:50%;background:${bg};display:flex;align-items:center;justify-content:center;flex-shrink:0;">
        <span style="font-size:22px;color:#fff;font-family:'Noto Serif SC';">${p.dayGan||'?'}</span>
      </div>
      <div style="flex:1;">
        <div style="font-size:15px;font-weight:600;color:#1a1a1a;font-family:'Noto Serif SC';">${p.name||'未命名'}</div>
        <div style="font-size:12px;color:#999;margin-top:3px;">${p.year}年${p.month}月${p.day}日 · ${age}岁 · ${p.gender==='male'?'男':'女'}</div>
        <div style="font-size:12px;color:${bg};margin-top:2px;">${p.yearGz}年 ${p.monthGz}月 ${p.dayGz}日 ${p.hourGz}时</div>
      </div>
      <div onclick="event.stopPropagation();bzGoForm('${p.id}')" style="width:32px;height:32px;display:flex;align-items:center;justify-content:center;color:#ccc;font-size:20px;cursor:pointer;">›</div>
    </div>`;
  }).join('');
}

// ── Gender selector ──────────────────────────────────────────────
function bzSelGender(g) {
  bzGender = g;
  document.getElementById('bzGF').classList.toggle('bz-sel', g==='female');
  document.getElementById('bzGM').classList.toggle('bz-sel', g==='male');
}

// ── Time picker ───────────────────────────────────────────────────
// Ganzhi for lunar year display
const BZ_LY_GAN = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
const BZ_LY_ZHI = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
function bzLunarYearGZ(y) {
  const i = ((y - 4) % 60 + 60) % 60;
  return BZ_LY_GAN[i % 10] + BZ_LY_ZHI[i % 12];
}

function bzOpenPicker() {
  document.getElementById('bzPickerMask').classList.add('bz-show');
  bzSwitchPickerMode('solar');
}
function bzSwitchPickerMode(mode) {
  bzPickerMode = mode;
  const ts = document.getElementById('bzTabSolar'), tl = document.getElementById('bzTabLunar');
  if (ts) ts.classList.toggle('bz-tab-sel', mode === 'solar');
  if (tl) tl.classList.toggle('bz-tab-sel', mode === 'lunar');
  const sc = document.getElementById('bzSolarCols'), lc = document.getElementById('bzLunarCols');
  if (sc) sc.style.display = mode === 'solar' ? 'flex' : 'none';
  if (lc) lc.style.display = mode === 'lunar'  ? 'flex' : 'none';
  if (mode === 'solar') {
    bzInitPickerCol('bzColY',   1900, 2025, bzPickY,   'year');
    bzInitPickerCol('bzColM',   1,    12,   bzPickM,   'month');
    bzInitPickerCol('bzColD',   1,    31,   bzPickD,   'day');
    bzInitPickerCol('bzColH',   0,    23,   bzPickH,   'hour');
    bzInitPickerCol('bzColMin', 0,    59,   bzPickMin, 'minute');
  } else {
    bzLInitYearCol();
  }
}
function bzInitPickerCol(colId, min, max, cur, type) {
  const col = document.getElementById(colId);
  if (!col) return;
  const suf = {year:'年', month:'月', day:'日', hour:'时', minute:'分'}[type] || '';
  let html = '<div class="bz-col-pad"></div>';
  for (let v = min; v <= max; v++) {
    const disp = type === 'minute' ? String(v).padStart(2, '0') : v;
    html += `<div class="bz-col-item">${disp}${suf}</div>`;
  }
  html += '<div class="bz-col-pad"></div>';
  col.innerHTML = html;
  col.dataset.min = min;
  requestAnimationFrame(() => { col.scrollTop = (cur - min) * 44; });
}
function bzClosePicker() {
  document.getElementById('bzPickerMask').classList.remove('bz-show');
}
function bzConfirmTime() {
  function readCol(colId, fallback) {
    const col = document.getElementById(colId);
    if (!col) return fallback;
    return parseInt(col.dataset.min || fallback) + Math.round(col.scrollTop / 44);
  }
  if (bzPickerMode === 'solar') {
    bzPickY   = readCol('bzColY',   1900);
    bzPickM   = readCol('bzColM',   1);
    bzPickD   = readCol('bzColD',   1);
    bzPickH   = readCol('bzColH',   0);
    bzPickMin = readCol('bzColMin', 0);
  } else {
    // Lunar → Solar conversion
    const lyCol = document.getElementById('bzColLY');
    bzLPickY = 1900 + Math.max(0, Math.min(125, Math.round((lyCol?.scrollTop||0) / 44)));
    const lmCol = document.getElementById('bzColLM');
    const mIdx  = Math.max(0, Math.min(bzLMonths.length - 1, Math.round((lmCol?.scrollTop||0) / 44)));
    const selM  = bzLMonths[mIdx] || bzLMonths[0];
    const ldCol = document.getElementById('bzColLD');
    const dIdx  = Math.max(0, Math.round((ldCol?.scrollTop||0) / 44));
    bzLPickH = readCol('bzColLH', 0);
    if (selM) {
      try {
        const lunarM = selM.leap ? -selM.month : selM.month;
        const lunar  = Lunar.fromYmd(bzLPickY, lunarM, dIdx + 1);
        const solar  = lunar.getSolar();
        bzPickY = solar.getYear(); bzPickM = solar.getMonth(); bzPickD = solar.getDay();
      } catch(e) { alert('农历日期转换失败，请重新选择'); return; }
    }
    bzPickH = bzLPickH; bzPickMin = 0;
  }
  bzClosePicker();
  const td = document.getElementById('bzFTimeDisp');
  if (td) {
    td.textContent = `${bzPickY}年${bzPickM}月${bzPickD}日 ${bzPickH}:${String(bzPickMin).padStart(2,'0')}`;
    td.classList.remove('bz-form-ph');
  }
}

// ── Lunar picker cascade ──────────────────────────────────────────
function bzLInitYearCol() {
  const col = document.getElementById('bzColLY');
  if (!col) return;
  let html = '<div class="bz-col-pad"></div>';
  for (let y = 1900; y <= 2025; y++) {
    html += `<div class="bz-col-item" style="font-size:13px;">${y}(${bzLunarYearGZ(y)})</div>`;
  }
  html += '<div class="bz-col-pad"></div>';
  col.innerHTML = html;
  bzLPgm = true;
  col.scrollTop = (bzLPickY - 1900) * 44;
  requestAnimationFrame(() => { bzLPgm = false; });
  bzLLoadMonths(bzLPickY);
}
function bzLLoadMonths(year) {
  bzLMonths = [];
  const names = ['','正','二','三','四','五','六','七','八','九','十','冬','腊'];
  try {
    LunarYear.fromYear(year).getMonths().forEach(m => {
      const mn   = Math.abs(m.getMonth());
      const leap = m.isLeap();
      bzLMonths.push({ month: mn, leap, dayCount: m.getDayCount(), label: (leap ? '闰' : '') + names[mn] + '月' });
    });
  } catch(e) {
    for (let i = 1; i <= 12; i++) bzLMonths.push({ month:i, leap:false, dayCount:30, label: names[i]+'月' });
  }
  const col = document.getElementById('bzColLM');
  if (!col) return;
  col.innerHTML = '<div class="bz-col-pad"></div>' +
    bzLMonths.map(m => `<div class="bz-col-item">${m.label}</div>`).join('') +
    '<div class="bz-col-pad"></div>';
  bzLPgm = true; col.scrollTop = 0; requestAnimationFrame(() => { bzLPgm = false; });
  bzLLoadDays(0);
}
function bzLLoadDays(mIdx) {
  const m = bzLMonths[mIdx];
  if (!m) return;
  const dayNames = ['初一','初二','初三','初四','初五','初六','初七','初八','初九','初十',
    '十一','十二','十三','十四','十五','十六','十七','十八','十九','二十',
    '廿一','廿二','廿三','廿四','廿五','廿六','廿七','廿八','廿九','三十'];
  const col = document.getElementById('bzColLD');
  if (!col) return;
  col.innerHTML = '<div class="bz-col-pad"></div>' +
    dayNames.slice(0, m.dayCount).map(d => `<div class="bz-col-item">${d}</div>`).join('') +
    '<div class="bz-col-pad"></div>';
  bzLPgm = true; col.scrollTop = 0; requestAnimationFrame(() => { bzLPgm = false; });
  const hCol = document.getElementById('bzColLH');
  if (hCol && !hCol.querySelector('.bz-col-item')) {
    hCol.innerHTML = '<div class="bz-col-pad"></div>' +
      Array.from({length:24}, (_,i) => `<div class="bz-col-item">${i}时</div>`).join('') +
      '<div class="bz-col-pad"></div>';
    bzLPgm = true; hCol.scrollTop = bzLPickH * 44; requestAnimationFrame(() => { bzLPgm = false; });
  }
}
function bzLOnScrollY() {
  if (bzLPgm) return;
  clearTimeout(bzLYTmr);
  bzLYTmr = setTimeout(() => {
    const col = document.getElementById('bzColLY');
    if (!col) return;
    const y = 1900 + Math.max(0, Math.min(125, Math.round(col.scrollTop / 44)));
    if (y !== bzLPickY) { bzLPickY = y; bzLLoadMonths(y); }
  }, 180);
}
function bzLOnScrollM() {
  if (bzLPgm) return;
  clearTimeout(bzLMTmr);
  bzLMTmr = setTimeout(() => {
    const col = document.getElementById('bzColLM');
    if (!col) return;
    const idx = Math.max(0, Math.min(bzLMonths.length - 1, Math.round(col.scrollTop / 44)));
    bzLLoadDays(idx);
  }, 180);
}

// ── Cascade location picker ───────────────────────────────────────
let bzLocSelP = 0, bzLocSelC = 0, bzLocSelD = 0;
let bzLocPgm  = false; // true during programmatic scroll (suppresses cascade reload)
let bzLocPTmr = null, bzLocCTmr = null;

function bzOpenLocationPicker() {
  const mask = document.getElementById('bzLocMask');
  if (!mask) return;
  // Try to restore current selection
  if (bzLocation) {
    const parts = bzLocation.split('/');
    const pIdx = BZ_REGION.findIndex(r => r[0] === parts[0]);
    if (pIdx >= 0) {
      bzLocSelP = pIdx;
      const cities = BZ_REGION[pIdx][1];
      const cIdx = cities.findIndex(c => c[0] === parts[1]);
      bzLocSelC = cIdx >= 0 ? cIdx : 0;
      const dists = cities[bzLocSelC][2];
      const dIdx = dists.indexOf(parts[2]);
      bzLocSelD = dIdx >= 0 ? dIdx : 0;
    }
  }
  mask.classList.add('bz-show');
  bzLocLoadP();
}
function bzLocLoadP() {
  const col = document.getElementById('bzLocColP');
  if (!col) return;
  col.innerHTML = '<div class="bz-col-pad"></div>' +
    BZ_REGION.map(r => `<div class="bz-col-item">${r[0]}</div>`).join('') +
    '<div class="bz-col-pad"></div>';
  bzLocPgm = true;
  col.scrollTop = bzLocSelP * 44;
  requestAnimationFrame(() => { bzLocPgm = false; });
  bzLocLoadC();
}
function bzLocLoadC() {
  const col = document.getElementById('bzLocColC');
  if (!col) return;
  const cities = (BZ_REGION[bzLocSelP] || BZ_REGION[0])[1];
  col.innerHTML = '<div class="bz-col-pad"></div>' +
    cities.map(c => `<div class="bz-col-item">${c[0]}</div>`).join('') +
    '<div class="bz-col-pad"></div>';
  bzLocPgm = true;
  col.scrollTop = bzLocSelC * 44;
  requestAnimationFrame(() => { bzLocPgm = false; });
  bzLocLoadD();
}
function bzLocLoadD() {
  const col = document.getElementById('bzLocColD');
  if (!col) return;
  const cities = (BZ_REGION[bzLocSelP] || BZ_REGION[0])[1];
  const dists  = (cities[bzLocSelC] || cities[0])[2];
  col.innerHTML = '<div class="bz-col-pad"></div>' +
    dists.map(d => `<div class="bz-col-item">${d}</div>`).join('') +
    '<div class="bz-col-pad"></div>';
  bzLocPgm = true;
  col.scrollTop = bzLocSelD * 44;
  requestAnimationFrame(() => { bzLocPgm = false; });
}
function bzLocOnScrollP() {
  if (bzLocPgm) return;
  clearTimeout(bzLocPTmr);
  bzLocPTmr = setTimeout(() => {
    const col = document.getElementById('bzLocColP');
    if (!col) return;
    const idx = Math.max(0, Math.min(BZ_REGION.length - 1, Math.round(col.scrollTop / 44)));
    if (idx !== bzLocSelP) { bzLocSelP = idx; bzLocSelC = 0; bzLocSelD = 0; bzLocLoadC(); }
  }, 180);
}
function bzLocOnScrollC() {
  if (bzLocPgm) return;
  clearTimeout(bzLocCTmr);
  bzLocCTmr = setTimeout(() => {
    const col = document.getElementById('bzLocColC');
    if (!col) return;
    const cities = (BZ_REGION[bzLocSelP] || BZ_REGION[0])[1];
    const idx = Math.max(0, Math.min(cities.length - 1, Math.round(col.scrollTop / 44)));
    if (idx !== bzLocSelC) { bzLocSelC = idx; bzLocSelD = 0; bzLocLoadD(); }
  }, 180);
}
function bzLocOnScrollD() {
  if (bzLocPgm) return;
  const col = document.getElementById('bzLocColD');
  if (!col) return;
  const cities = (BZ_REGION[bzLocSelP] || BZ_REGION[0])[1];
  const dists  = (cities[bzLocSelC] || cities[0])[2];
  bzLocSelD = Math.max(0, Math.min(dists.length - 1, Math.round(col.scrollTop / 44)));
}
function bzConfirmLocation() {
  const prov   = BZ_REGION[bzLocSelP];
  const cities = prov[1];
  const city   = cities[bzLocSelC] || cities[0];
  const dists  = city[2];
  const dist   = dists[bzLocSelD] || dists[0];
  const lng    = city[1];
  bzLocation  = `${prov[0]}/${city[0]}/${dist}`;
  bzTzOffset  = Math.round((lng - 120) * 4);
  const locEl = document.getElementById('bzFLocDisp');
  if (locEl) { locEl.textContent = `${city[0]} ${dist}`; locEl.classList.remove('bz-form-ph'); }
  const tzEl  = document.getElementById('bzFTzDisp');
  if (tzEl) tzEl.textContent = bzTzLabel(bzTzOffset);
  bzCloseLocationPicker();
}
function bzLocGPS() {
  if (!navigator.geolocation) { alert('您的浏览器不支持定位'); return; }
  const btn = document.getElementById('bzLocGpsBtn');
  if (btn) btn.textContent = '定位中…';
  navigator.geolocation.getCurrentPosition(pos => {
    const lng = pos.coords.longitude;
    bzTzOffset = Math.round((lng - 120) * 4);
    // Find nearest province by longitude
    let bestP = 0, bestDist = 999;
    BZ_REGION.forEach((r, i) => {
      r[1].forEach(c => {
        const d = Math.abs(c[1] - lng);
        if (d < bestDist) { bestDist = d; bestP = i; }
      });
    });
    bzLocSelP = bestP;
    bzLocSelC = 0;
    bzLocSelD = 0;
    bzLocLoadP();
    if (btn) btn.textContent = '📍 获取定位';
  }, () => {
    if (btn) btn.textContent = '📍 获取定位';
    alert('定位失败，请手动选择');
  });
}
function bzCloseLocationPicker() {
  const mask = document.getElementById('bzLocMask');
  if (mask) mask.classList.remove('bz-show');
}

// ── Save profile ─────────────────────────────────────────────────
function bzSaveProfile() {
  const name = document.getElementById('bzFName').value.trim() || '我';
  if (!bzPickY) { alert('请选择出生时间'); return; }
  try {
    // Apply true solar time correction (if location is set)
    const solar = bzGetSolar({
      year: bzPickY, month: bzPickM, day: bzPickD, hour: bzPickH, minute: bzPickMin, tzOffset: bzTzOffset
    });
    const lunar  = solar.getLunar();
    const ec     = lunar.getEightChar();
    const yGan   = ec.getYearGan(), yZhi = ec.getYearZhi();
    const mGan   = ec.getMonthGan(), mZhi = ec.getMonthZhi();
    const dGan   = ec.getDayGan(),   dZhi = ec.getDayZhi();
    const hGan   = ec.getTimeGan(),   hZhi = ec.getTimeZhi();
    const id = bzEditId || ('bz' + Date.now());
    const profile = {
      id, name, gender: bzGender,
      year: bzPickY, month: bzPickM, day: bzPickD, hour: bzPickH, minute: bzPickMin,
      location: bzLocation,
      tzOffset: bzTzOffset,
      yearGz: yGan+yZhi, monthGz: mGan+mZhi,
      dayGz:  dGan+dZhi, hourGz:  hGan+hZhi,
      yearGan:yGan, yearZhi:yZhi,
      monthGan:mGan, monthZhi:mZhi,
      dayGan:dGan, dayZhi:dZhi,
      hourGan:hGan, hourZhi:hZhi
    };
    if (bzEditId) {
      const idx = bzProfiles.findIndex(x=>x.id===bzEditId);
      if (idx>=0) bzProfiles[idx] = profile;
    } else {
      bzProfiles.push(profile);
    }
    localStorage.setItem('bz_profiles', JSON.stringify(bzProfiles));
    bzShowDetail(id);
  } catch(e) {
    alert('计算失败，请检查日期：' + e.message);
  }
}

// ── Show detail (命盘) ────────────────────────────────────────────
function bzShowDetail(id) {
  const p = bzProfiles.find(x=>x.id===id);
  if (!p) return;
  bzCurrentPid = id;
  const sc = document.getElementById('bzDetailSc');
  sc.innerHTML = bzRenderDetail(p);
  bzShowPage('bzPgDetail');
  sc.scrollTop = 0;
  bzRenderDaYun(id);
}

function bzRenderDetail(p) {
  const solar  = bzGetSolar(p);
  const lunar  = solar.getLunar();
  const ec     = lunar.getEightChar();
  const now    = new Date();
  const curYr  = now.getFullYear();
  const age    = curYr - p.year + 1;

  // Pillars
  const pillars = [
    {lbl:'年柱', gan:p.yearGan,  zhi:p.yearZhi,  ss: ec.getYearShiShenGan(),  nayin:ec.getYearNaYin(),  hide:BZ_HIDE[p.yearZhi]||[]},
    {lbl:'月柱', gan:p.monthGan, zhi:p.monthZhi, ss: ec.getMonthShiShenGan(), nayin:ec.getMonthNaYin(), hide:BZ_HIDE[p.monthZhi]||[]},
    {lbl:'日柱', gan:p.dayGan,   zhi:p.dayZhi,   ss: '日主',                  nayin:ec.getDayNaYin(),   hide:BZ_HIDE[p.dayZhi]||[]},
    {lbl:'时柱', gan:p.hourGan,  zhi:p.hourZhi,  ss: ec.getTimeShiShenGan(),  nayin:ec.getTimeNaYin(),  hide:BZ_HIDE[p.hourZhi]||[]}
  ];

  // Lunar date
  const lY = lunar.getYearInChinese();
  const lM = lunar.getMonthInChinese();
  const lD = lunar.getDayInChinese();
  // Shichen (时辰)
  const hIdx = Math.floor(((p.hour + 1) % 24) / 2);
  const shichen = BZ_SHICHEN[hIdx];
  // Day master info
  const dmElem  = BZ_GAN_ELEM[p.dayGan] || '?';
  const dmColor = BZ_ELEM_BG[dmElem] || '#999';
  const zodiac  = BZ_ZODIAC[(p.year - 4) % 12];
  const ganArr  = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
  const dmYang  = ganArr.indexOf(p.dayGan) % 2 === 0;

  // Five elements count
  const feCount = {木:0,火:0,土:0,金:0,水:0};
  [p.yearGan,p.monthGan,p.dayGan,p.hourGan].forEach(g=>{const e=BZ_GAN_ELEM[g];if(e)feCount[e]+=1.5;});
  [p.yearZhi,p.monthZhi,p.dayZhi,p.hourZhi].forEach(z=>{
    const e=BZ_ZHI_ELEM[z]; if(e)feCount[e]+=1;
    (BZ_HIDE[z]||[]).forEach(hg=>{const he=BZ_GAN_ELEM[hg];if(he)feCount[he]+=0.5;});
  });
  const feTotal = Object.values(feCount).reduce((a,b)=>a+b,0)||1;
  const fePct   = {};
  Object.keys(feCount).forEach(k=>fePct[k]=Math.round(feCount[k]/feTotal*100));

  const dmSupport = feCount[dmElem] || 0;
  const isStrong  = dmSupport >= (feTotal * 0.3);
  const strength  = isStrong ? '身强' : '身弱';

  const colW = 'width:22%';
  function circle(char, elem, extra) {
    const cls = BZ_ELEM_CSS[elem] || '';
    return `<div class="bz-gz-circle ${cls}" style="${extra||''}">${char}</div>`;
  }
  function hgLine(hideArr) {
    if(!hideArr||!hideArr.length) return '';
    return hideArr.map(g => {
      const e = BZ_GAN_ELEM[g]||'';
      const c = BZ_ELEM_BG[e]||'#999';
      const ss = bzGetSS(g, p.dayGan);
      return `<span style="color:${c};font-size:11px;">${g}·<span style="font-size:10px;">${ss}</span></span>`;
    }).join('<br>');
  }

  let yunStartInfo = '';
  try {
    const yun = ec.getYun(p.gender==='male'?1:0);
    const sy  = yun.getStartSolar();
    const startAge = sy.getYear() - p.year + 1;
    yunStartInfo = `${startAge}岁起运 (${sy.getYear()}年)`;
  } catch(e) { yunStartInfo = ''; }

  // Location note for header
  const locNote = p.location ? `${p.location} · ` : '';
  // Correction note
  const corrNote = p.tzOffset
    ? `<div style="font-size:11px;color:#c47a2a;margin-top:2px;">真太阳时校正 ${p.tzOffset >= 0 ? '+' : ''}${p.tzOffset}分</div>`
    : '';

  return `
<div style="background:#f5f3ef;padding-bottom:30px;">

  <!-- Profile title -->
  <div style="padding:14px 16px 10px;display:flex;align-items:center;gap:12px;">
    <div style="width:44px;height:44px;border-radius:50%;background:${dmColor};display:flex;align-items:center;justify-content:center;flex-shrink:0;">
      <span style="font-size:20px;color:#fff;font-family:'Noto Serif SC';">${p.dayGan}</span>
    </div>
    <div>
      <div style="font-size:16px;font-weight:600;color:#1a1a1a;font-family:'Noto Serif SC';">${p.name||'我'}</div>
      <div style="font-size:12px;color:#888;margin-top:2px;">${locNote}${p.year}年${p.month}月${p.day}日 ${p.hour}时 · ${age}岁 · ${p.gender==='male'?'男':'女'}</div>
      ${corrNote}
    </div>
  </div>

  <!-- 四柱 table card -->
  <div class="bz-mp-card">
    <table style="width:100%;border-collapse:collapse;">
      <tr style="background:#fafaf8;">
        <td style="width:14%;padding:8px 4px 6px;font-size:11px;color:#bbb;text-align:center;"></td>
        <td style="width:22%;padding:8px 4px 6px;font-size:12px;color:#888;text-align:center;font-family:'Noto Serif SC';">年</td>
        <td style="width:22%;padding:8px 4px 6px;font-size:12px;color:#888;text-align:center;font-family:'Noto Serif SC';">月</td>
        <td style="width:22%;padding:8px 4px 6px;font-size:12px;color:#888;text-align:center;font-family:'Noto Serif SC';">日</td>
        <td style="width:20%;padding:8px 4px 6px;font-size:12px;color:#888;text-align:center;font-family:'Noto Serif SC';">时</td>
      </tr>
      <tr>
        <td style="padding:4px;font-size:11px;color:#bbb;text-align:center;vertical-align:middle;">公历</td>
        <td style="padding:4px;font-size:13px;color:#333;text-align:center;">${p.year}</td>
        <td style="padding:4px;font-size:13px;color:#333;text-align:center;">${p.month}</td>
        <td style="padding:4px;font-size:13px;color:#333;text-align:center;">${p.day}</td>
        <td style="padding:4px;font-size:13px;color:#333;text-align:center;">${p.hour}</td>
      </tr>
      <tr>
        <td style="padding:4px;font-size:11px;color:#bbb;text-align:center;vertical-align:middle;">农历</td>
        <td style="padding:4px;font-size:13px;color:#333;text-align:center;">${lY}</td>
        <td style="padding:4px;font-size:13px;color:#333;text-align:center;">${lM}</td>
        <td style="padding:4px;font-size:13px;color:#333;text-align:center;">${lD}</td>
        <td style="padding:4px;font-size:13px;color:#333;text-align:center;">${shichen}</td>
      </tr>
      <tr style="border-top:1px solid #f5f0eb;">
        <td style="padding:5px 4px;font-size:11px;color:#bbb;text-align:center;"></td>
        ${pillars.map(pl=>`<td style="padding:5px 4px;text-align:center;"><div style="font-size:12px;color:#888;font-family:'Noto Serif SC';">${pl.lbl}</div></td>`).join('')}
      </tr>
      <tr>
        <td style="padding:3px 4px;font-size:11px;color:#bbb;text-align:center;vertical-align:middle;">十神</td>
        ${pillars.map(pl=>`<td style="padding:3px 4px;text-align:center;"><span style="font-size:12px;color:#E84E0F;font-family:'Noto Serif SC';">${pl.ss}</span></td>`).join('')}
      </tr>
      <tr>
        <td style="padding:5px 4px;font-size:11px;color:#bbb;text-align:center;vertical-align:middle;">天干</td>
        ${pillars.map(pl=>`<td style="padding:5px 2px;text-align:center;">${circle(pl.gan, BZ_GAN_ELEM[pl.gan], pl.lbl==='日柱'?'box-shadow:0 0 0 2px #E84E0F;':'')}</td>`).join('')}
      </tr>
      <tr>
        <td style="padding:5px 4px;font-size:11px;color:#bbb;text-align:center;vertical-align:middle;">地支</td>
        ${pillars.map(pl=>`<td style="padding:5px 2px;text-align:center;">${circle(pl.zhi, BZ_ZHI_ELEM[pl.zhi])}</td>`).join('')}
      </tr>
      <tr>
        <td style="padding:5px 4px;font-size:11px;color:#bbb;text-align:center;vertical-align:top;">藏干</td>
        ${pillars.map(pl=>`<td style="padding:5px 2px;text-align:center;line-height:1.6;">${hgLine(pl.hide)}</td>`).join('')}
      </tr>
      <tr style="border-top:1px solid #f5f0eb;">
        <td style="padding:6px 4px;font-size:11px;color:#bbb;text-align:center;vertical-align:middle;">纳音</td>
        ${pillars.map(pl=>`<td style="padding:6px 2px;text-align:center;font-size:11px;color:#666;">${pl.nayin}</td>`).join('')}
      </tr>
    </table>
  </div>

  <!-- Day master summary -->
  <div style="margin:16px 14px 0;background:#fff;border-radius:16px;padding:16px;box-shadow:0 1px 8px rgba(0,0,0,.06);">
    <div style="text-align:center;margin-bottom:10px;">
      <span style="font-size:16px;font-weight:600;font-family:'Noto Serif SC';color:${dmColor};">${p.dayGan}${dmElem}日主</span>
      <span style="font-size:14px;color:#888;font-family:'Noto Serif SC';"> · 【${strength}】</span>
    </div>
    <div style="text-align:center;font-size:13px;color:#888;">
      ${ec.getDayNaYin()} &nbsp;|&nbsp; ${zodiac} &nbsp;|&nbsp; ${age}岁
    </div>
    ${yunStartInfo ? `<div style="text-align:center;font-size:12px;color:#bbb;margin-top:4px;">${yunStartInfo}</div>` : ''}
  </div>

  <!-- Five element relation diagram -->
  ${bzMakeRelSVG(fePct)}

  <!-- 喜用忌用 -->
  ${bzMakeXiJi(dmElem, isStrong)}

  <!-- 大运流年 section -->
  <div style="margin:12px 14px 0;background:#fff;border-radius:16px;padding:16px 0 16px;box-shadow:0 1px 8px rgba(0,0,0,.06);">
    <div style="display:flex;justify-content:space-between;align-items:center;padding:0 16px;margin-bottom:10px;">
      <span style="font-size:15px;font-weight:600;color:#1a1a1a;font-family:'Noto Serif SC';">大运</span>
      <span id="bzDyStart" style="font-size:11px;color:#999;"></span>
    </div>
    <div id="bzDyRow"></div>
    <div style="padding:0 16px;margin:16px 0 10px;">
      <span style="font-size:15px;font-weight:600;color:#1a1a1a;font-family:'Noto Serif SC';">流年</span>
    </div>
    <div id="bzLnRow"></div>
  </div>

</div>`;
}

// ── 十神 helper ───────────────────────────────────────────────────
function bzGetSS(gan, dayGan) {
  const elem     = BZ_GAN_ELEM[gan];
  const dayElem  = BZ_GAN_ELEM[dayGan];
  if (!elem || !dayElem) return '';
  const ganArr  = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
  const ganYang = g => ganArr.indexOf(g) % 2 === 0;
  const sameYang = ganYang(gan) === ganYang(dayGan);
  const generates = {木:'火',火:'土',土:'金',金:'水',水:'木'};
  const controls  = {木:'土',土:'水',水:'火',火:'金',金:'木'};
  if (elem === dayElem) return sameYang ? '比肩' : '劫财';
  if (generates[dayElem] === elem) return sameYang ? '食神' : '伤官';
  if (controls[dayElem] === elem)  return sameYang ? '偏财' : '正财';
  if (controls[elem] === dayElem)  return sameYang ? '七杀' : '正官';
  if (generates[elem] === dayElem) return sameYang ? '偏印' : '正印';
  return '';
}

// ── Five element relation diagram SVG ────────────────────────────
function bzMakeRelSVG(fePct) {
  // Pentagon clockwise from top: 火,土,金,水,木
  const elems = ['火','土','金','水','木'];
  const eco = {火:'#a83535', 土:'#c47a2a', 金:'#c9a038', 水:'#2c8080', 木:'#4e9b72'};
  const W=300, H=278, cx=150, cy=143, R=100, cr=34;
  const ang = i => -Math.PI/2 + i * 2 * Math.PI / 5;
  const pts = elems.map((_,i) => [cx + R*Math.cos(ang(i)), cy + R*Math.sin(ang(i))]);

  function arrowPath(a, b) {
    const dx=b[0]-a[0], dy=b[1]-a[1], len=Math.sqrt(dx*dx+dy*dy);
    const ux=dx/len, uy=dy/len;
    return `M${(a[0]+ux*(cr+5)).toFixed(1)},${(a[1]+uy*(cr+5)).toFixed(1)} L${(b[0]-ux*(cr+9)).toFixed(1)},${(b[1]-uy*(cr+9)).toFixed(1)}`;
  }
  function midText(a, b, txt, perp) {
    const mx=(a[0]+b[0])/2, my=(a[1]+b[1])/2;
    const dx=b[0]-a[0], dy=b[1]-a[1], len=Math.sqrt(dx*dx+dy*dy);
    const ox=-dy/len*(perp||0), oy=dx/len*(perp||0);
    return `<text x="${(mx+ox).toFixed(1)}" y="${(my+oy+4).toFixed(1)}" text-anchor="middle" font-size="11" fill="#ccc">${txt}</text>`;
  }

  // 生 arrows: i→(i+1)%5
  const shengPaths = elems.map((_,i) => arrowPath(pts[i], pts[(i+1)%5]));
  const shengLabels = elems.map((_,i) => midText(pts[i], pts[(i+1)%5], '生', 9));
  // 克 arrows: 火→金(0→2), 土→水(1→3), 金→木(2→4), 水→火(3→0), 木→土(4→1)
  const keTarget = [2,3,4,0,1];
  const kePaths = elems.map((_,i) => arrowPath(pts[i], pts[keTarget[i]]));
  const keLabels = elems.map((_,i) => midText(pts[i], pts[keTarget[i]], '克', 7));

  const circles = elems.map((e,i) => {
    const [x,y]=pts[i], c=eco[e], pct=fePct[e]||0;
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${cr}" fill="${c}"/>
<text x="${x.toFixed(1)}" y="${(y-2).toFixed(1)}" text-anchor="middle" font-size="17" fill="white" font-family="Noto Serif SC,serif" font-weight="600">${e}</text>
<text x="${x.toFixed(1)}" y="${(y+14).toFixed(1)}" text-anchor="middle" font-size="10" fill="rgba(255,255,255,.9)">${pct}%</text>`;
  });

  return `<div style="margin:12px 14px 0;background:#fff;border-radius:16px;padding:16px;box-shadow:0 1px 8px rgba(0,0,0,.06);">
  <div style="font-size:13px;font-weight:600;color:#333;margin-bottom:4px;font-family:'Noto Serif SC';">五行分布</div>
  <div style="display:flex;justify-content:center;">
  <svg width="100%" viewBox="0 0 ${W} ${H}" style="max-width:${W}px;">
    <defs>
      <marker id="bzAS" markerWidth="7" markerHeight="7" refX="5.5" refY="3.5" orient="auto"><path d="M0,0.5 L6,3.5 L0,6.5 Z" fill="#ccc"/></marker>
      <marker id="bzAK" markerWidth="7" markerHeight="7" refX="5.5" refY="3.5" orient="auto"><path d="M0,0.5 L6,3.5 L0,6.5 Z" fill="#ddd"/></marker>
    </defs>
    ${shengPaths.map(d=>`<path d="${d}" stroke="#ccc" stroke-width="1.5" fill="none" marker-end="url(#bzAS)"/>`).join('')}
    ${shengLabels.join('')}
    ${kePaths.map(d=>`<path d="${d}" stroke="#e0e0e0" stroke-width="1.2" fill="none" marker-end="url(#bzAK)"/>`).join('')}
    ${keLabels.join('')}
    ${circles.join('')}
  </svg>
  </div>
</div>`;
}

// ── 喜用 / 忌用 ───────────────────────────────────────────────────
function bzMakeXiJi(dmElem, isStrong) {
  const genMe = {木:'水',火:'木',土:'火',金:'土',水:'金'}; // 生我(印)
  const ctlMe = {木:'金',火:'水',土:'木',金:'火',水:'土'}; // 克我(官杀)
  const myGen = {木:'火',火:'土',土:'金',金:'水',水:'木'}; // 我生(食伤)
  const myCtl = {木:'土',火:'金',土:'水',金:'木',水:'火'}; // 我克(财)
  const eco   = {火:'#a83535',土:'#c47a2a',金:'#c9a038',水:'#2c8080',木:'#4e9b72'};

  let xi, ji;
  if (!isStrong) {
    xi = [...new Set([genMe[dmElem], dmElem])];
    ji = [...new Set([ctlMe[dmElem], myGen[dmElem], myCtl[dmElem]])];
  } else {
    xi = [...new Set([ctlMe[dmElem], myGen[dmElem], myCtl[dmElem]])];
    ji = [...new Set([genMe[dmElem], dmElem])];
  }

  const spans = arr => arr.map(e=>`<span style="font-size:18px;font-family:'Noto Serif SC',serif;color:${eco[e]};margin:0 3px;">${e}</span>`).join('');

  return `<div style="margin:12px 14px 0;background:#fff;border-radius:16px;padding:20px 16px 24px;box-shadow:0 1px 8px rgba(0,0,0,.06);">
  <div style="text-align:center;margin-bottom:20px;line-height:2;">
    <div style="font-size:13px;color:#444;font-family:'Noto Serif SC',serif;">喜用成就顺境，忌用招致逆境。</div>
    <div style="font-size:13px;color:#444;font-family:'Noto Serif SC',serif;">你如何自处人生的起伏，便该如何看待五行的喜忌。</div>
    <div style="font-size:13px;color:#444;font-family:'Noto Serif SC',serif;">生命是一场完整的体验。</div>
    <div style="font-size:13px;color:#444;font-family:'Noto Serif SC',serif;">无喜不成欢，无忌不修心。</div>
  </div>
  <div style="display:flex;justify-content:space-around;align-items:flex-start;">
    <div style="display:flex;flex-direction:column;align-items:center;gap:14px;">
      <div style="width:56px;height:56px;border-radius:50%;border:1.5px solid #c0c0c0;display:flex;align-items:center;justify-content:center;">
        <span style="font-size:22px;font-family:'Noto Serif SC',serif;color:#555;">喜</span>
      </div>
      <div>${spans(xi)}</div>
    </div>
    <div style="display:flex;flex-direction:column;align-items:center;gap:14px;">
      <div style="width:56px;height:56px;border-radius:50%;border:1.5px solid #c0c0c0;display:flex;align-items:center;justify-content:center;">
        <span style="font-size:22px;font-family:'Noto Serif SC',serif;color:#555;">忌</span>
      </div>
      <div>${spans(ji)}</div>
    </div>
  </div>
</div>`;
}

// ── DaYun / LiuNian render ────────────────────────────────────────
function bzRenderDaYun(pOrId, activeIdx) {
  const p = (typeof pOrId === 'string') ? bzProfiles.find(x=>x.id===pOrId) : pOrId;
  if (!p) return;
  try {
    const solar = bzGetSolar(p);
    const lunar  = solar.getLunar();
    const ec     = lunar.getEightChar();
    const yun    = ec.getYun(p.gender==='male'?1:0);
    const daYun  = yun.getDaYun();
    const now    = new Date().getFullYear();

    let autoActive = 0;
    daYun.forEach((dy,i) => { if (dy.getStartYear()<=now && dy.getEndYear()>=now) autoActive=i; });
    if (activeIdx === undefined) activeIdx = autoActive;

    // 起运日期
    const startEl = document.getElementById('bzDyStart');
    if (startEl) {
      try {
        const ss = yun.getStartSolar();
        const totalM = (ss.getYear()-p.year)*12+(ss.getMonth()-(p.month||1));
        const ageStr = totalM<12 ? totalM+'月' : (totalM/12).toFixed(1)+'岁';
        startEl.textContent = `${ss.getYear()}年${ss.getMonth()}月${String(ss.getDay()).padStart(2,'0')}日（${ageStr}起运）`;
      } catch(e){}
    }

    // 十神 abbreviation
    const SS_MAP = {'比肩':'比','劫财':'劫','食神':'食','伤官':'伤','偏财':'才','正财':'财','七杀':'杀','正官':'官','偏印':'枭','正印':'印'};
    const sh = s => SS_MAP[s] || s;

    // Build one column <td>
    function col(gz, ageLabel, yr, isCur, isNow, onclickStr) {
      const bg = isCur ? '#fef6e8' : '';
      const dot = isNow ? `<div style="width:5px;height:5px;border-radius:50%;background:#c47a2a;margin:0 auto 2px;"></div>` : '';
      let body = '';
      if (gz) {
        const gan=gz[0], zhi=gz[1];
        const gC=BZ_ELEM_BG[BZ_GAN_ELEM[gan]||'']||'#888';
        const zC=BZ_ELEM_BG[BZ_ZHI_ELEM[zhi]||'']||'#888';
        const gSS=sh(bzGetSS(gan,p.dayGan));
        const hides=BZ_HIDE[zhi]||[];
        const mainSS=hides[0]?sh(bzGetSS(hides[0],p.dayGan)):'';
        const restRows=hides.slice(1).map(g=>{
          const c=BZ_ELEM_BG[BZ_GAN_ELEM[g]||'']||'#aaa';
          return `<div style="font-size:10px;color:${c};line-height:1.6;">${sh(bzGetSS(g,p.dayGan))}</div>`;
        }).join('');
        body = `<div style="display:flex;align-items:baseline;justify-content:center;gap:1px;padding:2px 0 1px;">
            <span style="font-size:20px;color:${gC};font-family:'Noto Serif SC',serif;line-height:1.1;">${gan}</span>
            <span style="font-size:10px;color:${gC};">${gSS}</span>
          </div>
          <div style="display:flex;align-items:baseline;justify-content:center;gap:1px;padding:1px 0;">
            <span style="font-size:20px;color:${zC};font-family:'Noto Serif SC',serif;line-height:1.1;">${zhi}</span>
            <span style="font-size:10px;color:${zC};">${mainSS}</span>
          </div>
          <div style="text-align:center;padding:2px 0 3px;">${restRows}</div>`;
      } else {
        body = `<div style="font-size:11px;color:#ccc;padding:6px 0 2px;">小运</div>`;
      }
      return `<td style="padding:0;background:${bg};min-width:66px;width:66px;border-right:1px solid #f0ece4;vertical-align:top;${onclickStr?'cursor:pointer;':''}" ${onclickStr?`onclick="${onclickStr}"`:''}>
        <div style="padding:6px 3px 2px;text-align:center;">${dot}
          <div style="font-size:10px;color:#bbb;line-height:1.4;">${ageLabel}</div>
          <div style="font-size:10px;color:#bbb;margin-bottom:2px;">${yr}</div>
          ${body}
        </div>
      </td>`;
    }

    // ── 大运 table ──────────────────────────────────────────────────
    const dyRow = document.getElementById('bzDyRow');
    if (dyRow) {
      const tds = daYun.map((dy,i) => {
        const gz=dy.getGanZhi(), sa=dy.getStartAge(), sy=dy.getStartYear();
        const isNow=sy<=now&&dy.getEndYear()>=now;
        const ageLabel=gz?sa+'岁':'&lt;6';
        return col(gz||null, ageLabel, sy, i===activeIdx, isNow, `bzRenderDaYun('${p.id}',${i})`);
      }).join('');
      dyRow.innerHTML=`<div class="bz-hscroll"><table style="border-collapse:collapse;white-space:nowrap;"><tr>${tds}</tr></table></div>`;
    }

    // ── 流年 table ──────────────────────────────────────────────────
    const lnRow = document.getElementById('bzLnRow');
    if (lnRow) {
      try {
        const liuNian = daYun[activeIdx].getLiuNian(10);
        const tds = liuNian.map(ln => {
          const gz=ln.getGanZhi(), yr=ln.getYear(), ag=ln.getAge();
          return col(gz, ag+'岁', yr, false, yr===now, null);
        }).join('');
        lnRow.innerHTML=`<div class="bz-hscroll"><table style="border-collapse:collapse;white-space:nowrap;"><tr>${tds}</tr></table></div>`;
      } catch(e){ lnRow.innerHTML=''; }
    }

  } catch(e){ console.warn('DaYun error:',e); }
}
