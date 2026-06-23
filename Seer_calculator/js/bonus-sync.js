function getChangedBonusResources(referenceHashes, remoteHashes) {
  const keys = ['mintmark', 'universal_mintmark', 'suit', 'title', 'equip'];
  if (!referenceHashes) return keys;
  return keys.filter((key) => referenceHashes[key] !== remoteHashes[key]);
}

async function checkAndSyncBonuses() {
  clearLegacyBonusCaches();

  const bundled = getBundledBonusData();
  const cached = loadBonusesCache();

  if (cached && cacheIsNewerThanBundled(cached, bundled)) {
    setBonusLists(cached);
  } else {
    setBonusLists(bundled);
  }

  try {
    const remoteHashes = await fetchBonusMetaHashes();
    const referenceHashes = cached?.hashes || window.BONUSES_META?.hashes || null;
    const changed = getChangedBonusResources(referenceHashes, remoteHashes);
    const revisionMismatch = cached?.dataRevision !== getBonusDataRevision();

    if (revisionMismatch && !changed.includes('equip')) {
      changed.push('equip');
    }

    if (!changed.length) {
      saveBonusesCache(getCurrentBonusData(), remoteHashes);
      return;
    }

    let mintmarks = getMintmarksList();
    let suits = getSuitsList();
    let titles = getTitlesList();
    let goggles = getGogglesList();

    if (changed.includes('mintmark')) {
      const meta = await fetchResourceMeta('mintmark');
      const list = await fetchAllResourceDetails('mintmark', meta.count);
      const map = new Map(mintmarks.map((item) => [item.id, item]));
      list.forEach((entry) => {
        const item = transformMintmark(entry);
        if (item) map.set(item.id, item);
      });
      mintmarks = [...map.values()].sort(sortByIdDesc);
    }

    if (changed.includes('universal_mintmark')) {
      const meta = await fetchResourceMeta('universal_mintmark');
      const list = await fetchAllResourceDetails('universal_mintmark', meta.count);
      const map = new Map(mintmarks.map((item) => [item.id, item]));
      list.forEach((entry) => {
        const item = transformMintmark(entry);
        if (item) map.set(item.id, item);
      });
      mintmarks = [...map.values()].sort(sortByIdDesc);
    }

    if (changed.includes('suit')) {
      const meta = await fetchResourceMeta('suit');
      const list = await fetchAllResourceDetails('suit', meta.count);
      suits = list.map(transformSuit).filter(Boolean).sort(sortByIdDesc);
    }

    if (changed.includes('title')) {
      const meta = await fetchResourceMeta('title');
      const list = await fetchAllResourceDetails('title', meta.count);
      titles = list
        .map(transformTitle)
        .filter(Boolean)
        .sort((a, b) => b.total - a.total || String(a.name).localeCompare(String(b.name), 'zh-CN'));
    }

    if (changed.includes('equip')) {
      const meta = await fetchResourceMeta('equip');
      const list = await fetchAllResourceDetails('equip', meta.count);
      goggles = list
        .map(transformGoggle)
        .filter(Boolean)
        .sort((a, b) => b.total - a.total || String(a.name).localeCompare(String(b.name), 'zh-CN'));
    }

    const data = { mintmarks, suits, titles, goggles };
    setBonusLists(data);
    saveBonusesCache(data, remoteHashes);
  } catch (err) {
    console.warn('加成数据同步失败，使用本地缓存:', err);
    saveBonusesCache(getCurrentBonusData(), cached?.hashes || window.BONUSES_META?.hashes || null);
  }
}

async function initBonusData() {
  await checkAndSyncBonuses();
  window.dispatchEvent(new CustomEvent('bonuses-ready'));
}

initBonusData();
