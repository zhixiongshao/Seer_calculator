const petSearchInput = document.getElementById('pet-search');
const petDropdown = document.getElementById('pet-dropdown');
const petPicker = document.getElementById('pet-picker');

let selectedPet = null;
let activeIndex = -1;
let pickerReady = false;

const ITEM_HEIGHT = 32;
const VIRTUAL_BUFFER = 6;

let petsByIdDescCache = null;

function formatPetLabel(pet) {
  return `${pet.id} ${pet.name}`;
}

function sortPetsByIdDesc(pets) {
  return pets.sort((a, b) => b.id - a.id);
}

function getPetsByIdDesc() {
  const list = getPetsList();
  if (!petsByIdDescCache || petsByIdDescCache.length !== list.length) {
    petsByIdDescCache = sortPetsByIdDesc([...list]);
  }
  return petsByIdDescCache;
}

function invalidatePetSortCache() {
  petsByIdDescCache = null;
}

function matchesPet(pet, q) {
  if (pet.name.toLowerCase().includes(q)) return true;
  if (/^\d+$/.test(q) && String(pet.id).includes(q)) return true;
  return false;
}

function searchPets(query) {
  const q = query.trim().toLowerCase();
  if (!q) return getPetsByIdDesc();

  const results = getPetsList().filter((pet) => matchesPet(pet, q));
  return sortPetsByIdDesc(results);
}

function applyPetBases(pet) {
  const map = { hp: pet.hp, atk: pet.atk, def: pet.def, spa: pet.spa, spd: pet.spd, spe: pet.spe };
  Object.entries(map).forEach(([key, value]) => {
    const input = document.querySelector(`.base-input[data-key="${key}"]`);
    if (input) input.value = value;
  });
  updateSummaries();
  renderResults();
}

function selectPet(pet) {
  selectedPet = pet;
  petSearchInput.value = formatPetLabel(pet);
  hideDropdown();
  applyPetBases(pet);
}

function hideDropdown() {
  petDropdown.hidden = true;
  activeIndex = -1;
}

function buildOptionHtml(pet, index) {
  return `
    <li>
      <button type="button" class="pet-option${index === activeIndex ? ' is-active' : ''}" data-index="${index}">
        <span class="pet-option-main">
          <span class="pet-option-id">${pet.id}</span>
          <span class="pet-option-name">${pet.name}</span>
        </span>
        <span class="pet-option-stats">${pet.hp}/${pet.atk}/${pet.def}/${pet.spa}/${pet.spd}/${pet.spe}</span>
      </button>
    </li>
  `;
}

function scrollActiveIntoView() {
  if (activeIndex < 0) return;
  const viewHeight = petDropdown.clientHeight;
  const itemTop = activeIndex * ITEM_HEIGHT;
  const itemBottom = itemTop + ITEM_HEIGHT;
  const scrollTop = petDropdown.scrollTop;

  if (itemTop < scrollTop) {
    petDropdown.scrollTop = itemTop;
  } else if (itemBottom > scrollTop + viewHeight) {
    petDropdown.scrollTop = itemBottom - viewHeight;
  }
}

function renderVirtualWindow() {
  const items = petDropdown._items || [];
  if (!items.length) {
    petDropdown.innerHTML = '<li class="pet-empty">未找到匹配精灵</li>';
    return;
  }

  const scrollTop = petDropdown.scrollTop;
  const viewHeight = petDropdown.clientHeight || 360;
  const start = Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - VIRTUAL_BUFFER);
  const end = Math.min(
    items.length,
    Math.ceil((scrollTop + viewHeight) / ITEM_HEIGHT) + VIRTUAL_BUFFER
  );

  const topH = start * ITEM_HEIGHT;
  const bottomH = (items.length - end) * ITEM_HEIGHT;

  const parts = [];
  if (topH) {
    parts.push(`<li class="pet-dropdown-spacer" style="height:${topH}px" aria-hidden="true"></li>`);
  }
  for (let i = start; i < end; i++) {
    parts.push(buildOptionHtml(items[i], i));
  }
  if (bottomH) {
    parts.push(`<li class="pet-dropdown-spacer" style="height:${bottomH}px" aria-hidden="true"></li>`);
  }

  const savedScroll = petDropdown.scrollTop;
  petDropdown.innerHTML = parts.join('');
  petDropdown.scrollTop = savedScroll;
}

function renderDropdown(items) {
  petDropdown._items = items;

  if (!items.length) {
    petDropdown.innerHTML = '<li class="pet-empty">未找到匹配精灵</li>';
    petDropdown.hidden = false;
    return;
  }

  petDropdown.hidden = false;
  petDropdown.scrollTop = 0;
  renderVirtualWindow();
}

function handleSearchInput() {
  const value = petSearchInput.value;
  if (selectedPet && value !== formatPetLabel(selectedPet)) {
    selectedPet = null;
  }

  activeIndex = -1;
  renderDropdown(searchPets(value));
}

function bindPetPickerEvents() {
  if (pickerReady) return;
  pickerReady = true;

  petSearchInput.addEventListener('input', handleSearchInput);

  petSearchInput.addEventListener('focus', () => {
    handleSearchInput();
  });

  petDropdown.addEventListener('scroll', () => {
    if (petDropdown._items?.length) renderVirtualWindow();
  });

  petSearchInput.addEventListener('keydown', (e) => {
    const items = petDropdown._items || [];
    if (petDropdown.hidden || !items.length) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeIndex = Math.min(activeIndex + 1, items.length - 1);
      scrollActiveIntoView();
      renderVirtualWindow();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeIndex = Math.max(activeIndex - 1, 0);
      scrollActiveIntoView();
      renderVirtualWindow();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const pet = items[activeIndex >= 0 ? activeIndex : 0];
      if (pet) selectPet(pet);
    } else if (e.key === 'Escape') {
      hideDropdown();
    }
  });

  petDropdown.addEventListener('click', (e) => {
    const btn = e.target.closest('.pet-option');
    if (!btn) return;
    const pet = (petDropdown._items || [])[Number(btn.dataset.index)];
    if (pet) selectPet(pet);
  });

  document.addEventListener('click', (e) => {
    if (!petPicker.contains(e.target)) hideDropdown();
  });
}

function initPetPicker() {
  petSearchInput.disabled = false;

  if (!getPetsList().length) {
    petSearchInput.placeholder = '精灵数据未加载';
    petSearchInput.disabled = true;
    return;
  }

  const count = getPetsList().length;
  petSearchInput.placeholder = `名称或序号 · 共 ${count} 只`;
  bindPetPickerEvents();
}

window.addEventListener('pets-ready', () => {
  invalidatePetSortCache();
  initPetPicker();
});

if (getPetsList().length) {
  initPetPicker();
}
