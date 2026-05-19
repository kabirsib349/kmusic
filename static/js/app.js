// ═══════════════════════════════════════════════════
//  KMusic — App.js (Player + Library + Socket.IO)
// ═══════════════════════════════════════════════════

const socket = io();

// ── State ────────────────────────────────────────────
const state = {
  tracks: [],         // all tracks from API
  filtered: [],       // tracks after search filter
  currentIndex: -1,   // index in state.filtered
  shuffle: false,
  repeat: false,      // 'none' | 'one' | 'all'
  repeatMode: 'none',
  dragging: false,
  currentView: 'library',
  selectionMode: false,
  selectedIds: new Set(),
  isTrackEnding: false // Hack iOS pour la lecture en arrière-plan
};

// ── Audio Element ─────────────────────────────────────
const audio = document.createElement('audio');
audio.setAttribute('playsinline', '');
audio.setAttribute('webkit-playsinline', '');
audio.autoplay = true; // Force la lecture automatique au changement de source (aide sur iOS en arrière-plan)
document.body.appendChild(audio);

// ── DOM refs ──────────────────────────────────────────
const dom = {
  tracksList:     document.getElementById('tracks-list'),
  searchInput:    document.getElementById('search-input'),
  trackCountBadge:document.getElementById('track-count'),
  playerBar:      document.getElementById('player-bar'),
  playerTrackInfo:document.getElementById('player-track-info'),
  fsCloseBtn:     document.getElementById('fs-close-btn'),
  playerCover:    document.getElementById('player-cover'),
  playerTitle:    document.getElementById('player-title'),
  playerArtist:   document.getElementById('player-artist'),
  playBtn:        document.getElementById('play-btn'),
  prevBtn:        document.getElementById('prev-btn'),
  nextBtn:        document.getElementById('next-btn'),
  shuffleBtn:     document.getElementById('shuffle-btn'),
  repeatBtn:      document.getElementById('repeat-btn'),
  progressBar:    document.getElementById('progress-bar'),
  progressFill:   document.getElementById('progress-fill'),
  currentTime:    document.getElementById('current-time'),
  duration:       document.getElementById('duration'),
  volumeSlider:   document.getElementById('volume-slider'),
  dropZone:       document.getElementById('drop-zone'),
  fileInput:      document.getElementById('file-input'),
  uploadList:     document.getElementById('upload-list'),
  toastWrap:      document.getElementById('toast-wrap'),
};

// ═══════════════════════════════════════════════════
//  Library
// ═══════════════════════════════════════════════════

async function loadTracks() {
  try {
    const res = await fetch('/api/tracks');
    state.tracks = await res.json();
    applyFilter();
  } catch (e) {
    showToast('Erreur chargement bibliothèque', 'error');
  }
}

function applyFilter() {
  const q = (dom.searchInput?.value || '').toLowerCase();
  if (!q) {
    state.filtered = [...state.tracks];
  } else {
    state.filtered = state.tracks.filter(t =>
      t.title.toLowerCase().includes(q) ||
      t.artist.toLowerCase().includes(q) ||
      t.album.toLowerCase().includes(q)
    );
  }
  renderTracks();
}

function renderTracks() {
  dom.trackCountBadge.textContent = state.tracks.length;
  if (!state.filtered.length) {
    dom.tracksList.innerHTML = `
    <div class="empty-state">
      <div class="empty-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" width="48" height="48"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg></div>
      <div class="empty-title">${state.tracks.length === 0 ? 'Aucune musique' : 'Aucun résultat'}</div>
      <div class="empty-sub">${state.tracks.length === 0 ? 'Ajoute des fichiers dans music/ ou utilise l\'onglet Upload' : 'Essaie un autre mot-clé'}</div>
    </div>`;
    return;
  }

  dom.tracksList.innerHTML = state.filtered.map((t, i) => `
    <div class="track-row ${state.currentIndex === i ? 'playing' : ''} ${state.selectionMode ? 'selection-mode' : ''} ${state.selectedIds.has(t.id) ? 'selected-row' : ''}" data-index="${i}" id="track-row-${t.id}">
      <div class="track-num">
        <input type="checkbox" class="track-checkbox" data-id="${t.id}" ${state.selectedIds.has(t.id) ? 'checked' : ''}>
        ${state.currentIndex === i
          ? `<div class="playing-bars track-num-text"><span></span><span></span><span></span></div>`
          : `<span class="track-num-text">${i + 1}</span>`}
      </div>
      <div>
        ${t.has_cover
          ? `<img class="track-cover-sm" src="/api/tracks/${t.id}/cover" alt="" loading="lazy">`
          : `<div class="track-cover-ph"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg></div>`}
      </div>
      <div class="track-info-cell">
        <div class="track-title-cell">${escHtml(t.title)}</div>
        <div class="track-artist-cell">${escHtml(t.artist)}</div>
      </div>
      <div class="track-album-cell">${escHtml(t.album)}</div>
      <div class="track-duration-cell">${formatTime(t.duration)}</div>
      <button class="track-more-btn delete-btn" aria-label="Supprimer" data-id="${t.id}" title="Supprimer ce titre">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
      </button>
    </div>
  `).join('');

  // Click listeners
  dom.tracksList.querySelectorAll('.track-row').forEach(row => {
    row.addEventListener('click', (e) => {
      if (state.selectionMode) {
        const cb = row.querySelector('.track-checkbox');
        const id = parseInt(cb.dataset.id);
        if (state.selectedIds.has(id)) {
          state.selectedIds.delete(id);
          cb.checked = false;
          row.classList.remove('selected-row');
        } else {
          state.selectedIds.add(id);
          cb.checked = true;
          row.classList.add('selected-row');
        }
        updateSelectionUI();
        return;
      }

      if (e.target.closest('.delete-btn')) return; // ignoré si clic sur poubelle
      const i = parseInt(row.dataset.index);
      playTrack(i);
    });
  });

  dom.tracksList.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = parseInt(btn.dataset.id);
      openConfirmModal([id]);
    });
  });
}

// ═══════════════════════════════════════════════════
//  Selection & Modal
// ═══════════════════════════════════════════════════

function toggleSelectionMode() {
  state.selectionMode = !state.selectionMode;
  if (!state.selectionMode) state.selectedIds.clear();
  renderTracks();
  updateSelectionUI();
}

function updateSelectionUI() {
  const bar = document.getElementById('selection-action-bar');
  const count = document.getElementById('sel-count');
  
  if (state.selectionMode) {
    bar.classList.remove('hidden');
    count.textContent = state.selectedIds.size;
  } else {
    bar.classList.add('hidden');
  }
}

document.getElementById('toggle-selection-btn')?.addEventListener('click', toggleSelectionMode);
document.getElementById('sel-cancel-btn')?.addEventListener('click', toggleSelectionMode);

let idsToDelete = [];
function openConfirmModal(ids) {
  idsToDelete = ids;
  document.getElementById('modal-delete-count').textContent = ids.length;
  document.getElementById('confirm-modal').classList.remove('hidden');
}

function closeConfirmModal() {
  document.getElementById('confirm-modal').classList.add('hidden');
  idsToDelete = [];
}

document.getElementById('modal-cancel-btn')?.addEventListener('click', closeConfirmModal);

document.getElementById('sel-delete-btn')?.addEventListener('click', () => {
  if (state.selectedIds.size === 0) return;
  openConfirmModal(Array.from(state.selectedIds));
});

document.getElementById('modal-confirm-btn')?.addEventListener('click', async () => {
  if (!idsToDelete.length) return;
  const btn = document.getElementById('modal-confirm-btn');
  const originalText = btn.textContent;
  btn.textContent = 'Suppression...';
  btn.disabled = true;
  
  try {
    const res = await fetch('/api/tracks/batch', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: idsToDelete })
    });
    if (!res.ok) throw new Error('Delete failed');
    if (state.selectionMode) toggleSelectionMode();
    showToast(`${idsToDelete.length} titre(s) supprimé(s)`, 'success');
  } catch (err) {
    showToast("Erreur lors de la suppression (As-tu bien redémarré ton serveur ?)", "error");
  } finally {
    btn.textContent = originalText;
    btn.disabled = false;
    closeConfirmModal();
  }
});

// ═══════════════════════════════════════════════════
//  Player
// ═══════════════════════════════════════════════════

function playTrack(index) {
  if (index < 0 || index >= state.filtered.length) return;
  state.currentIndex = index;
  const track = state.filtered[index];

  audio.src = `/api/tracks/${track.id}/stream`;
  // Suppression de audio.load() pour éviter qu'iOS Safari ne bloque 
  // la lecture continue en arrière-plan (coupure de la session audio).
  audio.play().catch(e => console.warn('Autoplay blocked:', e));

  updatePlayerUI(track);
  renderTracks(); // update highlight
  updateMediaSession(track);

  // Auto-open fullscreen player on mobile when a track is played
  if (window.innerWidth <= 768 && dom.playerBar) {
    dom.playerBar.classList.add('fs-active');
    document.body.style.overflow = 'hidden';
  }
}

function updatePlayerUI(track) {
  dom.playerTitle.textContent  = track.title;
  dom.playerArtist.textContent = track.artist;

  if (track.has_cover) {
    dom.playerCover.innerHTML = `<img src="/api/tracks/${track.id}/cover" alt="cover" class="player-cover">`;
  } else {
    dom.playerCover.innerHTML = `<div class="player-cover-ph"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="20" height="20"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg></div>`;
  }
}

function playPause() {
  if (!audio.src) return;
  if (audio.paused) { audio.play(); } else { audio.pause(); }
}

function playNext() {
  if (!state.filtered.length) return;
  let next;
  if (state.shuffle) {
    next = Math.floor(Math.random() * state.filtered.length);
  } else {
    next = state.currentIndex + 1;
    if (next >= state.filtered.length) next = 0;
  }
  playTrack(next);
}

function playPrev() {
  if (!state.filtered.length) return;
  if (audio.currentTime > 3) { audio.currentTime = 0; return; }
  let prev = state.currentIndex - 1;
  if (prev < 0) prev = state.filtered.length - 1;
  playTrack(prev);
}

// Audio events
audio.addEventListener('play', () => {
  state.isTrackEnding = false; // Réinitialise le flag ici une fois que la nouvelle piste a commencé à jouer
  document.getElementById('play-icon').outerHTML =
    '<svg id="play-icon" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';
});
audio.addEventListener('pause', () => {
  document.getElementById('play-icon').outerHTML =
    '<svg id="play-icon" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5 3 19 12 5 21 5 3"/></svg>';
});

audio.addEventListener('timeupdate', () => {
  if (!audio.duration || state.dragging) return;
  const pct = (audio.currentTime / audio.duration) * 100;
  dom.progressFill.style.width = pct + '%';
  dom.currentTime.textContent = formatTime(audio.currentTime);

  // --- HACK IOS SAFARI ---
  // Si on est à moins de 0.4s de la fin, on passe à la suite manuellement.
  // Cela empêche l'audio de s'arrêter complètement et empêche iOS 
  // de "geler" l'exécution Javascript en arrière-plan.
  if (audio.duration - audio.currentTime < 0.4 && !state.isTrackEnding) {
    state.isTrackEnding = true;
    if (state.repeatMode === 'one') {
      audio.currentTime = 0;
      audio.play();
      setTimeout(() => state.isTrackEnding = false, 1000);
    } else {
      playNext();
    }
  }
});

audio.addEventListener('loadedmetadata', () => {
  dom.duration.textContent = formatTime(audio.duration);
});

audio.addEventListener('ended', () => {
  // Fallback au cas où le hack timeupdate n'a pas suffi
  if (!state.isTrackEnding) {
    if (state.repeatMode === 'one') {
      audio.currentTime = 0;
      audio.play();
    } else {
      playNext();
    }
  }
});

// Progress bar seeking & scrubbing
function updateProgressFromEvent(e) {
  const rect = dom.progressBar.getBoundingClientRect();
  const clientX = e.touches && e.touches.length > 0 ? e.touches[0].clientX : e.clientX;
  let pct = (clientX - rect.left) / rect.width;
  pct = Math.max(0, Math.min(1, pct));
  dom.progressFill.style.width = (pct * 100) + '%';
  if (audio.duration) {
    audio.currentTime = pct * audio.duration;
  }
}

// Mouse events
dom.progressBar.addEventListener('mousedown', (e) => {
  state.dragging = true;
  updateProgressFromEvent(e);
});
document.addEventListener('mouseup', () => { state.dragging = false; });
document.addEventListener('mousemove', (e) => {
  if (state.dragging) updateProgressFromEvent(e);
});

// Touch events (Mobile/Safari)
dom.progressBar.addEventListener('touchstart', (e) => {
  state.dragging = true;
  updateProgressFromEvent(e);
}, { passive: true });
document.addEventListener('touchend', () => { state.dragging = false; });
document.addEventListener('touchmove', (e) => {
  if (state.dragging) updateProgressFromEvent(e);
}, { passive: true });

// Volume
dom.volumeSlider.addEventListener('input', () => {
  audio.volume = dom.volumeSlider.value / 100;
});

// Fullscreen Mobile Player
if (dom.playerTrackInfo && dom.playerBar && dom.fsCloseBtn) {
  dom.playerTrackInfo.addEventListener('click', (e) => {
    // Ne pas ouvrir si on a cliqué sur un bouton dans le conteneur (au cas où)
    if (e.target.closest('button')) return;
    // N'ouvrir que si on est sur mobile (media query gère le css mais on vérifie la largeur)
    if (window.innerWidth <= 768 && audio.src) {
      dom.playerBar.classList.add('fs-active');
      document.body.style.overflow = 'hidden'; // Empêche le défilement de la liste derrière
    }
  });

  dom.fsCloseBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    dom.playerBar.classList.remove('fs-active');
    document.body.style.overflow = '';
  });

  // Swipe Gestures for Fullscreen Player
  let touchStartX = 0;
  let touchStartY = 0;
  let isFsSwiping = false;

  dom.playerBar.addEventListener('touchstart', (e) => {
    if (!dom.playerBar.classList.contains('fs-active')) return;
    // Ignorer si on touche la barre de progression (car on veut pouvoir la déplacer)
    if (e.target.closest('.progress-wrap') || e.target.closest('.volume-slider')) return;
    
    touchStartX = e.changedTouches[0].screenX;
    touchStartY = e.changedTouches[0].screenY;
    isFsSwiping = true;
  }, { passive: true });

  dom.playerBar.addEventListener('touchend', (e) => {
    if (!isFsSwiping || !dom.playerBar.classList.contains('fs-active')) return;
    isFsSwiping = false;
    
    let touchEndX = e.changedTouches[0].screenX;
    let touchEndY = e.changedTouches[0].screenY;
    
    let deltaX = touchEndX - touchStartX;
    let deltaY = touchEndY - touchStartY;
    
    // Déterminer l'axe dominant du balayage
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      // Balayage horizontal (Changer de musique)
      if (Math.abs(deltaX) > 60) {
        if (deltaX > 0) {
          playPrev(); // Glisser vers la droite = Précédent
        } else {
          playNext(); // Glisser vers la gauche = Suivant
        }
      }
    } else {
      // Balayage vertical (Fermer)
      if (deltaY > 70) { // Glisser vers le bas = Fermer
        dom.playerBar.classList.remove('fs-active');
        document.body.style.overflow = '';
      }
    }
  });
}

// Controls
dom.playBtn.addEventListener('click', playPause);
dom.nextBtn.addEventListener('click', playNext);
dom.prevBtn.addEventListener('click', playPrev);

dom.shuffleBtn.addEventListener('click', () => {
  state.shuffle = !state.shuffle;
  dom.shuffleBtn.classList.toggle('active', state.shuffle);
});

dom.repeatBtn.addEventListener('click', () => {
  const modes = ['none', 'all', 'one'];
  const idx = modes.indexOf(state.repeatMode);
  state.repeatMode = modes[(idx + 1) % modes.length];
  dom.repeatBtn.classList.toggle('active', state.repeatMode !== 'none');
  dom.repeatBtn.title = { none: 'Répétition désactivée', all: 'Répéter tout', one: 'Répéter ce titre' }[state.repeatMode];
});

// Keyboard shortcuts
document.addEventListener('keydown', e => {
  if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
  if (e.code === 'Space') { e.preventDefault(); playPause(); }
  if (e.code === 'ArrowRight') audio.currentTime = Math.min(audio.duration, audio.currentTime + 10);
  if (e.code === 'ArrowLeft')  audio.currentTime = Math.max(0, audio.currentTime - 10);
  if (e.code === 'ArrowUp')    { audio.volume = Math.min(1, audio.volume + 0.1); dom.volumeSlider.value = audio.volume * 100; }
  if (e.code === 'ArrowDown')  { audio.volume = Math.max(0, audio.volume - 0.1); dom.volumeSlider.value = audio.volume * 100; }
});

// ═══════════════════════════════════════════════════
//  Media Session API (lock screen controls)
// ═══════════════════════════════════════════════════

function updateMediaSession(track) {
  if (!('mediaSession' in navigator)) return;

  navigator.mediaSession.metadata = new MediaMetadata({
    title:  track.title,
    artist: track.artist,
    album:  track.album,
    artwork: track.has_cover
      ? [{ src: `/api/tracks/${track.id}/cover`, sizes: '512x512', type: 'image/jpeg' }]
      : [{ src: '/static/icons/icon-512.png', sizes: '512x512', type: 'image/png' }],
  });

  navigator.mediaSession.setActionHandler('play',          () => audio.play());
  navigator.mediaSession.setActionHandler('pause',         () => audio.pause());
  navigator.mediaSession.setActionHandler('previoustrack', () => playPrev());
  navigator.mediaSession.setActionHandler('nexttrack',     () => playNext());
  navigator.mediaSession.setActionHandler('seekto', d => {
    if (d.fastSeek && 'fastSeek' in audio) { audio.fastSeek(d.seekTime); }
    else { audio.currentTime = d.seekTime; }
  });
}

audio.addEventListener('play', () => {
  if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
});
audio.addEventListener('pause', () => {
  if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
});

// ═══════════════════════════════════════════════════
//  Socket.IO — Temps réel
// ═══════════════════════════════════════════════════

socket.on('track_added', track => {
  if (!state.tracks.find(t => t.id === track.id)) {
    state.tracks.unshift(track);
    applyFilter();
  }
});

socket.on('track_removed', ({ id }) => {
  state.tracks = state.tracks.filter(t => t.id !== id);
  applyFilter();
});

socket.on('connect', () => {
  const badge = document.getElementById('live-badge');
  if (badge) badge.style.display = 'inline-flex';
});

socket.on('disconnect', () => {
  const badge = document.getElementById('live-badge');
  if (badge) badge.style.display = 'none';
});

// yt_progress : suivi des téléchargements YouTube
const ytItems = {}; // keyed by title

socket.on('yt_progress', data => {
  const list = document.getElementById('yt-download-list');
  if (!list) return;

  if (data.status === 'rename') {
    let oldItem = ytItems[data.old_title];
    if (oldItem) {
      ytItems[data.new_title] = oldItem;
      delete ytItems[data.old_title];
      const nameEl = oldItem.querySelector('.upload-item-name');
      if (nameEl) nameEl.textContent = data.new_title;
    }
    return;
  }

  let item = ytItems[data.title];

  if (data.status === 'starting') {
    item = createYtItem(data.title);
    ytItems[data.title] = item;
    list.prepend(item);
  }

  if (!item) return;

  const status = item.querySelector('.upload-item-status');

  if (data.status === 'done') {
    if (status) { 
      status.textContent = 'Téléchargé'; 
      status.className = 'upload-item-status status-done'; 
    }
    
    // Remplacer l'icône par un check vert
    const svg = item.querySelector('svg');
    if (svg) {
      svg.outerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="min-width: 20px; height: 20px;"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`;
    }
    
    showToast(`Le son "${data.title}" est téléchargé`, 'success', 5000);
    
    // Supprimer la ligne après 5 secondes pour nettoyer l'interface
    setTimeout(() => {
      if (item && item.parentNode) {
        item.style.opacity = '0';
        item.style.transition = 'opacity 0.4s';
        setTimeout(() => item.remove(), 400);
      }
    }, 5000);
    
    delete ytItems[data.title];
  }

  if (data.status === 'error') {
    if (status) { status.textContent = 'Erreur'; status.className = 'upload-item-status status-error'; }
    showToast('Erreur YouTube : ' + (data.message || 'inconnu'), 'error', 5000);
  }
});


// ═══════════════════════════════════════════════════
//  Upload
// ═══════════════════════════════════════════════════

function setupUpload() {
  const zone = dom.dropZone;
  if (!zone) return;

  zone.addEventListener('dragover', e => {
    e.preventDefault();
    zone.classList.add('drag-over');
  });

  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));

  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    const files = Array.from(e.dataTransfer.files).filter(f => isAudio(f.name));
    if (files.length) uploadFiles(files);
  });

  dom.fileInput.addEventListener('change', () => {
    const files = Array.from(dom.fileInput.files);
    if (files.length) uploadFiles(files);
    dom.fileInput.value = '';
  });

  document.getElementById('pick-files-btn')?.addEventListener('click', () => dom.fileInput.click());
}

function isAudio(filename) {
  return /\.(mp3|flac|ogg|aac|m4a|wav)$/i.test(filename);
}

async function uploadFiles(files) {
  for (const file of files) {
    const item = createUploadItem(file.name);
    dom.uploadList.prepend(item);

    const formData = new FormData();
    formData.append('files[]', file);

    try {
      item.querySelector('.upload-item-status').textContent = 'Upload...';
      item.querySelector('.upload-item-status').className = 'upload-item-status status-uploading';

      // Simulate progress with XHR for real progress
      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/upload');

        xhr.upload.onprogress = e => {
          if (e.lengthComputable) {
            const pct = Math.round((e.loaded / e.total) * 100);
            const fill = item.querySelector('.upload-progress-fill');
            if (fill) fill.style.width = pct + '%';
          }
        };

        xhr.onload = () => {
          if (xhr.status === 200) resolve(JSON.parse(xhr.responseText));
          else reject(new Error('Upload failed'));
        };
        xhr.onerror = reject;
        xhr.send(formData);
      });

      const fill = item.querySelector('.upload-progress-fill');
      if (fill) fill.style.width = '100%';
      item.querySelector('.upload-item-status').textContent = 'Ajouté';
      item.querySelector('.upload-item-status').className = 'upload-item-status status-done';
    } catch (e) {
      item.querySelector('.upload-item-status').textContent = 'Erreur';
      item.querySelector('.upload-item-status').className = 'upload-item-status status-error';
    }
  }
}

function createUploadItem(filename) {
  const div = document.createElement('div');
  div.className = 'upload-item';
  div.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
    <span class="upload-item-name">${escHtml(filename)}</span>
    <span class="upload-item-status status-uploading">En attente…</span>
    <div class="upload-progress-bar"><div class="upload-progress-fill" style="width:0%"></div></div>
  `;
  return div;
}

function createYtItem(title) {
  const div = document.createElement('div');
  div.className = 'upload-item yt-item';
  div.style.alignItems = 'center';
  div.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="min-width: 20px; height: 20px;"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46a2.78 2.78 0 0 0-1.95 1.96A29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58A2.78 2.78 0 0 0 3.41 19.6C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.95A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z"/><polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02"/></svg>
    <span class="upload-item-name" style="flex: 1; margin: 0 10px;">${escHtml(title)}</span>
    <span class="upload-item-status status-uploading" style="margin-left: auto;">En cours…</span>
  `;
  return div;
}

// ═══════════════════════════════════════════════════
//  YouTube Download
// ═══════════════════════════════════════════════════

function setupYoutube() {
  const btn   = document.getElementById('yt-download-btn');
  const input = document.getElementById('yt-url-input');
  if (!btn || !input) return;

  async function triggerDownload() {
    const url = input.value.trim();
    if (!url) { showToast('Colle une URL YouTube valide', 'error'); return; }

    btn.disabled = true;
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="15" height="15"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 12"/></svg> En cours…`;

    try {
      const res = await fetch('/api/youtube', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (data.error) {
        showToast('Erreur : ' + data.error, 'error');
      } else {
        input.value = '';
      }
    } catch (e) {
      showToast('Erreur réseau', 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="15" height="15"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Télécharger`;
    }
  }

  btn.addEventListener('click', triggerDownload);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') triggerDownload(); });
}


// ═══════════════════════════════════════════════════
//  Navigation (views)
// ═══════════════════════════════════════════════════

function switchView(name) {
  state.currentView = name;
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-btn, .bottom-nav-btn').forEach(b => b.classList.remove('active'));

  document.getElementById(`view-${name}`)?.classList.add('active');
  document.querySelectorAll(`[data-view="${name}"]`).forEach(b => b.classList.add('active'));
}

document.querySelectorAll('[data-view]').forEach(btn => {
  btn.addEventListener('click', () => switchView(btn.dataset.view));
});

// ═══════════════════════════════════════════════════
//  Search
// ═══════════════════════════════════════════════════

dom.searchInput.addEventListener('input', applyFilter);

// ═══════════════════════════════════════════════════
//  Toast Notifications
// ═══════════════════════════════════════════════════

function showToast(msg, type = 'info', duration = 3000) {
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  dom.toastWrap.appendChild(t);
  setTimeout(() => t.remove(), duration);
}

// ═══════════════════════════════════════════════════
//  Utils
// ═══════════════════════════════════════════════════

function formatTime(s) {
  if (!s || isNaN(s)) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ═══════════════════════════════════════════════════
//  Service Worker (PWA)
// ═══════════════════════════════════════════════════

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/static/js/sw.js')
    .then(() => console.log('[KMusic] Service Worker enregistré'))
    .catch(e => console.warn('[KMusic] SW error:', e));
}

// ═══════════════════════════════════════════════════
//  Init
// ═══════════════════════════════════════════════════

(async () => {
  setupUpload();
  setupYoutube();
  await loadTracks();
  switchView('library');
  dom.volumeSlider.value = 80;
  audio.volume = 0.8;
})();
