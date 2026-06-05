#!/usr/bin/env node
/**
 * 从 SeerAPI 全量数据同步称号、刻印、套装加成
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');

const BULK = {
  mintmark:
    'https://raw.githubusercontent.com/SeerAPI/api-data/main/data/v1/merged_data/mintmark/id.json',
  universal_mintmark:
    'https://raw.githubusercontent.com/SeerAPI/api-data/main/data/v1/merged_data/universal_mintmark/id.json',
  suit: 'https://raw.githubusercontent.com/SeerAPI/api-data/main/data/v1/merged_data/suit/id.json',
  title: 'https://raw.githubusercontent.com/SeerAPI/api-data/main/data/v1/merged_data/title/id.json',
  equip: 'https://raw.githubusercontent.com/SeerAPI/api-data/main/data/v1/merged_data/equip/id.json',
};

const GOGGLE_PART_TYPE_ID = 1;

function fetchText(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          fetchText(res.headers.location).then(resolve).catch(reject);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} ${url}`));
          return;
        }
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => resolve(data));
      })
      .on('error', reject);
  });
}

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
  const attrs = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };

  if (pk) {
    attrs.hp += Math.round(pk.pk_hp || 0);
    attrs.atk += Math.round(pk.pk_atk || 0);
  }

  const parsedDesc = !pk ? parseEquipBonusDesc(entry.bonus?.desc) : null;

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

  const total = attrs.hp + attrs.atk + attrs.def + attrs.spa + attrs.spd + attrs.spe;
  if (total <= 0) return null;

  const fireRange = Math.round(pk?.pk_fire_range || 0);

  return {
    id: entry.id,
    name: entry.name,
    desc: entry.bonus?.desc || formatGoggleDesc(attrs, fireRange),
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

function writeList(name, list) {
  const jsonPath = path.join(DATA_DIR, `${name}.json`);
  const jsPath = path.join(DATA_DIR, `${name}.js`);
  fs.writeFileSync(jsonPath, JSON.stringify(list));
  fs.writeFileSync(jsPath, `window.${name.toUpperCase()}_LIST=${JSON.stringify(list)};`);
  return jsPath;
}

async function main() {
  console.log('正在下载 SeerAPI 加成数据…');

  const [mintmarkRaw, universalRaw, suitRaw, titleRaw, equipRaw] = await Promise.all([
    fetchText(BULK.mintmark),
    fetchText(BULK.universal_mintmark),
    fetchText(BULK.suit),
    fetchText(BULK.title),
    fetchText(BULK.equip),
  ]);

  const mintmarkMap = new Map();

  Object.values(JSON.parse(mintmarkRaw)).forEach((entry) => {
    const item = transformMintmark(entry);
    if (item) mintmarkMap.set(item.id, item);
  });

  Object.values(JSON.parse(universalRaw)).forEach((entry) => {
    const item = transformMintmark(entry);
    if (item) mintmarkMap.set(item.id, item);
  });

  const byIdDesc = (a, b) => b.id - a.id || String(a.name).localeCompare(String(b.name), 'zh-CN');

  const mintmarks = [...mintmarkMap.values()].sort(byIdDesc);

  const suits = Object.values(JSON.parse(suitRaw))
    .map(transformSuit)
    .filter(Boolean)
    .sort(byIdDesc);

  const titles = Object.values(JSON.parse(titleRaw))
    .map(transformTitle)
    .filter(Boolean)
    .sort((a, b) => b.total - a.total || String(a.name).localeCompare(String(b.name), 'zh-CN'));

  const goggles = Object.values(JSON.parse(equipRaw))
    .map(transformGoggle)
    .filter(Boolean)
    .sort((a, b) => b.total - a.total || String(a.name).localeCompare(String(b.name), 'zh-CN'));

  const meta = {
    mintmarks: mintmarks.length,
    suits: suits.length,
    suitsWithBonus: suits.filter((s) => s.total > 0).length,
    titles: titles.length,
    goggles: goggles.length,
    updated: new Date().toISOString().slice(0, 10),
    source: 'SeerAPI',
  };

  fs.mkdirSync(DATA_DIR, { recursive: true });
  writeList('mintmarks', mintmarks);
  writeList('suits', suits);
  writeList('titles', titles);
  writeList('goggles', goggles);
  fs.writeFileSync(path.join(DATA_DIR, 'bonuses-meta.js'), `window.BONUSES_META=${JSON.stringify(meta)};`);

  console.log(
    `刻印 ${mintmarks.length} · 套装 ${suits.length}（${meta.suitsWithBonus} 有加成）· 称号 ${titles.length} · 护目镜 ${goggles.length}`
  );
  console.log(`→ ${DATA_DIR}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
