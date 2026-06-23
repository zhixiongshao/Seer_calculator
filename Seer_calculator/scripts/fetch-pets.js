#!/usr/bin/env node
/**
 * 从 SeerAPI 同步全量精灵种族值
 * - 在线 API: https://api.seerapi.com
 * - 备用全量: https://github.com/SeerAPI/api-data
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.join(__dirname, '..');
const JSON_OUT = path.join(ROOT, 'data', 'pets.json');
const JS_OUT = path.join(ROOT, 'data', 'pets.js');
const META_OUT = path.join(ROOT, 'data', 'pets-meta.js');

const SEERAPI_BASE = 'https://api.seerapi.com/v1';
const BULK_URL =
  'https://raw.githubusercontent.com/SeerAPI/api-data/main/data/v1/merged_data/pet/id.json';

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

function transformPet(detail) {
  const stats = detail.base_stats;
  if (!detail.name || !stats) return null;

  const hp = Math.round(stats.hp || 0);
  const atk = Math.round(stats.atk || 0);
  const def = Math.round(stats.def || 0);
  const spa = Math.round(stats.sp_atk || 0);
  const spd = Math.round(stats.sp_def || 0);
  const spe = Math.round(stats.spd || 0);

  if (hp + atk + def + spa + spd + spe <= 0) return null;

  return { id: detail.id, name: detail.name, hp, atk, def, spa, spd, spe };
}

async function fetchFromBulk() {
  console.log('正在从 SeerAPI 全量数据下载…');
  const raw = JSON.parse(await fetchText(BULK_URL));
  const pets = [];

  Object.values(raw).forEach((entry) => {
    const pet = transformPet(entry);
    if (pet) pets.push(pet);
  });

  return pets;
}

async function fetchRemoteCount() {
  try {
    const raw = await fetchText(`${SEERAPI_BASE}/pet?limit=1`);
    return JSON.parse(raw).count;
  } catch (err) {
    console.warn(`API 不可用，将使用全量数据文件: ${err.message}`);
    return null;
  }
}

async function main() {
  const pets = await fetchFromBulk();
  const remoteCount = (await fetchRemoteCount()) ?? pets.length;
  console.log(`SeerAPI 精灵数量: ${remoteCount}`);
  pets.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN') || a.id - b.id);

  const meta = {
    count: pets.length,
    remoteCount,
    updated: new Date().toISOString().slice(0, 10),
    source: 'SeerAPI',
    api: SEERAPI_BASE,
  };

  fs.mkdirSync(path.dirname(JSON_OUT), { recursive: true });
  fs.writeFileSync(JSON_OUT, JSON.stringify(pets));
  fs.writeFileSync(JS_OUT, `window.PETS_LIST=${JSON.stringify(pets)};`);
  fs.writeFileSync(META_OUT, `window.PETS_META=${JSON.stringify(meta)};`);

  console.log(`已写入 ${pets.length} 只精灵`);
  console.log(`→ ${JSON_OUT}`);
  console.log(`→ ${JS_OUT}`);
  console.log(`→ ${META_OUT}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
