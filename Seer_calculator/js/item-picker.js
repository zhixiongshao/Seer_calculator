const ITEM_PICKER_HEIGHT = 30;
const ITEM_PICKER_BUFFER = 5;

function createItemPicker({ root, getList, onChange, placeholder, formatStats, compact }) {
  const input = root.querySelector('.item-picker-input');
  const dropdown = root.querySelector('.item-picker-dropdown');
  let selected = null;
  let activeIndex = -1;
  let sortedCache = null;
  let ready = false;

  function formatLabel(item) {
    return compact ? item.name : `${item.id} ${item.name}`;
  }

  function setFilledState(filled) {
    root.classList.toggle('is-filled', filled);
  }

  function invalidateCache() {
    sortedCache = null;
  }

  function getSortedList() {
    const list = getList();
    if (!sortedCache || sortedCache._len !== list.length) {
      sortedCache = [...list].sort((a, b) => b.id - a.id);
      sortedCache._len = list.length;
    }
    return sortedCache;
  }

  function matchesItem(item, q) {
    if (item.name.toLowerCase().includes(q)) return true;
    if (/^\d+$/.test(q) && String(item.id).includes(q)) return true;
    return false;
  }

  function searchItems(query) {
    const q = query.trim().toLowerCase();
    if (!q) return getSortedList();
    return getSortedList().filter((item) => matchesItem(item, q));
  }

  function hideDropdown() {
    dropdown.hidden = true;
    activeIndex = -1;
  }

  function buildOptionHtml(item, index) {
    const stats = formatStats ? formatStats(item) : '';
    return `
      <li>
        <button type="button" class="item-option${index === activeIndex ? ' is-active' : ''}" data-index="${index}">
          <span class="item-option-main">
            <span class="item-option-id">${item.id}</span>
            <span class="item-option-name">${item.name}</span>
          </span>
          ${stats ? `<span class="item-option-stats">${stats}</span>` : ''}
        </button>
      </li>
    `;
  }

  function scrollActiveIntoView() {
    if (activeIndex < 0) return;
    const viewHeight = dropdown.clientHeight;
    const itemTop = activeIndex * ITEM_PICKER_HEIGHT;
    const itemBottom = itemTop + ITEM_PICKER_HEIGHT;
    const scrollTop = dropdown.scrollTop;
    if (itemTop < scrollTop) dropdown.scrollTop = itemTop;
    else if (itemBottom > scrollTop + viewHeight) dropdown.scrollTop = itemBottom - viewHeight;
  }

  function renderVirtualWindow() {
    const items = dropdown._items || [];
    if (!items.length) {
      dropdown.innerHTML = '<li class="item-empty">未找到匹配项</li>';
      return;
    }

    const scrollTop = dropdown.scrollTop;
    const viewHeight = dropdown.clientHeight || 200;
    const start = Math.max(0, Math.floor(scrollTop / ITEM_PICKER_HEIGHT) - ITEM_PICKER_BUFFER);
    const end = Math.min(
      items.length,
      Math.ceil((scrollTop + viewHeight) / ITEM_PICKER_HEIGHT) + ITEM_PICKER_BUFFER
    );

    const topH = start * ITEM_PICKER_HEIGHT;
    const bottomH = (items.length - end) * ITEM_PICKER_HEIGHT;
    const parts = [];

    if (topH) parts.push(`<li class="item-dropdown-spacer" style="height:${topH}px" aria-hidden="true"></li>`);
    for (let i = start; i < end; i++) parts.push(buildOptionHtml(items[i], i));
    if (bottomH) parts.push(`<li class="item-dropdown-spacer" style="height:${bottomH}px" aria-hidden="true"></li>`);

    const saved = dropdown.scrollTop;
    dropdown.innerHTML = parts.join('');
    dropdown.scrollTop = saved;
  }

  function renderDropdown(items) {
    dropdown._items = items;
    if (!items.length) {
      dropdown.innerHTML = '<li class="item-empty">未找到匹配项</li>';
      dropdown.hidden = false;
      return;
    }
    dropdown.hidden = false;
    dropdown.scrollTop = 0;
    renderVirtualWindow();
  }

  function selectItem(item) {
    selected = item;
    input.value = item ? formatLabel(item) : '';
    setFilledState(!!item);
    hideDropdown();
    onChange(item);
  }

  function clear() {
    selected = null;
    input.value = '';
    setFilledState(false);
    hideDropdown();
    onChange(null);
  }

  function handleInput() {
    const value = input.value;
    if (selected && value !== formatLabel(selected)) selected = null;
    if (!value.trim()) {
      if (selected) clear();
      else hideDropdown();
      return;
    }
    activeIndex = -1;
    renderDropdown(searchItems(value));
  }

  function bindEvents() {
    if (ready) return;
    ready = true;

    input.addEventListener('input', handleInput);
    input.addEventListener('focus', () => {
      activeIndex = -1;
      if (selected && input.value === formatLabel(selected)) {
        renderDropdown(getSortedList());
      } else {
        renderDropdown(searchItems(input.value));
      }
    });

    dropdown.addEventListener('scroll', () => {
      if (dropdown._items?.length) renderVirtualWindow();
    });

    input.addEventListener('keydown', (e) => {
      const items = dropdown._items || [];
      if (dropdown.hidden || !items.length) return;

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
        const item = items[activeIndex >= 0 ? activeIndex : 0];
        if (item) selectItem(item);
      } else if (e.key === 'Escape') {
        hideDropdown();
      }
    });

    dropdown.addEventListener('click', (e) => {
      const btn = e.target.closest('.item-option');
      if (!btn) return;
      const item = (dropdown._items || [])[Number(btn.dataset.index)];
      if (item) selectItem(item);
    });

    document.addEventListener('click', (e) => {
      if (!root.contains(e.target)) hideDropdown();
    });
  }

  function init() {
    const count = getList().length;
    if (!count) {
      input.placeholder = '数据未加载';
      input.disabled = true;
    } else {
      input.placeholder = placeholder.includes('{count}')
        ? placeholder.replace('{count}', count)
        : placeholder;
      input.disabled = false;
    }
    bindEvents();
  }

  return {
    init,
    clear,
    invalidateCache,
    getSelected: () => selected,
  };
}
