const BONUS_BULK_URLS = {
  mintmark:
    'https://raw.githubusercontent.com/SeerAPI/api-data/main/data/v1/merged_data/mintmark/id.json',
  universal_mintmark:
    'https://raw.githubusercontent.com/SeerAPI/api-data/main/data/v1/merged_data/universal_mintmark/id.json',
  suit: 'https://raw.githubusercontent.com/SeerAPI/api-data/main/data/v1/merged_data/suit/id.json',
  title: 'https://raw.githubusercontent.com/SeerAPI/api-data/main/data/v1/merged_data/title/id.json',
  equip: 'https://raw.githubusercontent.com/SeerAPI/api-data/main/data/v1/merged_data/equip/id.json',
};

const GOGGLE_PART_TYPE_ID = 1;
const BONUSES_CACHE_KEY = 'seer-bonuses-cache-v1';
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

function transformGoggle(entry) {
  if (!entry?.name || entry.part_type?.id !== GOGGLE_PART_TYPE_ID) return null;
  const pk = entry.pk_attribute;
  if (!pk) return null;

  const hp = Math.round(pk.pk_hp || 0);
  const atk = Math.round(pk.pk_atk || 0);
  const fireRange = Math.round(pk.pk_fire_range || 0);
  if (hp + atk <= 0) return null;

  const descParts = [];
  if (hp) descParts.push(`体力+${hp}`);
  if (atk) descParts.push(`攻击+${atk}`);
  if (fireRange) descParts.push(`射程+${fireRange}`);

  return {
    id: entry.id,
    name: entry.name,
    desc: descParts.join('，'),
    hp,
    atk,
    def: 0,
    spa: 0,
    spd: 0,
    spe: 0,
    total: hp + atk,
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

function cacheIsNewerThanBundled(cache, bundled) {
  const cacheCounts = getBonusCounts(cache);
  const bundledCounts = getBonusCounts(bundled);
  return (
    cacheCounts.mintmarks >= bundledCounts.mintmarks &&
    cacheCounts.suits >= bundledCounts.suits &&
    cacheCounts.titles >= bundledCounts.titles &&
    cacheCounts.goggles >= bundledCounts.goggles
  );
}

function saveBonusesCache(data) {
  try {
    localStorage.setItem(
      BONUSES_CACHE_KEY,
      JSON.stringify({
        syncedAt: new Date().toISOString(),
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
    return data;
  } catch {
    return null;
  }
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
