const SEERAPI_REST_BASE = 'https://api.seerapi.com/v1';
const SEERAPI_PAGE_SIZE = 200;
const SEERAPI_BATCH_DELAY_MS = 250;
const GOGGLE_PART_TYPE_ID = 1;
const BONUSES_CACHE_KEY = 'seer-bonuses-cache-v3';
const LEGACY_BONUS_CACHE_KEYS = ['seer-bonuses-cache-v1', 'seer-bonuses-cache-v2'];
const EMPTY_BONUS = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0, total: 0 };

function readAttrValues(attr) {
  if (!attr) return null;
  const values = {
    hp: Math.round(attr.hp || 0),
    atk: Math.round(attr.atk || 0),
    def: Math.round(attr.def || 0),
    spa: Math.round(attr.sp_atk || 0),
    spd: Math.round(attr.sp_def || 0),
    spe: Math.round(attr.spd || 0),
  };
  values.total = values.hp + values.atk + values.def + values.spa + values.spd + values.spe;
  return values;
}

function sumAttrValues(...parts) {
  const sum = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
  parts.forEach((part) => {
    if (!part) return;
    sum.hp += part.hp;
    sum.atk += part.atk;
    sum.def += part.def;
    sum.spa += part.spa;
    sum.spd += part.spd;
    sum.spe += part.spe;
  });
  sum.total = sum.hp + sum.atk + sum.def + sum.spa + sum.spd + sum.spe;
  if (sum.total <= 0) return null;
  return sum;
}

function mapApiAttr(attr) {
  const values = readAttrValues(attr);
  if (!values || values.total <= 0) return null;
  return values;
}

function transformMintmark(entry) {
  if (!entry?.name) return null;
  const attrs = sumAttrValues(
    readAttrValues(entry.max_attr_value),
    readAttrValues(entry.extra_attr_value)
  );
  if (!attrs) return null;
  return {
    id: entry.id,
    name: entry.name,
    desc: entry.desc || '',
    ...attrs,
  };
}

function parseEquipBonusDesc(desc) {
  if (!desc) return null;

  const patterns = [
    [/体力\+(\d+)/, 'hp'],
    [/(?:攻击|物攻)\+(\d+)/, 'atk'],
    [/防御\+(\d+)/, 'def'],
    [/特攻\+(\d+)/, 'spa'],
    [/特防\+(\d+)/, 'spd'],
    [/速度\+(\d+)/, 'spe'],
  ];

  const stats = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
  let matched = false;

  patterns.forEach(([re, key]) => {
    const m = desc.match(re);
    if (m) {
      stats[key] = Number(m[1]);
      matched = true;
    }
  });

  if (!matched) return null;
  stats.total = stats.hp + stats.atk + stats.def + stats.spa + stats.spd + stats.spe;
  return stats;
}

function formatGoggleDesc(attrs, fireRange = 0) {
  const labels = { hp: '体力', atk: '攻击', def: '防御', spa: '特攻', spd: '特防', spe: '速度' };
  const parts = [];

  ['hp', 'atk', 'def', 'spa', 'spd', 'spe'].forEach((key) => {
    if (attrs[key] > 0) parts.push(`${labels[key]}+${attrs[key]}`);
  });
  if (fireRange > 0) parts.push(`射程+${fireRange}`);

  return parts.join('，');
}

function transformGoggle(entry) {
  if (!entry?.name || entry.part_type?.id !== GOGGLE_PART_TYPE_ID) return null;

  const pk = entry.pk_attribute;
  const bonusAttr = readAttrValues(entry.bonus?.attribute);
  const bonusDesc = entry.bonus?.desc || '';
  const attrs = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
  const hasBackpackBonus = !!(bonusDesc || (bonusAttr && bonusAttr.total > 0));

  if (hasBackpackBonus) {
    const parsedDesc = parseEquipBonusDesc(bonusDesc);

    if (parsedDesc) {
      attrs.hp += parsedDesc.hp;
      attrs.atk += parsedDesc.atk;
      attrs.def += parsedDesc.def;
      attrs.spa += parsedDesc.spa;
      attrs.spd += parsedDesc.spd;
      attrs.spe += parsedDesc.spe;
    } else if (bonusAttr) {
      attrs.hp += bonusAttr.hp;
      attrs.atk += bonusAttr.atk;
      attrs.def += bonusAttr.def;
      attrs.spa += bonusAttr.spa;
      attrs.spd += bonusAttr.spd;
      attrs.spe += bonusAttr.spe;
    }
  } else if (pk) {
    attrs.hp += Math.round(pk.pk_hp || 0);
    attrs.atk += Math.round(pk.pk_atk || 0);
  }

  const total = attrs.hp + attrs.atk + attrs.def + attrs.spa + attrs.spd + attrs.spe;
  if (total <= 0) return null;

  const fireRange = !hasBackpackBonus ? Math.round(pk?.pk_fire_range || 0) : 0;

  return {
    id: entry.id,
    name: entry.name,
    desc: bonusDesc || formatGoggleDesc(attrs, fireRange),
    ...attrs,
    total,
  };
}

function transformSuit(entry) {
  if (!entry?.name) return null;
  const attrs = mapApiAttr(entry.bonus?.attribute);
  return {
    id: entry.id,
    name: entry.name,
    desc: entry.bonus?.desc || entry.suit_desc || '',
    hp: attrs?.hp || 0,
    atk: attrs?.atk || 0,
    def: attrs?.def || 0,
    spa: attrs?.spa || 0,
    spd: attrs?.spd || 0,
    spe: attrs?.spe || 0,
    total: attrs?.total || 0,
  };
}

function transformTitle(entry) {
  if (!entry?.name) return null;
  const attrs = mapApiAttr(entry.attr_bonus);
  if (!attrs) return null;
  return {
    id: entry.id,
    name: entry.name,
    desc: entry.ability_desc || entry.desc || '',
    ...attrs,
  };
}

function sortByIdDesc(a, b) {
  return b.id - a.id || String(a.name).localeCompare(String(b.name), 'zh-CN');
}

function buildBonusDataFromRaw(raw) {
  const mintmarkMap = new Map();

  Object.values(raw.mintmark || {}).forEach((entry) => {
    const item = transformMintmark(entry);
    if (item) mintmarkMap.set(item.id, item);
  });

  Object.values(raw.universal_mintmark || {}).forEach((entry) => {
    const item = transformMintmark(entry);
    if (item) mintmarkMap.set(item.id, item);
  });

  const mintmarks = [...mintmarkMap.values()].sort(sortByIdDesc);
  const suits = Object.values(raw.suit || {})
    .map(transformSuit)
    .filter(Boolean)
    .sort(sortByIdDesc);
  const titles = Object.values(raw.title || {})
    .map(transformTitle)
    .filter(Boolean)
    .sort((a, b) => b.total - a.total || String(a.name).localeCompare(String(b.name), 'zh-CN'));
  const goggles = Object.values(raw.equip || {})
    .map(transformGoggle)
    .filter(Boolean)
    .sort((a, b) => b.total - a.total || String(a.name).localeCompare(String(b.name), 'zh-CN'));

  return { mintmarks, suits, titles, goggles };
}

function listToIdMap(list) {
  const map = {};
  list.forEach((entry) => {
    if (entry?.id != null) map[entry.id] = entry;
  });
  return map;
}

async function fetchSeerApiJson(url, retries = 5) {
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const res = await fetch(url);
    const text = await res.text();
    if (res.ok && text && !text.trimStart().startsWith('<')) {
      try {
        return JSON.parse(text);
      } catch {
        /* fall through to retry */
      }
    }
    if (attempt === retries) {
      throw new Error(`请求失败: ${res.status}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)));
  }
  throw new Error(`请求失败: ${url}`);
}

async function fetchResourceMeta(resource) {
  const data = await fetchSeerApiJson(`${SEERAPI_REST_BASE}/${resource}?limit=1`);
  return { count: data.count || 0, hash: data.hash || '' };
}

async function fetchAllResourceDetails(resource, count) {
  const ids = [];

  for (let offset = 0; offset < count; offset += SEERAPI_PAGE_SIZE) {
    const limit = Math.min(SEERAPI_PAGE_SIZE, count - offset);
    const page = await fetchSeerApiJson(
      `${SEERAPI_REST_BASE}/${resource}?offset=${offset}&limit=${limit}`
    );
    ids.push(...(page.results || []).map((item) => item.id));
  }

  const details = [];
  for (let i = 0; i < ids.length; i += 1) {
    details.push(await fetchSeerApiJson(`${SEERAPI_REST_BASE}/${resource}/${ids[i]}`));
    if (i + 1 < ids.length) {
      await new Promise((resolve) => setTimeout(resolve, SEERAPI_BATCH_DELAY_MS));
    }
  }

  return details;
}

async function fetchBonusMetaHashes() {
  const [mintmark, universal_mintmark, suit, title, equip] = await Promise.all([
    fetchResourceMeta('mintmark'),
    fetchResourceMeta('universal_mintmark'),
    fetchResourceMeta('suit'),
    fetchResourceMeta('title'),
    fetchResourceMeta('equip'),
  ]);

  return {
    mintmark: mintmark.hash,
    universal_mintmark: universal_mintmark.hash,
    suit: suit.hash,
    title: title.hash,
    equip: equip.hash,
  };
}

function bonusHashesChanged(cachedHashes, remoteHashes) {
  if (!cachedHashes) return true;
  return Object.keys(remoteHashes).some((key) => cachedHashes[key] !== remoteHashes[key]);
}

async function fetchBonusDataFromApi() {
  const [mintmarkMeta, universalMeta, suitMeta, titleMeta, equipMeta] = await Promise.all([
    fetchResourceMeta('mintmark'),
    fetchResourceMeta('universal_mintmark'),
    fetchResourceMeta('suit'),
    fetchResourceMeta('title'),
    fetchResourceMeta('equip'),
  ]);

  const mintmark = await fetchAllResourceDetails('mintmark', mintmarkMeta.count);
  const universal_mintmark = await fetchAllResourceDetails('universal_mintmark', universalMeta.count);
  const suit = await fetchAllResourceDetails('suit', suitMeta.count);
  const title = await fetchAllResourceDetails('title', titleMeta.count);
  const equip = await fetchAllResourceDetails('equip', equipMeta.count);

  const data = buildBonusDataFromRaw({
    mintmark: listToIdMap(mintmark),
    universal_mintmark: listToIdMap(universal_mintmark),
    suit: listToIdMap(suit),
    title: listToIdMap(title),
    equip: listToIdMap(equip),
  });

  return {
    data,
    hashes: {
      mintmark: mintmarkMeta.hash,
      universal_mintmark: universalMeta.hash,
      suit: suitMeta.hash,
      title: titleMeta.hash,
      equip: equipMeta.hash,
    },
  };
}

function getBundledBonusData() {
  return {
    mintmarks: window.MINTMARKS_LIST || [],
    suits: window.SUITS_LIST || [],
    titles: window.TITLES_LIST || [],
    goggles: window.GOGGLES_LIST || [],
  };
}

function setBonusLists(data) {
  window.MINTMARKS_LIST = data.mintmarks || [];
  window.SUITS_LIST = data.suits || [];
  window.TITLES_LIST = data.titles || [];
  window.GOGGLES_LIST = data.goggles || [];

  if (window.BONUSES_META) {
    window.BONUSES_META.mintmarks = window.MINTMARKS_LIST.length;
    window.BONUSES_META.suits = window.SUITS_LIST.length;
    window.BONUSES_META.suitsWithBonus = window.SUITS_LIST.filter((s) => s.total > 0).length;
    window.BONUSES_META.titles = window.TITLES_LIST.length;
    window.BONUSES_META.goggles = window.GOGGLES_LIST.length;
    window.BONUSES_META.updated = new Date().toISOString().slice(0, 10);
    window.BONUSES_META.source = 'SeerAPI';
  }
}

function getBonusCounts(data) {
  return {
    mintmarks: data.mintmarks?.length || 0,
    suits: data.suits?.length || 0,
    titles: data.titles?.length || 0,
    goggles: data.goggles?.length || 0,
  };
}

function getBonusDataRevision() {
  return window.BONUSES_META?.dataRevision ?? 1;
}

function cacheIsNewerThanBundled(cache, bundled) {
  if (cache.dataRevision !== getBonusDataRevision()) return false;

  const cacheCounts = getBonusCounts(cache);
  const bundledCounts = getBonusCounts(bundled);
  return (
    cacheCounts.mintmarks >= bundledCounts.mintmarks &&
    cacheCounts.suits >= bundledCounts.suits &&
    cacheCounts.titles >= bundledCounts.titles &&
    cacheCounts.goggles >= bundledCounts.goggles
  );
}

function clearLegacyBonusCaches() {
  try {
    LEGACY_BONUS_CACHE_KEYS.forEach((key) => localStorage.removeItem(key));
  } catch {
    // ignore
  }
}

function saveBonusesCache(data, hashes = null) {
  try {
    localStorage.setItem(
      BONUSES_CACHE_KEY,
      JSON.stringify({
        syncedAt: new Date().toISOString(),
        dataRevision: getBonusDataRevision(),
        hashes,
        ...data,
      })
    );
  } catch {
    // localStorage 可能已满，忽略
  }
}

function loadBonusesCache() {
  try {
    const raw = localStorage.getItem(BONUSES_CACHE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!Array.isArray(data.mintmarks)) return null;
    if (data.dataRevision !== getBonusDataRevision()) return null;
    return data;
  } catch {
    return null;
  }
}

function getCurrentBonusData() {
  return {
    mintmarks: getMintmarksList(),
    suits: getSuitsList(),
    titles: getTitlesList(),
    goggles: getGogglesList(),
  };
}

function getTitlesList() {
  return window.TITLES_LIST || [];
}

function getSuitsList() {
  return window.SUITS_LIST || [];
}

function getMintmarksList() {
  return window.MINTMARKS_LIST || [];
}

function getGogglesList() {
  return window.GOGGLES_LIST || [];
}

function itemToBonus(item) {
  if (!item) return { ...EMPTY_BONUS };
  return {
    hp: item.hp || 0,
    atk: item.atk || 0,
    def: item.def || 0,
    spa: item.spa || 0,
    spd: item.spd || 0,
    spe: item.spe || 0,
    total: item.total || 0,
  };
}

function sumBonuses(bonusList) {
  const sum = { ...EMPTY_BONUS };
  bonusList.forEach((bonus) => {
    STAT_KEYS.forEach((key) => {
      sum[key] += bonus[key] || 0;
    });
  });
  sum.total = STAT_KEYS.reduce((n, key) => n + sum[key], 0);
  return sum;
}

function formatBonusShort(item) {
  if (!item || !item.total) return '无加成';
  const parts = STAT_KEYS.filter((key) => item[key] > 0).map(
    (key) => `${STAT_LABELS[key]}+${item[key]}`
  );
  return parts.join(' ') || '无加成';
}
