const LIKE_STORAGE_KEY = 'seer-liked-v1';
const LIKE_COUNTER_KEY = 'seer-calculator-likes';
const COUNTAPI_BASE = 'https://countapi.mileshilliard.com/api/v1';

const likeBtn = document.getElementById('btn-like');
const likeCountEl = document.getElementById('like-count');
let lastKnownCount = 0;

function hasLiked() {
  try {
    return localStorage.getItem(LIKE_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function markLiked() {
  try {
    localStorage.setItem(LIKE_STORAGE_KEY, '1');
  } catch {
    /* ignore */
  }
}

function parseCount(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

function setLikeUi({ liked, count, loading = false, error = '' }) {
  if (!likeBtn || !likeCountEl) return;

  likeBtn.classList.toggle('is-liked', liked);
  likeBtn.classList.toggle('is-loading', loading);
  likeBtn.disabled = liked || loading;
  likeBtn.title = liked ? '你已点赞，感谢支持！' : '喜欢这个工具？点一下支持作者';
  likeBtn.setAttribute('aria-pressed', liked ? 'true' : 'false');

  if (loading) {
    likeCountEl.textContent = '…';
    return;
  }

  if (error) {
    likeCountEl.textContent = String(lastKnownCount);
    likeBtn.title = error;
    return;
  }

  lastKnownCount = parseCount(count);
  likeCountEl.textContent = String(lastKnownCount);
}

async function fetchLikeCount() {
  const res = await fetch(`${COUNTAPI_BASE}/get/${LIKE_COUNTER_KEY}`);
  if (!res.ok) throw new Error('获取点赞数失败');
  const data = await res.json();
  if (data.error === 'Key not found') return 0;
  if (data.error) throw new Error(data.error);
  return parseCount(data.value);
}

async function incrementLikeCount() {
  const res = await fetch(`${COUNTAPI_BASE}/hit/${LIKE_COUNTER_KEY}`);
  if (!res.ok) throw new Error('点赞失败');
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return parseCount(data.value);
}

async function initLikes() {
  if (!likeBtn || !likeCountEl) return;

  const liked = hasLiked();
  setLikeUi({ liked, count: 0, loading: true });

  try {
    const count = await fetchLikeCount();
    setLikeUi({ liked, count });
  } catch {
    setLikeUi({ liked, count: 0, error: '暂时无法获取点赞数' });
  }

  likeBtn.addEventListener('click', async () => {
    if (hasLiked() || likeBtn.disabled) return;

    setLikeUi({ liked: false, count: lastKnownCount, loading: true });

    try {
      const count = await incrementLikeCount();
      markLiked();
      setLikeUi({ liked: true, count });
    } catch {
      setLikeUi({
        liked: false,
        count: lastKnownCount,
        error: '点赞失败，请稍后再试',
      });
    }
  });
}

initLikes();
