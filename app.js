const CONFIG = {
  musicManifestUrl: './Music/music.json',
  playlistFileUrl: './playlist.json'
};

const STORAGE = {
  playlists: 'sp_user_playlists_v1',
  liked: 'sp_liked_tracks_v1',
  volume: 'sp_volume_v1'
};

const ICONS = {
  play: '<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="7 4 20 12 7 20 7 4"/></svg>',
  pause: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>',
  heart: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
  heartFilled: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 5v14M5 12h14"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>',
  note: '<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
  user: '<svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5zm0 2c-5.33 0-8 2.67-8 4v2h16v-2c0-1.33-2.67-4-8-4z"/></svg>',
  disc: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.5"/></svg>',
  shuffle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/></svg>',
  edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>'
};

const state = {
  tracks: [],
  artists: new Map(),
  albums: new Map(),
  sharedPlaylists: [],
  userPlaylists: [],
  likedFiles: new Set(),

  libFilter: 'playlists',
  navHistory: [{ view: 'home', param: null }],
  navIndex: 0,
  searchQuery: '',

  currentTrackId: null,
  queue: [],
  originalQueue: [],
  queueIndex: -1,
  shuffle: false,
  repeat: 'off',
  videoMode: false,
  muted: false,
  lastVolume: 0.8
};

const audio = document.getElementById('audio');
const video = document.getElementById('video');
const $ = (sel) => document.querySelector(sel);

let toastTimer = null;
let activePopover = null;

/* ---------- Broken Image Fallback ---------- */

function createFallbackIcon(type) {
  const tpl = document.createElement('template');
  tpl.innerHTML = ICONS[type] || ICONS.note;
  return tpl.content.firstElementChild;
}

document.addEventListener('error', (e) => {
  const img = e.target;
  if (img && img.tagName === 'IMG' && img.dataset.fallback) {
    img.replaceWith(createFallbackIcon(img.dataset.fallback));
  }
}, true);

/* ---------- Utilities ---------- */

function escapeHTML(str = '') {
  return String(str).replace(/[&<>'"]/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;'
  })[c]);
}

function safeUrl(url) {
  const s = String(url || '').trim();
  if (!s) return '';
  if (/^(https?:\/\/|\.\/|\.\.\/|\/|data:image\/|blob:)/i.test(s)) return s;
  return '';
}

function encodeFilePath(path) {
  return String(path).split('/').map(encodeURIComponent).join('/');
}

function mediaKey(file) {
  return String(file || '').split('/').pop().replace(/\.(mp3|mp4|m4v|webm|jpg|jpeg|png|webp)$/i, '').toLowerCase();
}

function slugify(str) {
  return String(str || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'item';
}

function formatTime(sec) {
  if (!Number.isFinite(sec) || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function notify(msg, isError = false) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.toggle('error', isError);
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
}

function closePopover() {
  if (activePopover) {
    activePopover.remove();
    activePopover = null;
  }
}

function sampleImageColor(src, fallback = '#2c2c2c') {
  return new Promise((resolve) => {
    if (!src) return resolve(fallback);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 8;
        canvas.height = 8;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, 8, 8);
        const data = ctx.getImageData(0, 0, 8, 8).data;
        let r = 0, g = 0, b = 0, n = 0;
        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] < 128) continue;
          r += data[i]; g += data[i + 1]; b += data[i + 2]; n++;
        }
        if (!n) return resolve(fallback);
        r = Math.round((r / n) * 0.65);
        g = Math.round((g / n) * 0.65);
        b = Math.round((b / n) * 0.65);
        resolve(`rgb(${r}, ${g}, ${b})`);
      } catch {
        resolve(fallback);
      }
    };
    img.onerror = () => resolve(fallback);
    img.src = src;
  });
}

/* ---------- Storage ---------- */

function loadLocalData() {
  try {
    const savedPlaylists = JSON.parse(localStorage.getItem(STORAGE.playlists) || '[]');
    if (Array.isArray(savedPlaylists)) {
      state.userPlaylists = savedPlaylists.map((p) => normalizePlaylist(p, true));
    }
  } catch {}

  try {
    const savedLiked = JSON.parse(localStorage.getItem(STORAGE.liked) || '[]');
    if (Array.isArray(savedLiked)) {
      state.likedFiles = new Set(savedLiked);
    }
  } catch {}

  try {
    const vol = parseFloat(localStorage.getItem(STORAGE.volume));
    if (Number.isFinite(vol) && vol >= 0 && vol <= 1) {
      state.lastVolume = vol;
      audio.volume = vol;
      video.volume = vol;
      $('#volumeBar').value = Math.round(vol * 100);
    }
  } catch {}
}

function saveUserPlaylists() {
  localStorage.setItem(STORAGE.playlists, JSON.stringify(state.userPlaylists));
}

function saveLiked() {
  localStorage.setItem(STORAGE.liked, JSON.stringify([...state.likedFiles]));
}

/* ---------- Data Loading ---------- */

function parseFilename(file, suppliedTitle, suppliedArtist, suppliedAlbum) {
  const partsPath = String(file || '').split('/').filter(Boolean);
  const filename = partsPath[partsPath.length - 1] || '';
  const clean = filename.replace(/\.(mp3|mp4|m4v|webm)$/i, '');
  const dashParts = clean.split(/\s+-\s+/);

  let folderArtist = '';
  let folderAlbum = '';
  if (partsPath.length >= 3 && !/^(mp3|mp4)$/i.test(partsPath[0])) {
    folderArtist = partsPath[0];
    folderAlbum = partsPath[1];
  } else if (partsPath.length === 2 && !/^(mp3|mp4)$/i.test(partsPath[0])) {
    folderAlbum = partsPath[0];
  }

  const title = suppliedTitle || dashParts[0] || 'Untitled';
  const artist = suppliedArtist || (dashParts.length > 1 ? dashParts.slice(1).join(' - ') : folderArtist) || 'Unknown Artist';
  const album = suppliedAlbum || folderAlbum || '';

  return { title, artist, album };
}

function githubRepoInfo() {
  const host = location.hostname.toLowerCase().split('.');
  if (host.length !== 3 || host[1] !== 'github' || host[2] !== 'io') return null;
  const owner = host[0];
  const seg = location.pathname.split('/').filter(Boolean)[0];
  return { owner, repo: seg || `${owner}.github.io` };
}

async function fetchGitHubMusicTree() {
  const info = githubRepoInfo();
  if (!info) throw new Error('Not github.io');

  const cacheKey = `gh_tree_v2_${info.owner}/${info.repo}`;
  let cached = null;
  try {
    cached = JSON.parse(sessionStorage.getItem(cacheKey) || 'null');
  } catch {}

  const headers = { Accept: 'application/vnd.github+json' };
  if (cached?.etag) {
    headers['If-None-Match'] = cached.etag;
  }

  const url = `https://api.github.com/repos/${encodeURIComponent(info.owner)}/${encodeURIComponent(info.repo)}/git/trees/HEAD?recursive=1`;
  const res = await fetch(url, { headers });

  if (res.status === 304 && cached?.tree) {
    return cached.tree;
  }

  if (!res.ok) {
    if (cached?.tree) return cached.tree;
    throw new Error(`GitHub API returned ${res.status}`);
  }

  const data = await res.json();
  const tree = Array.isArray(data.tree) ? data.tree : [];
  const etag = res.headers.get('ETag') || '';

  try {
    sessionStorage.setItem(cacheKey, JSON.stringify({ etag, tree }));
  } catch {}

  return tree;
}

async function loadFolderListing(folder) {
  const folderUrl = new URL(`${folder ? `Music/${folder}` : 'Music'}/`, document.baseURI);
  const res = await fetch(folderUrl, { cache: 'no-store' });
  if (!res.ok) throw new Error('No listing');
  const html = await res.text();
  return [...html.matchAll(/href=["']([^"']+)["']/gi)]
    .map((m) => decodeURIComponent(m[1]))
    .filter((href) => !href.startsWith('?') && !href.startsWith('..'));
}

async function loadMusicLibrary() {
  let manifest = null;

  try {
    const res = await fetch(CONFIG.musicManifestUrl, { cache: 'no-store' });
    if (res.ok) manifest = await res.json();
  } catch {}

  let rawSongs = [];
  const rawVideos = new Map();
  const rawCovers = new Map();

  if (manifest) {
    rawSongs = Array.isArray(manifest) ? manifest : (manifest.songs || manifest.tracks || []);
  }

  if (!rawSongs.length) {
    try {
      const allLinks = [];
      for (const sub of ['', 'MP3', 'MP4', 'Covers']) {
        try {
          const items = await loadFolderListing(sub);
          items.forEach((f) => allLinks.push(sub ? `${sub}/${f.split('/').pop()}` : f.split('/').pop()));
        } catch {}
      }
      allLinks.forEach((rel) => {
        if (/\.mp3$/i.test(rel)) rawSongs.push({ file: rel, url: `./Music/${encodeFilePath(rel)}` });
        else if (/\.(mp4|m4v|webm)$/i.test(rel)) rawVideos.set(mediaKey(rel), `./Music/${encodeFilePath(rel)}`);
        else if (/\.(jpg|jpeg|png|webp)$/i.test(rel)) rawCovers.set(mediaKey(rel), `./Music/${encodeFilePath(rel)}`);
      });
    } catch {}

    if (!rawSongs.length) {
      try {
        const tree = await fetchGitHubMusicTree();
        tree.forEach((node) => {
          if (node.type !== 'blob' || !/^Music\//i.test(node.path)) return;
          const rel = node.path.replace(/^Music\//i, '');
          const exactUrl = `./${encodeFilePath(node.path)}`;
          if (/\.mp3$/i.test(rel)) {
            rawSongs.push({ file: rel, url: exactUrl });
          } else if (/\.(mp4|m4v|webm)$/i.test(rel)) {
            rawVideos.set(mediaKey(rel), exactUrl);
          } else if (/\.(jpg|jpeg|png|webp)$/i.test(rel)) {
            rawCovers.set(mediaKey(rel), exactUrl);
            const dir = rel.includes('/') ? rel.slice(0, rel.lastIndexOf('/')) : '';
            if (dir && /^(cover|folder|front|artwork)\./i.test(rel.split('/').pop())) {
              rawCovers.set(`dir:${dir.toLowerCase()}`, exactUrl);
            }
          }
        });
      } catch (err) {
        console.warn('Could not scan GitHub Music folder:', err);
      }
    }
  }

  const artistMeta = (manifest && manifest.artists) || {};
  const albumMeta = (manifest && manifest.albums) || {};

  state.tracks = rawSongs
    .map((item, idx) => {
      const src = typeof item === 'string' ? { file: item } : (item || {});
      const file = src.file || src.filename || '';
      if (!file || !/\.mp3$/i.test(file)) return null;

      const parsed = parseFilename(file, src.title, src.artist, src.album);
      const dir = file.includes('/') ? file.slice(0, file.lastIndexOf('/')).toLowerCase() : '';
      const aMeta = albumMeta[parsed.album] || {};
      const cover = safeUrl(
        src.cover ||
        aMeta.cover ||
        rawCovers.get(mediaKey(file)) ||
        rawCovers.get(mediaKey(parsed.album)) ||
        (dir ? rawCovers.get(`dir:${dir}`) : '') ||
        ''
      );

      return {
        id: `track-${idx}`,
        file,
        title: parsed.title,
        artist: parsed.artist,
        album: parsed.album || 'Singles',
        hasExplicitAlbum: Boolean(parsed.album),
        cover,
        year: src.year || aMeta.year || '',
        duration: Number.isFinite(src.duration) ? src.duration : null,
        url: safeUrl(src.url) || `./Music/${encodeFilePath(file)}`,
        videoUrl: safeUrl(src.videoUrl) || rawVideos.get(mediaKey(file)) || ''
      };
    })
    .filter(Boolean);

  buildIndexes(artistMeta, albumMeta);
}

function buildIndexes(artistMeta = {}, albumMeta = {}) {
  state.artists.clear();
  state.albums.clear();

  Object.entries(artistMeta).forEach(([name, meta]) => {
    state.artists.set(name, {
      name,
      avatar: safeUrl(meta.avatar || ''),
      banner: safeUrl(meta.banner || ''),
      bio: meta.bio || '',
      genre: meta.genre || '',
      tracks: [],
      albumIds: new Set()
    });
  });

  state.tracks.forEach((t) => {
    if (!state.artists.has(t.artist)) {
      const meta = artistMeta[t.artist] || {};
      state.artists.set(t.artist, {
        name: t.artist,
        avatar: safeUrl(meta.avatar || ''),
        banner: safeUrl(meta.banner || ''),
        bio: meta.bio || '',
        genre: meta.genre || '',
        tracks: [],
        albumIds: new Set()
      });
    }
    const artistObj = state.artists.get(t.artist);
    artistObj.tracks.push(t);
    if (!artistObj.avatar && t.cover) artistObj.avatar = t.cover;

    if (t.hasExplicitAlbum || albumMeta[t.album]) {
      const albumKey = `${t.album}::${t.artist}`;
      if (!state.albums.has(albumKey)) {
        const meta = albumMeta[t.album] || {};
        state.albums.set(albumKey, {
          id: `alb-${slugify(t.album)}-${slugify(t.artist)}`,
          title: t.album,
          artist: meta.artist || t.artist,
          cover: safeUrl(meta.cover || t.cover || ''),
          year: meta.year || t.year || '',
          tracks: []
        });
      }
      const alb = state.albums.get(albumKey);
      alb.tracks.push(t);
      if (!alb.cover && t.cover) alb.cover = t.cover;
      artistObj.albumIds.add(alb.id);
    }
  });
}

function normalizePlaylist(item = {}, isUser = false) {
  const songs = Array.isArray(item.songs) ? item.songs : (Array.isArray(item.tracks) ? item.tracks : []);
  return {
    id: String(item.id || `pl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`),
    name: String(item.name || 'Untitled Playlist'),
    description: String(item.description || ''),
    cover: safeUrl(item.cover || ''),
    pinValue: item.pinValue === '1' ? '1' : 'none',
    songs: songs.map((s) => (typeof s === 'string' ? s : s.file || '')).filter(Boolean),
    isUser
  };
}

async function loadSharedPlaylists() {
  try {
    const res = await fetch(CONFIG.playlistFileUrl, { cache: 'no-store' });
    if (!res.ok) return;
    const json = await res.json();
    const list = Array.isArray(json) ? json : (json.playlists || []);
    state.sharedPlaylists = list.map((p) => normalizePlaylist(p, false));
  } catch {
    state.sharedPlaylists = [];
  }
}

/* ---------- Helpers ---------- */

function getTrack(id) {
  return state.tracks.find((t) => t.id === id) || null;
}

function getAllPlaylists() {
  const liked = {
    id: 'liked-songs',
    name: 'Liked Songs',
    description: 'Tracks you have saved',
    cover: '',
    isLiked: true,
    isUser: false,
    songs: [...state.likedFiles]
  };
  return [liked, ...state.userPlaylists, ...state.sharedPlaylists];
}

function getPlaylist(id) {
  return getAllPlaylists().find((p) => p.id === id) || null;
}

function getPlaylistTracks(playlist) {
  if (!playlist) return [];
  if (playlist.pinValue === '1') return [...state.tracks];
  const byFile = new Map(state.tracks.map((t) => [t.file, t]));
  return playlist.songs.map((f) => byFile.get(f)).filter(Boolean);
}

function renderPlaylistArt(playlist, sizeClass = '') {
  if (playlist.isLiked) {
    return `<div class="${sizeClass} liked">${ICONS.heart}</div>`;
  }
  if (playlist.cover) {
    return `<div class="${sizeClass}"><img src="${escapeHTML(playlist.cover)}" data-fallback="note" alt="" loading="lazy"></div>`;
  }
  const tracks = getPlaylistTracks(playlist);
  const covers = [...new Set(tracks.map((t) => t.cover).filter(Boolean))].slice(0, 4);
  if (covers.length >= 4) {
    return `<div class="${sizeClass}"><div class="mosaic">${covers.map((c) => `<img src="${escapeHTML(c)}" data-fallback="note" alt="" loading="lazy">`).join('')}</div></div>`;
  }
  if (covers.length >= 1) {
    return `<div class="${sizeClass}"><img src="${escapeHTML(covers[0])}" data-fallback="note" alt="" loading="lazy"></div>`;
  }
  return `<div class="${sizeClass}">${ICONS.note}</div>`;
}

function activeMedia() {
  const t = getTrack(state.currentTrackId);
  return state.videoMode && t?.videoUrl ? video : audio;
}

/* ---------- Navigation ---------- */

function currentRoute() {
  return state.navHistory[state.navIndex];
}

function navigate(view, param = null, replace = false) {
  const current = currentRoute();
  if (!replace && current && current.view === view && current.param === param) {
    renderMain();
    return;
  }
  if (replace) {
    state.navHistory[state.navIndex] = { view, param };
  } else {
    state.navHistory = state.navHistory.slice(0, state.navIndex + 1);
    state.navHistory.push({ view, param });
    state.navIndex = state.navHistory.length - 1;
  }
  renderNavButtons();
  renderMain();
  renderSidebar();
  const scroller = $('#mainScroll');
  if (scroller) scroller.scrollTop = 0;
}

function renderNavButtons() {
  $('#backBtn').disabled = state.navIndex <= 0;
  $('#fwdBtn').disabled = state.navIndex >= state.navHistory.length - 1;

  const { view } = currentRoute();
  document.querySelectorAll('[data-nav]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.nav === view);
  });
}

/* ---------- Playback Engine ---------- */

function shuffleArray(arr, keepFirstValue = null) {
  const copy = arr.filter((x) => x !== keepFirstValue);
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return keepFirstValue !== null ? [keepFirstValue, ...copy] : copy;
}

async function playFromList(trackIds, startIndex = 0) {
  if (!trackIds.length) {
    notify('No playable tracks here', true);
    return;
  }
  const targetId = trackIds[Math.max(0, Math.min(startIndex, trackIds.length - 1))];
  state.originalQueue = [...trackIds];

  if (state.shuffle) {
    state.queue = shuffleArray(trackIds, targetId);
    state.queueIndex = 0;
  } else {
    state.queue = [...trackIds];
    state.queueIndex = state.queue.indexOf(targetId);
  }
  await loadAndPlayTrack(targetId);
}

async function loadAndPlayTrack(trackId) {
  const track = getTrack(trackId);
  if (!track) return;

  const media = state.videoMode && track.videoUrl ? video : audio;
  const other = media === audio ? video : audio;

  if (state.currentTrackId === trackId) {
    if (media.paused) await media.play().catch(() => {});
    else media.pause();
    return;
  }

  audio.pause();
  video.pause();
  other.removeAttribute('src');

  state.currentTrackId = trackId;
  if (!track.videoUrl && state.videoMode) {
    state.videoMode = false;
  }

  video.hidden = !(state.videoMode && track.videoUrl);
  media.src = state.videoMode && track.videoUrl ? track.videoUrl : track.url;

  updateNowPlayingUI();
  updatePlayingRowIndicators();

  try {
    await media.play();
  } catch {
    notify(`Could not play "${track.title}". Check that the MP3 file exists in your Music folder.`, true);
  }
}

function togglePlayPause() {
  if (!state.currentTrackId) {
    if (state.tracks.length) playFromList(state.tracks.map((t) => t.id), 0);
    return;
  }
  const media = activeMedia();
  if (media.paused) media.play().catch(() => {});
  else media.pause();
}

function playNext(auto = false) {
  if (!state.queue.length) return;
  if (auto && state.repeat === 'one') {
    const media = activeMedia();
    media.currentTime = 0;
    media.play().catch(() => {});
    return;
  }
  if (state.queueIndex < state.queue.length - 1) {
    state.queueIndex++;
    loadAndPlayTrack(state.queue[state.queueIndex]);
  } else if (state.repeat === 'all' || !auto) {
    state.queueIndex = 0;
    loadAndPlayTrack(state.queue[0]);
  }
}

function playPrev() {
  if (!state.queue.length) return;
  const media = activeMedia();
  if (media.currentTime > 3) {
    media.currentTime = 0;
    return;
  }
  if (state.queueIndex > 0) {
    state.queueIndex--;
  } else if (state.repeat === 'all') {
    state.queueIndex = state.queue.length - 1;
  } else {
    media.currentTime = 0;
    return;
  }
  loadAndPlayTrack(state.queue[state.queueIndex]);
}

function toggleShuffle() {
  state.shuffle = !state.shuffle;
  if (state.originalQueue.length) {
    const cur = state.currentTrackId;
    if (state.shuffle) {
      state.queue = shuffleArray(state.originalQueue, cur);
      state.queueIndex = 0;
    } else {
      state.queue = [...state.originalQueue];
      state.queueIndex = Math.max(0, state.queue.indexOf(cur));
    }
  }
  updateTransportButtons();
}

function cycleRepeat() {
  const order = ['off', 'all', 'one'];
  state.repeat = order[(order.indexOf(state.repeat) + 1) % order.length];
  updateTransportButtons();
}

function switchVideoMode() {
  const track = getTrack(state.currentTrackId);
  if (!track || !track.videoUrl) return;

  const oldMedia = activeMedia();
  const wasPlaying = !oldMedia.paused;
  const savedTime = oldMedia.currentTime || 0;
  oldMedia.pause();

  state.videoMode = !state.videoMode;
  const newMedia = activeMedia();
  video.hidden = !state.videoMode;

  newMedia.src = state.videoMode ? track.videoUrl : track.url;
  newMedia.addEventListener('loadedmetadata', () => {
    if (Number.isFinite(newMedia.duration)) {
      newMedia.currentTime = Math.min(savedTime, newMedia.duration);
    }
    if (wasPlaying) newMedia.play().catch(() => {});
  }, { once: true });

  updateTransportButtons();
}

/* ---------- UI Updating ---------- */

function updateNowPlayingUI() {
  const track = getTrack(state.currentTrackId);
  if (!track) return;

  $('#npTitle').textContent = track.title;
  const artistBtn = $('#npArtistBtn');
  artistBtn.textContent = track.artist;
  artistBtn.disabled = false;
  artistBtn.dataset.openArtist = track.artist;

  const coverEl = $('#npCover');
  coverEl.innerHTML = track.cover
    ? `<img src="${escapeHTML(track.cover)}" data-fallback="note" alt="">`
    : ICONS.note;

  const liked = state.likedFiles.has(track.file);
  const likeBtn = $('#npLikeBtn');
  likeBtn.innerHTML = liked ? ICONS.heartFilled : ICONS.heart;
  likeBtn.classList.toggle('active', liked);

  $('#videoModeBtn').classList.toggle('hidden', !track.videoUrl);
  updateTransportButtons();

  if ('mediaSession' in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: track.artist,
      album: track.album,
      artwork: track.cover ? [{ src: track.cover }] : []
    });
  }
}

function updateTransportButtons() {
  const media = activeMedia();
  const isPlaying = Boolean(state.currentTrackId && !media.paused);
  $('#playPauseBtn').innerHTML = isPlaying ? ICONS.pause : ICONS.play;
  $('#shuffleBtn').classList.toggle('activ
