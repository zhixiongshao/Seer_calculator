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
};

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

function mapApiAttr(attr) {
  if (!attr) return null;
  const hp = Math.round(attr.hp || 0);
  const atk = Math.round(attr.atk || 0);
  const def = Math.round(attr.def || 0);
  const spa = Math.round(attr.sp_atk || 0);
  const spd = Math.round(attr.sp_def || 0);
  const spe = Math.round(attr.spd || 0);
  const total = hp + atk + def + spa + spd + spe;
  if (total <= 0) return null;
  return { hp, atk, def, spa, spd, spe, total };
}

function transformMintmark(entry) {
  if (!entry?.name) return null;
  const attrs = mapApiAttr(entry.max_attr_value);
  if (!attrs) return null;
  return {
    id: entry.id,
    name: entry.name,
    desc: entry.desc || '',
    ...attrs,
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

  const [mintmarkRaw, universalRaw, suitRaw, titleRaw] = await Promise.all([
    fetchText(BULK.mintmark),
    fetchText(BULK.universal_mintmark),
    fetchText(BULK.suit),
    fetchText(BULK.title),
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

  const meta = {
    mintmarks: mintmarks.length,
    suits: suits.length,
    suitsWithBonus: suits.filter((s) => s.total > 0).length,
    titles: titles.length,
    updated: new Date().toISOString().slice(0, 10),
    source: 'SeerAPI',
  };

  fs.mkdirSync(DATA_DIR, { recursive: true });
  writeList('mintmarks', mintmarks);
  writeList('suits', suits);
  writeList('titles', titles);
  fs.writeFileSync(path.join(DATA_DIR, 'bonuses-meta.js'), `window.BONUSES_META=${JSON.stringify(meta)};`);

  console.log(`刻印 ${mintmarks.length} · 套装 ${suits.length}（${meta.suitsWithBonus} 有加成）· 称号 ${titles.length}`);
  console.log(`→ ${DATA_DIR}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
