async function fetchBonusJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`请求失败: ${res.status}`);
  return res.json();
}

async function fetchBonusDataFromBulk() {
  const [mintmark, universal_mintmark, suit, title, equip] = await Promise.all([
    fetchBonusJson(BONUS_BULK_URLS.mintmark),
    fetchBonusJson(BONUS_BULK_URLS.universal_mintmark),
    fetchBonusJson(BONUS_BULK_URLS.suit),
    fetchBonusJson(BONUS_BULK_URLS.title),
    fetchBonusJson(BONUS_BULK_URLS.equip),
  ]);

  return buildBonusDataFromRaw({ mintmark, universal_mintmark, suit, title, equip });
}

async function checkAndSyncBonuses() {
  const bundled = getBundledBonusData();
  const cached = loadBonusesCache();

  if (cached && cacheIsNewerThanBundled(cached, bundled)) {
    setBonusLists(cached);
  } else {
    setBonusLists(bundled);
  }

  try {
    const remote = await fetchBonusDataFromBulk();
    setBonusLists(remote);
    saveBonusesCache(remote);
  } catch (err) {
    console.warn('加成数据同步失败，使用本地缓存:', err);
    saveBonusesCache({
      mintmarks: getMintmarksList(),
      suits: getSuitsList(),
      titles: getTitlesList(),
      goggles: getGogglesList(),
    });
  }
}

async function initBonusData() {
  await checkAndSyncBonuses();
  window.dispatchEvent(new CustomEvent('bonuses-ready'));
}

initBonusData();
