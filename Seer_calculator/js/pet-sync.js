const petSyncStatus = document.getElementById('pet-sync-status');

function setSyncStatus(text, type = '') {
  if (!petSyncStatus) return;
  petSyncStatus.textContent = text;
  petSyncStatus.className = `pet-sync-status${type ? ` is-${type}` : ''}`;
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`请求失败: ${res.status}`);
  return res.json();
}

async function fetchRemotePetCount() {
  const data = await fetchJson(`${SEERAPI_BASE}/pet?limit=1`);
  return data.count || 0;
}

const SEERAPI_PET_PAGE_SIZE = 200;
const SEERAPI_PET_PAGE_DELAY_MS = 100;

async function fetchRemotePetList() {
  const count = await fetchRemotePetCount();
  const results = [];

  for (let offset = 0; offset < count; offset += SEERAPI_PET_PAGE_SIZE) {
    const limit = Math.min(SEERAPI_PET_PAGE_SIZE, count - offset);
    const data = await fetchJson(
      `${SEERAPI_BASE}/pet?offset=${offset}&limit=${limit}&expand=true`
    );
    results.push(...(data.results || []));
    if (offset + limit < count) {
      await new Promise((resolve) => setTimeout(resolve, SEERAPI_PET_PAGE_DELAY_MS));
    }
  }

  return results;
}

async function fullSyncFromBulk() {
  const raw = await fetchJson(SEERAPI_BULK_URL);
  const pets = [];

  Object.values(raw).forEach((entry) => {
    const pet = transformPetFromBulk(entry);
    if (pet) pets.push(pet);
  });

  return sortPets(pets);
}

async function incrementalSync(localPets, remoteList) {
  const localIds = new Set(localPets.map((p) => p.id));
  const missing = remoteList.filter((p) => !localIds.has(p.id));
  if (!missing.length) return localPets;

  const added = missing
    .map((entry) => transformPetFromApi(entry))
    .filter(Boolean);

  return sortPets([...localPets, ...added]);
}

async function syncWithApi(localCount) {
  const remoteCount = await fetchRemotePetCount();
  if (remoteCount <= localCount) return null;

  setSyncStatus('发现新精灵，同步中…', 'loading');
  const remoteList = await fetchRemotePetList();
  const missingRatio = (remoteCount - localCount) / remoteCount;

  if (localCount === 0 || missingRatio > 0.25) {
    return fullSyncFromBulk();
  }
  return incrementalSync(getPetsList(), remoteList);
}

async function syncWithBulkFallback(localCount) {
  setSyncStatus('从全量数据同步…', 'loading');
  const pets = await fullSyncFromBulk();
  if (pets.length <= localCount) return null;
  return pets;
}

function applySyncedPets(pets, updated = false) {
  setPetsList(pets);
  savePetsCache(pets);

  if (window.PETS_META) {
    window.PETS_META.count = pets.length;
    window.PETS_META.updated = new Date().toISOString().slice(0, 10);
    window.PETS_META.source = 'SeerAPI';
  }

  setSyncStatus(
    updated ? `${pets.length} 只精灵 · 已更新` : `${pets.length} 只精灵`,
    updated ? 'ok' : ''
  );
}

async function checkAndSyncPets() {
  const bundled = window.PETS_LIST || [];
  const cached = loadPetsCache();

  if (cached && cached.count >= bundled.length) {
    setPetsList(cached.pets);
  } else if (bundled.length) {
    setPetsList(bundled);
  }

  const localCount = getPetsList().length;

  try {
    setSyncStatus('检查更新…');
    let pets = await syncWithApi(localCount);

    if (!pets) {
      setSyncStatus(`${localCount} 只精灵`);
      savePetsCache(getPetsList());
      return;
    }

    applySyncedPets(pets, true);
  } catch (apiErr) {
    console.warn('API 同步失败，尝试全量数据:', apiErr);

    try {
      const pets = await syncWithBulkFallback(localCount);
      if (pets) {
        applySyncedPets(pets, true);
        return;
      }

      setSyncStatus(`${localCount} 只精灵`);
      savePetsCache(getPetsList());
    } catch (bulkErr) {
      if (localCount) {
        setSyncStatus(`${localCount} 只精灵 · 离线`, 'warn');
      } else {
        setSyncStatus('精灵数据加载失败', 'error');
      }
      console.warn('精灵数据同步失败:', bulkErr);
    }
  }
}

function getPetsList() {
  return window.PETS_LIST || [];
}

async function initPetData() {
  await checkAndSyncPets();
  window.dispatchEvent(new CustomEvent('pets-ready'));
}

initPetData();
