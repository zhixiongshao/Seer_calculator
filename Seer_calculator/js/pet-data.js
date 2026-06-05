const SEERAPI_BASE = 'https://api.seerapi.com/v1';
const SEERAPI_BULK_URL =
  'https://raw.githubusercontent.com/SeerAPI/api-data/main/data/v1/merged_data/pet/id.json';
const PETS_CACHE_KEY = 'seer-pets-cache-v1';

function transformPetFromApi(detail) {
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

function transformPetFromBulk(entry) {
  return transformPetFromApi(entry);
}

function sortPets(pets) {
  return pets.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN') || a.id - b.id);
}

function setPetsList(pets) {
  window.PETS_LIST = sortPets(pets);
  if (window.PETS_META) {
    window.PETS_META.count = window.PETS_LIST.length;
  }
}

function savePetsCache(pets) {
  try {
    localStorage.setItem(
      PETS_CACHE_KEY,
      JSON.stringify({
        count: pets.length,
        syncedAt: new Date().toISOString(),
        pets,
      })
    );
  } catch {
    // localStorage 可能已满，忽略
  }
}

function loadPetsCache() {
  try {
    const raw = localStorage.getItem(PETS_CACHE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!Array.isArray(data.pets) || !data.pets.length) return null;
    return data;
  } catch {
    return null;
  }
}
