const LIKE_STORAGE_KEY = 'seer-liked-v1';
const COUNTAPI_NAMESPACE = 'seer-calculator';
const COUNTAPI_KEY = 'likes';
const COUNTAPI_BASE = 'https://api.countapi.xyz';

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
    likeCountEl.textContent = '—';
    likeBtn.title = error;
    return;
  }

  const n = Math.max(0, Number(count) || 0);
  lastKnownCount = n;
  likeCountEl.textContent = String(n);
}

async function fetchLikeCount() {
  const res = await fetch(`${COUNTAPI_BASE}/get/${COUNTAPI_NAMESPACE}/${COUNTAPI_KEY}`);
  if (!res.ok) throw new Error('获取点赞数失败');
  const data = await res.json();
  return data.value ?? 0;
}

async function incrementLikeCount() {
  const res = await fetch(`${COUNTAPI_BASE}/hit/${COUNTAPI_NAMESPACE}/${COUNTAPI_KEY}`);
  if (!res.ok) throw new Error('点赞失败');
  const data = await res.json();
  return data.value ?? 0;
}

async function initLikes() {
  if (!likeBtn || !likeCountEl) return;

  const liked = hasLiked();
  setLikeUi({ liked, count: 0, loading: !liked });

  try {
    const count = await fetchLikeCount();
    setLikeUi({ liked, count });
  } catch {
    setLikeUi({ liked, count: lastKnownCount });
  }

  likeBtn.addEventListener('click', async () => {
    if (hasLiked() || likeBtn.disabled) return;

    setLikeUi({ liked: false, count: lastKnownCount, loading: true });

    try {
      const count = await incrementLikeCount();
      markLiked();
      setLikeUi({ liked: true, count });
    } catch {
      setLikeUi({ liked: false, count: lastKnownCount, error: '点赞失败，请稍后再试' });
    }
  });
}

initLikes();
