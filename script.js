const audio = document.getElementById('audio'), statusFunc = document.getElementById('status-function'), statusCenter = document.getElementById('status-center'), fileInfoLine = document.getElementById('file-info-line'), formatInfo = document.getElementById('format-info'), fileIn = document.getElementById('file-in'), canvas = document.getElementById('vu-meter'), ctx = canvas.getContext('2d'), m1 = document.getElementById('m1'), m2 = document.getElementById('m2'), s1 = document.getElementById('s1'), s2 = document.getElementById('s2'), modalImg = document.getElementById('modalImg');

let statusCenterTimer = null;
function showCenter(msg, delay = 1800) {
    statusCenter.textContent = msg;
    clearTimeout(statusCenterTimer);
    statusCenterTimer = setTimeout(() => { statusCenter.textContent = ''; }, delay);
}

(function initVUOff() {
    ctx.clearRect(0, 0, 800, 70);
    ctx.font = "500 14px 'Inter', sans-serif"; ctx.textBaseline = "middle";
    ctx.fillStyle = "#1a1a1a"; ctx.fillText("L", 18, 17); ctx.fillText("R", 18, 52);
    const ledH = 18, ledStep = 18, ledsPerSeg = 1;
    for (let i = 0; i < 25; i++) {
        for (let l = 0; l < ledsPerSeg; l++) {
            ctx.fillStyle = "#111";
            ctx.fillRect(60 + i * 28, 8 + l * ledStep, 25, ledH);
            ctx.fillRect(60 + i * 28, 43 + l * ledStep, 25, ledH);
        }
    }
})();

audio.volume = 0.2;
let playlist = [], currentIndex = 0, audioCtx, analyser, dataArray, timeMode = 'elapsed', vuVisible = true, repeatMode = 0, isShuffle = false, pointA = null, pointB = null, lastVolume = 0, digitEntry = "", digitTimeout = null, musicScanActive = false, musicScanTimer = null;

const durationCache = new Map(); // key: file.name+'|'+file.size → duration in seconds
function fileKey(f) { return f.name + '|' + f.size; }

let _vfdColorCache = {};
function getVFDColor(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
function invalidateColorCache() { _vfdColorCache = {}; }
function getVFDColorCached(name) {
    if (_vfdColorCache[name] === undefined) _vfdColorCache[name] = getVFDColor(name);
    return _vfdColorCache[name];
}

let isMuted = false;
function updateStatusText() { if (digitEntry !== "") return; if (playlist.length === 0) { statusFunc.innerText = "NO TRACK"; return; } if (isMuted) { statusFunc.innerText = "MUTE"; return; } statusFunc.innerText = audio.paused ? (audio.currentTime === 0 ? "■ STOP" : "‖ PAUSE") : "▶ PLAY"; }
function toggleMute() { isMuted = !isMuted; audio.muted = isMuted; updateStatusText(); }
function updateEjectAnimation() { const btn = document.querySelector('.btn-open'); if (btn) btn.classList.toggle('no-track', playlist.length === 0); }
const coverCache = {};
const metaCache = {}; // { filename: { title, album, artist } }

function getFileCover(file, callback) {
    if (coverCache[file.name] !== undefined) { callback(coverCache[file.name]); return; }
    try {
        jsmediatags.read(file, {
            onSuccess: (tag) => {
                const t = tag.tags;
                const pic = t.picture;

                if (!metaCache[file.name]) {
                    metaCache[file.name] = {
                        title: t.title || file.name.replace(/\.[^.]+$/, ''),
                        album: t.album || '',
                        artist: t.artist || '',
                        track: t.track || ''
                    };
                }
                if (pic) {
                    const blob = new Blob([new Uint8Array(pic.data)], { type: pic.format });
                    const url = URL.createObjectURL(blob);
                    coverCache[file.name] = url;
                    callback(url);
                } else {
                    coverCache[file.name] = null;
                    callback(null);
                }
            },
            onError: () => { coverCache[file.name] = null; callback(null); }
        });
    } catch (e) { callback(null); }
}

function renderPlaylistItems() {
    const container = document.getElementById('playlist-items-container');
    // Smart update: if item count matches, just update active class
    const existing = container.querySelectorAll('.playlist-item');
    if (existing.length === playlist.length) {
        existing.forEach((el, i) => {
            el.classList.toggle('active', i === currentIndex);
        });
        return;
    }
    container.innerHTML = '';
    playlist.forEach((file, index) => {
        const item = document.createElement('div');
        item.className = 'playlist-item' + (index === currentIndex ? ' active' : '');
        item.dataset.index = index;

        const cover = document.createElement('img');
        cover.className = 'playlist-item-cover';
        cover.src = 'img/technics_cover.png';
        if (coverCache[file.name]) {
            cover.src = coverCache[file.name] || 'img/technics_cover.png';
        } else {
            getFileCover(file, (url) => { if (url) cover.src = url; });
        }

        const info = document.createElement('div');
        info.className = 'playlist-item-info';

        const rowTop = document.createElement('div');
        rowTop.className = 'playlist-item-row-top';

        const num = document.createElement('span');
        num.className = 'playlist-item-num';
        num.textContent = String(index + 1).padStart(2, '0');

        const titleEl = document.createElement('span');
        titleEl.className = 'playlist-item-name';
        const meta = metaCache[file.name];
        titleEl.textContent = (meta ? meta.title : file.name.replace(/\.[^.]+$/, '')).toUpperCase();

        rowTop.appendChild(num);
        rowTop.appendChild(titleEl);

        const albumEl = document.createElement('span');
        albumEl.className = 'playlist-item-album';
        albumEl.textContent = (meta && meta.album ? meta.album : '\u2014').toUpperCase();

        const artistEl = document.createElement('span');
        artistEl.className = 'playlist-item-artist';
        artistEl.textContent = (meta && meta.artist ? meta.artist : '\u2014').toUpperCase();

        if (!meta) {
            getFileCover(file, () => {
                const m = metaCache[file.name];
                if (m) {
                    titleEl.textContent = m.title.toUpperCase();
                    albumEl.textContent = (m.album || '\u2014').toUpperCase();
                    artistEl.textContent = (m.artist || '\u2014').toUpperCase();
                }
            });
        }

        info.appendChild(rowTop);
        info.appendChild(albumEl);
        info.appendChild(artistEl);

        const removeBtn = document.createElement('button');
        removeBtn.className = 'playlist-item-remove';
        removeBtn.innerHTML = '\u2715';
        removeBtn.title = 'Remove';
        removeBtn.onclick = (e) => {
            e.stopPropagation();
            removeTrack(index);
        };

        item.appendChild(cover);
        item.appendChild(info);
        item.appendChild(removeBtn);
        item.onclick = () => { playDirect(index); };
        container.appendChild(item);
    });
}

function revokeCoverCache() {
    Object.values(coverCache).forEach(url => { if (url && url.startsWith('blob:')) URL.revokeObjectURL(url); });
    for (const k in coverCache) delete coverCache[k];
    for (const k in metaCache) delete metaCache[k];
}
function removeTrack(index) {
    const wasPlaying = !audio.paused;
    playlist.splice(index, 1);
    if (playlist.length === 0) {
        audio.pause(); audio.src = '';
        currentIndex = 0;
        revokeCoverCache();
        updateStatusText();
        updateEjectAnimation();
        updateTotalTime();
        closePlaylist();
        return;
    }
    if (index < currentIndex) {
        currentIndex--;
    } else if (index === currentIndex) {
        currentIndex = Math.min(currentIndex, playlist.length - 1);
        loadTrack(currentIndex);
        if (wasPlaying) handlePlay();
    }
    renderPlaylistItems();
    updateTotalTime();
}

function openPlaylist() {
    const modal = document.getElementById('playlistModal');
    if (modal.classList.contains('open')) { closePlaylist(); return; }
    renderPlaylistItems();
    modal.classList.add('open');
}

function closePlaylist() {
    document.getElementById('playlistModal').classList.remove('open');
}

function cacheDurations(files, callback) {
    let pending = files.length;
    if (!pending) { if (callback) callback(); return; }
    files.forEach(f => {
        const key = fileKey(f);
        if (durationCache.has(key)) {
            if (--pending === 0 && callback) callback();
            return;
        }
        const tmp = new Audio();
        const url = URL.createObjectURL(f);
        let done = false;
        const finish = () => {
            if (done) return;
            done = true;
            const dur = isFinite(tmp.duration) && tmp.duration > 0 ? tmp.duration : 0;
            durationCache.set(key, dur);
            tmp.src = '';
            URL.revokeObjectURL(url);
            if (--pending === 0 && callback) callback();
        };
        tmp.ondurationchange = finish;
        tmp.onloadedmetadata = finish;
        tmp.onerror = () => {
            if (done) return;
            done = true;
            durationCache.set(key, 0);
            tmp.src = '';
            URL.revokeObjectURL(url);
            if (--pending === 0 && callback) callback();
        };
        tmp.preload = 'metadata';
        tmp.src = url;
    });
}

function playlistAddFiles(input) {
    const files = Array.from(input.files);
    if (!files.length) return;
    if (playlist.length > 0) {
        playlist.push(...files);
        showCenter(`+${files.length} TRACK${files.length > 1 ? 'S' : ''}`);
        setTimeout(updateStatusText, 1500);
        updateTrackDisplay();
    } else {
        playlist = files;
        currentIndex = 0;
        loadTrack(0);
        handlePlay();
    }
    cacheDurations(playlist, updateTotalTime);
    renderPlaylistItems();
    updateEjectAnimation();
    input.value = '';
}

// Draggable + resizable popup
(function initPlaylistDrag() {
    const modal = document.getElementById('playlistModal');
    const handle = document.getElementById('playlistDragHandle');
    const resizeHandle = document.getElementById('playlistResizeHandle');
    let dragging = false, resizing = false, ox = 0, oy = 0, startW = 0, startX = 0;

    handle.addEventListener('mousedown', (e) => {
        dragging = true;
        const rect = modal.getBoundingClientRect();
        modal.style.left = rect.left + 'px';
        modal.style.top = rect.top + 'px';
        modal.style.transform = 'none';
        ox = e.clientX - rect.left;
        oy = e.clientY - rect.top;
        e.preventDefault();
    });

    resizeHandle.addEventListener('mousedown', (e) => {
        resizing = true;
        const rect = modal.getBoundingClientRect();
        // Fix position before resizing
        modal.style.left = rect.left + 'px';
        modal.style.top = rect.top + 'px';
        modal.style.transform = 'none';
        startW = rect.width;
        startX = e.clientX;
        e.preventDefault();
        e.stopPropagation();
    });

    document.addEventListener('mousemove', (e) => {
        if (dragging) {
            let x = e.clientX - ox;
            let y = e.clientY - oy;
            x = Math.max(0, Math.min(window.innerWidth - modal.offsetWidth, x));
            y = Math.max(0, Math.min(window.innerHeight - modal.offsetHeight, y));
            modal.style.left = x + 'px';
            modal.style.top = y + 'px';
        }
        if (resizing) {
            const newW = Math.max(280, Math.min(window.innerWidth * 0.95, startW + (e.clientX - startX)));
            modal.style.width = newW + 'px';
        }
    });

    document.addEventListener('mouseup', () => { dragging = false; resizing = false; });
})();

function pressDigit(num) { clearTimeout(digitTimeout); digitEntry += num; showCenter("SELECT: " + digitEntry, 1500); digitTimeout = setTimeout(() => { playDirect(parseInt(digitEntry) - 1); }, 1200); }
function playDirect(index) { digitEntry = ""; if (playlist.length > index && index >= 0) { currentIndex = index; loadTrack(currentIndex); handlePlay(); } else { statusFunc.innerText = "EMPTY"; setTimeout(updateStatusText, 1000); } }

fileIn.onchange = (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    if (playlist.length > 0) {
        playlist.push(...files);
        showCenter(`+${files.length} TRACK${files.length > 1 ? 'S' : ''}`);
        setTimeout(updateStatusText, 1500);
        updateTrackDisplay();
    } else {
        playlist = files;
        currentIndex = 0;
        loadTrack(0);
        handlePlay();
    }
    cacheDurations(playlist, updateTotalTime);
    renderPlaylistItems();
    updateEjectAnimation();
    e.target.value = '';
};

function loadTrack(index) {
    const file = playlist[index];
    if (audio.src) URL.revokeObjectURL(audio.src);
    audio.src = URL.createObjectURL(file);
    formatInfo.innerText = file.name.split('.').pop().toUpperCase();
    if (document.getElementById('playlistModal').classList.contains('open')) renderPlaylistItems();
    const _applyMeta = (meta, picture) => {
        metaCache[file.name] = meta;
        if (document.getElementById('playlistModal').classList.contains('open')) renderPlaylistItems();
        fileInfoLine.innerText = `${meta.artist || "UNKNOWN"} - ${meta.album || "UNKNOWN"} - ${meta.title || file.name}`.toUpperCase();
        if (picture) {
            const { data, format } = picture; let base64 = "";
            for (let i = 0; i < data.length; i++) base64 += String.fromCharCode(data[i]);
            modalImg.src = `data:${format};base64,${window.btoa(base64)}`;
            coverCache[file.name] = modalImg.src;
        } else { modalImg.src = "img/technics_cover.png"; }
        updateMediaSession({ title: meta.title || file.name, artist: meta.artist || 'Unknown Artist', album: meta.album || 'Unknown Album' });
    };

    if (metaCache[file.name]) {
        // Use cached metadata — skip jsmediatags read
        const meta = metaCache[file.name];
        fileInfoLine.innerText = `${meta.artist || "UNKNOWN"} - ${meta.album || "UNKNOWN"} - ${meta.title}`.toUpperCase();
        if (coverCache[file.name]) modalImg.src = coverCache[file.name];
        updateMediaSession({ title: meta.title, artist: meta.artist || 'Unknown Artist', album: meta.album || 'Unknown Album' });
    } else if (window.jsmediatags) {
        window.jsmediatags.read(file, {
            onSuccess: (tag) => {
                const t = tag.tags;
                _applyMeta({
                    title: t.title || file.name.replace(/\.[^.]+$/, ''),
                    album: t.album || '',
                    artist: t.artist || '',
                    track: t.track || ''
                }, t.picture || null);
            },
            onError: () => {
                fileInfoLine.innerText = file.name.toUpperCase();
                updateMediaSession({ title: file.name, artist: 'Unknown Artist', album: 'Unknown Album' });
            }
        });
    }
    updateTrackDisplay(); audio.load();
}

function updateMediaSession(metadata = {}) {
    if (!('mediaSession' in navigator)) return;

    navigator.mediaSession.metadata = new MediaMetadata({
        title: metadata.title || fileInfoLine.innerText.split(' - ')[2] || 'Unknown Title',
        artist: metadata.artist || fileInfoLine.innerText.split(' - ')[0] || 'Unknown Artist',
        album: metadata.album || fileInfoLine.innerText.split(' - ')[1] || 'Unknown Album',
        artwork: [
            {
                src: modalImg.src || 'img/technics_cover.png',
                sizes: '512x512',
                type: 'image/png'
            }
        ]
    });

    navigator.mediaSession.setActionHandler('play', () => handlePlay());
    navigator.mediaSession.setActionHandler('pause', () => handlePause());
    navigator.mediaSession.setActionHandler('stop', () => handleStop());
    navigator.mediaSession.setActionHandler('previoustrack', () => prevTrack());
    navigator.mediaSession.setActionHandler('nexttrack', () => nextTrack());
    navigator.mediaSession.setActionHandler('seekbackward', (details) => {
        audio.currentTime = Math.max(
            0,
            audio.currentTime - (details.seekOffset || 10)
        );
    });
    navigator.mediaSession.setActionHandler('seekforward', (details) => {
        audio.currentTime = Math.min(
            audio.duration || Infinity,
            audio.currentTime + (details.seekOffset || 10)
        );
    });
    navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime != null) {
            audio.currentTime = details.seekTime;
        }
    });
}

audio.addEventListener('timeupdate', () => {
    if ('mediaSession' in navigator && audio.duration) {
        navigator.mediaSession.setPositionState({
            duration: audio.duration,
            playbackRate: audio.playbackRate,
            position: audio.currentTime
        });
    }
});

let pauseBlinkInterval = null;
function startPauseBlink() { if (pauseBlinkInterval) return; const timer = document.getElementById('timer'); let visible = true; pauseBlinkInterval = setInterval(() => { visible = !visible; timer.style.visibility = visible ? 'visible' : 'hidden'; }, 500); }
function stopPauseBlink() { if (pauseBlinkInterval) { clearInterval(pauseBlinkInterval); pauseBlinkInterval = null; } document.getElementById('timer').style.visibility = 'visible'; }

function handlePlay() {
    if (playlist.length > 0) {
        if (!audioCtx) initAudio();
        stopPauseBlink();
        if (musicScanActive) {
            musicScanActive = false;
            clearTimeout(musicScanTimer);
            document.getElementById('ind-musicscan').classList.remove('active');
        }
        audio.play().then(updateStatusText);
    }
}
function handlePause() { audio.pause(); updateStatusText(); if (audio.currentTime > 0) startPauseBlink(); }
function handleStop() { audio.pause(); audio.currentTime = 0; updateStatusText(); stopPauseBlink(); pointA = pointB = null; document.getElementById('ind-ab').classList.remove('active', 'ab-waiting', 'ab-active'); }
function nextTrack() { if (!playlist.length) return; currentIndex = isShuffle ? Math.floor(Math.random() * playlist.length) : (currentIndex + 1) % playlist.length; loadTrack(currentIndex); handlePlay(); }
function prevTrack() { if (!playlist.length) return; if (audio.currentTime > 3) { audio.currentTime = 0; if (audio.paused) handlePlay(); } else { currentIndex = (currentIndex - 1 + playlist.length) % playlist.length; loadTrack(currentIndex); handlePlay(); } }
audio.onended = () => {
    clearTimeout(musicScanTimer);
    if (repeatMode === 1) { audio.currentTime = 0; audio.play(); }
    else if (repeatMode === 2) { nextTrack(); }
    else {
        if (currentIndex < playlist.length - 1) {
            currentIndex++;
            loadTrack(currentIndex);
            handlePlay();
        } else {
            audio.currentTime = 0;
            updateStatusText();
        }
    }
};
audio.onloadedmetadata = () => {
    if (playlist[currentIndex] && isFinite(audio.duration) && audio.duration > 0) {
        durationCache.set(fileKey(playlist[currentIndex]), audio.duration);
        updateTotalTime();
    }
};

audio.ontimeupdate = () => {
    if (pointA !== null && pointB !== null && audio.currentTime >= pointB) audio.currentTime = pointA;
    const t = audio.currentTime;
    const mm = Math.floor(Math.max(0, t / 60)).toString().padStart(2, '0');
    const ss = Math.floor(Math.max(0, t % 60)).toString().padStart(2, '0');
    m1.innerText = mm[0]; m2.innerText = mm[1]; s1.innerText = ss[0]; s2.innerText = ss[1];
    document.getElementById('time-sign').innerText = '\u00a0';
    updateTotalTimeRemaining(); updateTrackRemaining();
};

function updateTrackRemaining() {
    const rem = audio.duration && isFinite(audio.duration) ? Math.max(0, audio.duration - audio.currentTime) : 0;
    const mm = Math.floor(rem / 60).toString().padStart(2, '0');
    const ss = Math.floor(rem % 60).toString().padStart(2, '0');
    const el = (id) => document.getElementById(id);
    if (!el('tr-m1')) return;
    el('tr-m1').innerText = mm[0];
    el('tr-m2').innerText = mm[1];
    el('tr-s1').innerText = ss[0];
    el('tr-s2').innerText = ss[1];
}

function getTotalPlaylistDuration() {
    return playlist.reduce((sum, f, i) => {
        let d = durationCache.get(fileKey(f)) || 0;
        if (d === 0 && i === currentIndex && audio.duration && isFinite(audio.duration)) {
            d = audio.duration;
        }
        return sum + d;
    }, 0);
}

function formatHMS(secs) {
    const s = Math.floor(Math.max(0, secs));
    const hh = Math.floor(s / 3600).toString().padStart(2, '0');
    const mm = Math.floor((s % 3600) / 60).toString().padStart(2, '0');
    const ss = (s % 60).toString().padStart(2, '0');
    return { hh, mm, ss };
}

function setTotalDisplay(ids, hh, mm, ss) {
    const el = (id) => document.getElementById(id);
    if (!el(ids.h1)) return;
    el(ids.h1).innerText = hh[0];
    el(ids.h2).innerText = hh[1];
    el(ids.m1).innerText = mm[0];
    el(ids.m2).innerText = mm[1];
    el(ids.s1).innerText = ss[0];
    el(ids.s2).innerText = ss[1];
}

function updateTotalTime() {
    const total = getTotalPlaylistDuration();
    const { hh, mm, ss } = formatHMS(total);
    setTotalDisplay(
        { h1: 'tt-h1', h2: 'tt-h2', m1: 'tt-m1', m2: 'tt-m2', s1: 'tt-s1', s2: 'tt-s2' },
        hh, mm, ss
    );
    updateTotalTimeRemaining();
}

function updateTotalTimeRemaining() {
    const total = getTotalPlaylistDuration();
    const elapsed = playlist.slice(0, currentIndex).reduce((s, f) => s + (durationCache.get(fileKey(f)) || 0), 0) + (audio.currentTime || 0);
    const rem = Math.max(0, total - elapsed);
    const { hh, mm, ss } = formatHMS(rem);
    const el = (id) => document.getElementById(id);
    if (!el('tt-rem-h1')) return;
    el('tt-rem-sign').innerText = '-';
    setTotalDisplay(
        { h1: 'tt-rem-h1', h2: 'tt-rem-h2', m1: 'tt-rem-m1', m2: 'tt-rem-m2', s1: 'tt-rem-s1', s2: 'tt-rem-s2' },
        hh, mm, ss
    );
}


let analyserL, analyserR, dataArrayL, dataArrayR, bassFilter, trebleFilter, loudnessGain, channelMerger, splitter, pannerNode;
let balanceLevel = 0;
let lastVolL = 0, lastVolR = 0;
let peakL = 0, peakR = 0, peakTimerL = 0, peakTimerR = 0;
let bassLevel = 0, trebleLevel = 0, loudnessOn = false, monoOn = false;
let isBypass = false, bypassSnapshot = null;

function toggleBypass() {
    if (!audioCtx) return;
    isBypass = !isBypass;

    if (isBypass) {
        document.getElementById('ind-bypass').classList.add('active');
        bypassSnapshot = { gains: [...eqGains], loudness: loudnessOn };
        eqFilters.forEach(f => f.gain.setTargetAtTime(0, audioCtx.currentTime, 0.05));
        loudnessGain.gain.setTargetAtTime(1, audioCtx.currentTime, 0.05);
        document.getElementById('ind-loudness').classList.remove('active');
    } else {
        if (bypassSnapshot) {
            applyEQGains(bypassSnapshot.gains, true);
            if (bypassSnapshot.loudness) {
                loudnessGain.gain.setTargetAtTime(1.5, audioCtx.currentTime, 0.05);
                document.getElementById('ind-loudness').classList.add('active');
            }
            loudnessOn = bypassSnapshot.loudness;
        }
        document.getElementById('ind-bypass').classList.remove('active');
    }
    const btn = document.querySelector('[onclick="toggleBypass()"]');
    if (btn) btn.style.color = isBypass ? 'var(--vfd-main)' : '';
    setTimeout(updateStatusText, 1500);
}

let specAnalyser, specDataArray, specCtx;

function initAudio() {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioCtx.createMediaElementSource(audio);
    // Splitter stereo
    splitter = audioCtx.createChannelSplitter(2);
    analyserL = audioCtx.createAnalyser(); analyserL.fftSize = 64;
    analyserR = audioCtx.createAnalyser(); analyserR.fftSize = 64;
    dataArrayL = new Uint8Array(analyserL.frequencyBinCount);
    dataArrayR = new Uint8Array(analyserR.frequencyBinCount);
    // Spectrum analyser (higher resolution, pre-EQ for accuracy)
    specAnalyser = audioCtx.createAnalyser();
    specAnalyser.fftSize = 256;
    specAnalyser.smoothingTimeConstant = 0.75;
    specDataArray = new Uint8Array(specAnalyser.frequencyBinCount);
    // 10-band EQ filters
    const filters = initEQFilters();
    // Keep bassFilter/trebleFilter pointing to first/last for bypass compatibility
    bassFilter = filters[0];
    trebleFilter = filters[9];
    // Override frequencies for bass/treble tone controls to audible ranges
    // (EQ band 0 = 32Hz lowshelf is inaudible on most speakers)
    bassFilter.frequency.value = 200;    // standard hi-fi bass shelf
    trebleFilter.frequency.value = 10000; // standard hi-fi treble shelf
    // Loudness gain
    loudnessGain = audioCtx.createGain(); loudnessGain.gain.value = 1;
    // Balance panner
    pannerNode = audioCtx.createStereoPanner(); pannerNode.pan.value = 0;
    // Mono merger
    channelMerger = audioCtx.createChannelMerger(2);
    // Signal chain: source → eq0 → eq1 → … → eq9 → loudness → panner → splitter
    source.connect(filters[0]);
    for (let i = 0; i < filters.length - 1; i++) filters[i].connect(filters[i + 1]);
    filters[filters.length - 1].connect(loudnessGain);
    loudnessGain.connect(pannerNode);
    pannerNode.connect(splitter);
    splitter.connect(analyserL, 0);
    splitter.connect(analyserR, 1);
    splitter.connect(channelMerger, 0, 0);
    splitter.connect(channelMerger, 1, 1);
    channelMerger.connect(audioCtx.destination);

    loudnessGain.connect(specAnalyser);

    analyser = analyserL;
    dataArray = dataArrayL;
    startDrawLoop();
}

let _drawLoopRunning = false;
function startDrawLoop() {
    if (_drawLoopRunning) return;
    _drawLoopRunning = true;
    (function loop() {
        requestAnimationFrame(loop);
        if (!analyserL) return;
        if (vuVisible) drawVU(); else drawVUOff();
        if (spectrumVisible && specCtx) drawSpectrum();
    })();
}

function drawSpectrum() {
    const specCanvas = document.getElementById('spectrum-canvas');
    if (!specCanvas || !specCtx) return;

    const W = specCanvas.offsetWidth || 200;
    const H = specCanvas.offsetHeight || 80;
    if (specCanvas.width !== W) specCanvas.width = W;
    if (specCanvas.height !== H) specCanvas.height = H;

    specCtx.clearRect(0, 0, W, H);

    if (!specAnalyser || !spectrumVisible) {
        const barCount = 28;
        const barW = Math.floor(W / barCount) - 2;
        const barGap = Math.floor(W / barCount) - barW;
        const ledH = 3, ledGap = 2, ledStep = ledH + ledGap;
        const ledCount = Math.floor(H / ledStep);
        for (let i = 0; i < barCount; i++) {
            const x = i * (barW + barGap);
            for (let l = 0; l < ledCount; l++) {
                const y = H - (l + 1) * ledStep;
                specCtx.fillStyle = '#111';
                specCtx.fillRect(x, y, barW, ledH);
            }
        }
        return;
    }

    specAnalyser.getByteFrequencyData(specDataArray);
    const mainColor = getVFDColorCached('--vfd-main');
    const barCount = 28;
    const usefulBins = 30;
    const step = usefulBins / barCount;

    const barW = Math.floor(W / barCount) - 2;
    const barGap = Math.floor(W / barCount) - barW;

    const ledH = 3;
    const ledGap = 2;
    const ledStep = ledH + ledGap;
    const ledCount = Math.floor(H / ledStep);

    if (!drawSpectrum.peaks) {
        drawSpectrum.peaks = new Array(barCount).fill(0);
        drawSpectrum.peakTimers = new Array(barCount).fill(0);
    }

    let cr = 176, cg = 254, cb = 255;
    const hex = mainColor.replace('#', '');
    if (hex.length === 6) {
        cr = parseInt(hex.slice(0, 2), 16);
        cg = parseInt(hex.slice(2, 4), 16);
        cb = parseInt(hex.slice(4, 6), 16);
    } else if (mainColor === '#ffffff' || mainColor === 'ffffff' || mainColor.toLowerCase() === 'white') {
        cr = cg = cb = 255;
    }

    for (let i = 0; i < barCount; i++) {
        let sum = 0;
        const start = Math.floor(i * step);
        const end = Math.max(start + 1, Math.floor((i + 1) * step));
        for (let j = start; j < end; j++) sum += specDataArray[j] || 0;
        const val = sum / (end - start);
        const activeLeds = Math.round((val / 255) * ledCount);
        const x = i * (barW + barGap);

        if (activeLeds >= drawSpectrum.peaks[i]) {
            drawSpectrum.peaks[i] = activeLeds;
            drawSpectrum.peakTimers[i] = 45;
        } else if (drawSpectrum.peakTimers[i] > 0) {
            drawSpectrum.peakTimers[i]--;
        } else {
            drawSpectrum.peaks[i] = Math.max(0, drawSpectrum.peaks[i] - 1);
        }

        const peakLed = drawSpectrum.peaks[i];

        for (let l = 0; l < ledCount; l++) {
            const y = H - (l + 1) * ledStep;
            if (l === peakLed && peakLed > 0) {
                // Peak LED — rouge
                specCtx.fillStyle = 'rgba(255, 60, 34, 0.9)';
            } else if (l < activeLeds) {
                specCtx.fillStyle = `rgba(${cr},${cg},${cb},0.9)`;
            } else {
                specCtx.fillStyle = '#111';
            }
            specCtx.fillRect(x, y, barW, ledH);
        }
    }
}

function drawVUOff() {
    ctx.clearRect(0, 0, 800, 70);
    ctx.font = "500 14px 'Inter', sans-serif";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#1a1a1a"; ctx.fillText("L", 18, 17);
    ctx.fillStyle = "#1a1a1a"; ctx.fillText("R", 18, 52);
    const ledH = 18, ledGap = 0, ledStep = 18;
    const ledsPerSeg = Math.floor(18 / ledStep);
    for (let i = 0; i < 25; i++) {
        for (let l = 0; l < ledsPerSeg; l++) {
            ctx.fillStyle = "#111";
            ctx.fillRect(60 + i * 28, 8 + l * ledStep, 25, ledH);
            ctx.fillRect(60 + i * 28, 43 + l * ledStep, 25, ledH);
        }
    }
}

function drawVU() {
    if (!analyserL) return;

    if (!vuVisible) { drawVUOff(); return; }

    analyserL.getByteFrequencyData(dataArrayL);
    analyserR.getByteFrequencyData(dataArrayR);

    let sumL = 0, sumR = 0;
    for (let i = 0; i < 15; i++) { sumL += dataArrayL[i]; sumR += dataArrayR[i]; }
    let volL = Math.min(255, (sumL / 15) * vuGain), volR = Math.min(255, (sumR / 15) * vuGain);

    if (monoOn) { const avg = (volL + volR) / 2; volL = avg; volR = avg; }

    lastVolL = volL < lastVolL ? lastVolL - 5 : volL;
    lastVolR = volR < lastVolR ? lastVolR - 5 : volR;

    // Peak hold
    if (lastVolL >= peakL) { peakL = lastVolL; peakTimerL = 25; }
    else if (peakTimerL > 0) { peakTimerL--; } else { peakL = Math.max(0, peakL - 1.5); }
    if (lastVolR >= peakR) { peakR = lastVolR; peakTimerR = 25; }
    else if (peakTimerR > 0) { peakTimerR--; } else { peakR = Math.max(0, peakR - 1.5); }

    const mainColor = getVFDColorCached('--vfd-main'), redColor = getVFDColorCached('--vfd-red'), orangeColor = getVFDColorCached('--vfd-orange') || '#ff8800';
    ctx.clearRect(0, 0, 800, 70);
    ctx.font = "500 14px 'Inter', sans-serif";
    ctx.textBaseline = "middle";

    ctx.fillStyle = mainColor;
    ctx.fillText("L", 18, 17);
    ctx.fillText("R", 18, 52);

    let cr = 176, cg = 254, cb = 255;
    const hexC = mainColor.replace(/\s/g, '').replace('#', '');
    if (hexC.length === 6) { cr = parseInt(hexC.slice(0, 2), 16); cg = parseInt(hexC.slice(2, 4), 16); cb = parseInt(hexC.slice(4, 6), 16); }
    else if (hexC === 'ffffff' || mainColor.toLowerCase().includes('white')) { cr = cg = cb = 255; }

    const segCount = 25;
    const segW = 25, segH = 18, segSpacing = 28;
    const ledH = 18, ledGap = 0, ledStep = 18;
    const ledsPerSeg = Math.floor(segH / ledStep);

    for (let i = 0; i < segCount; i++) {
        const threshL = (i / segCount) * 255;
        const threshR = (i / segCount) * 255;
        const xPos = 60 + i * segSpacing;
        const ratio = i / (segCount - 1);

        for (let row = 0; row < 2; row++) {
            const yBase = row === 0 ? 8 : 43;
            const vol = row === 0 ? lastVolL : lastVolR;
            const active = vol > (row === 0 ? threshL : threshR);
            const isPeak = row === 0
                ? (i === Math.min(24, Math.floor((peakL / 255) * 25)) && peakL > 10)
                : (i === Math.min(24, Math.floor((peakR / 255) * 25)) && peakR > 10);

            for (let l = 0; l < ledsPerSeg; l++) {
                const yLed = yBase + l * ledStep;
                if (isPeak) {

                    ctx.fillStyle = `rgba(255,60,34,0.9)`;
                } else if (active) {
                    if (i > 21) {
                        ctx.fillStyle = `rgba(255,60,34,0.9)`;
                    } else if (i > 15) {
                        ctx.fillStyle = `rgba(255,136,0,0.9)`;
                    } else {
                        ctx.fillStyle = `rgba(${cr},${cg},${cb},0.9)`;
                    }
                } else {
                    ctx.fillStyle = '#111';
                }
                ctx.fillRect(xPos, yLed, segW, ledH);
            }
        }
    }
}

function applyMono() {
    if (!channelMerger || !splitter) return;
    try { splitter.disconnect(channelMerger, 0, 1); } catch (e) { }
    try { splitter.disconnect(channelMerger, 1, 1); } catch (e) { }
    if (monoOn) {
        splitter.connect(channelMerger, 0, 1); // L → R output (mono)
    } else {
        splitter.connect(channelMerger, 1, 1); // R → R output (stereo)
    }
}

let statusResetTimer = null;
function delayedStatusReset() { clearTimeout(statusResetTimer); statusResetTimer = setTimeout(updateStatusText, 2000); }

function toggleLoudness() {
    if (!audioCtx || isBypass) return;
    loudnessOn = !loudnessOn;
    loudnessGain.gain.setTargetAtTime(loudnessOn ? 1.5 : 1, audioCtx.currentTime, 0.05);
    const el = document.getElementById('ind-loudness');
    el.classList.toggle('active', loudnessOn);
    setTimeout(updateStatusText, 1200);
}

function toggleMono() {
    if (!audioCtx) return;
    monoOn = !monoOn;
    applyMono();
    const el = document.getElementById('ind-mono');
    el.classList.toggle('active', monoOn);
    setTimeout(updateStatusText, 1200);
}

function changeBass(d) {
    if (!bassFilter || isBypass) return;
    bassLevel = Math.min(12, Math.max(-12, bassLevel + d));
    bassFilter.gain.setTargetAtTime(bassLevel, audioCtx.currentTime, 0.05);
    eqGains[0] = bassLevel;
    drawEQCurve();
    showBass();
}
function showBass() { showCenter(`BASS: ${bassLevel > 0 ? '+' : ''}${bassLevel} dB`); }

function changeTreble(d) {
    if (!trebleFilter || isBypass) return;
    trebleLevel = Math.min(12, Math.max(-12, trebleLevel + d));
    trebleFilter.gain.setTargetAtTime(trebleLevel, audioCtx.currentTime, 0.05);
    eqGains[9] = trebleLevel;
    drawEQCurve();
    showTreble();
}
function showTreble() { showCenter(`TREBLE: ${trebleLevel > 0 ? '+' : ''}${trebleLevel} dB`); }

function changeToneFlat() {
    if (!eqFilters.length) return;
    applyEQGains(new Array(10).fill(0), true);
    bassLevel = 0; trebleLevel = 0;
    currentPreset = null;
    const ind = document.getElementById('eq-preset-ind');
    if (ind) ind.textContent = '';
    showCenter("TONE FLAT");
    setTimeout(updateStatusText, 1500);
}

const EQ_FREQS = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
let eqFilters = [];      // 10 BiquadFilter nodes
let eqGains = new Array(10).fill(0); // current gains

function initEQFilters() {
    eqFilters = EQ_FREQS.map((freq, i) => {
        const f = audioCtx.createBiquadFilter();
        if (i === 0) { f.type = 'lowshelf'; }
        else if (i === 9) { f.type = 'highshelf'; }
        else { f.type = 'peaking'; f.Q.value = 1.4; }
        f.frequency.value = freq;
        f.gain.value = 0;
        return f;
    });

    return eqFilters;
}

function applyEQGains(gains, smooth) {
    if (!eqFilters.length) return;
    const t = audioCtx ? audioCtx.currentTime : 0;
    gains.forEach((g, i) => {
        eqGains[i] = g;
        if (smooth) eqFilters[i].gain.setTargetAtTime(g, t, 0.02);
        else eqFilters[i].gain.value = g;
    });
    syncEQSliders();
    drawEQCurve();
}

function gainToPercent(g) { return (g + 12) / 24; } // 0=bottom, 1=top
function percentToGain(p) { return Math.round((p * 24 - 12) * 2) / 2; } // step 0.5

function syncEQSliders() {
    eqGains.forEach((g, i) => {
        const vl = document.getElementById('eqVal' + i);
        if (vl) vl.textContent = (g > 0 ? '+' : '') + parseFloat(g).toFixed(g % 1 === 0 ? 0 : 1);
        setThumbPos(i, g);
    });
}

function setThumbPos(band, gain) {
    const thumb = document.getElementById('eqThumb' + band);
    if (!thumb) return;
    const track = thumb.parentElement;
    const trackH = track.clientHeight || 160;
    // gain +12 = top (0%), gain -12 = bottom (100%)
    const pct = 1 - gainToPercent(gain);
    thumb.style.bottom = ((1 - pct) * trackH) + 'px';
}

function onEQSlider(band, value) {
    const g = parseFloat(value);
    eqGains[band] = g;
    if (eqFilters[band]) eqFilters[band].gain.setTargetAtTime(g, audioCtx.currentTime, 0.02);
    const vl = document.getElementById('eqVal' + band);
    if (vl) vl.textContent = (g > 0 ? '+' : '') + g;
    currentPreset = null;
    const ind = document.getElementById('eq-preset-ind');
    if (ind) ind.textContent = 'DSP: CUSTOM';
    setThumbPos(band, g);
    drawEQCurve();
}

(function initEQSliders() {
    document.addEventListener('DOMContentLoaded', () => {
        for (let i = 0; i < 10; i++) {
            const thumb = document.getElementById('eqThumb' + i);
            if (!thumb) continue;
            const track = thumb.parentElement;
            let dragging = false;

            const onDown = (e) => {
                dragging = true;
                thumb.classList.add('dragging');
                e.preventDefault();
            };
            const onMove = (e) => {
                if (!dragging) return;
                const rect = track.getBoundingClientRect();
                const clientY = e.touches ? e.touches[0].clientY : e.clientY;
                let pct = (clientY - rect.top) / rect.height;
                pct = Math.max(0, Math.min(1, pct));
                const gain = percentToGain(1 - pct);
                onEQSlider(i, gain);
            };
            const onUp = () => { dragging = false; thumb.classList.remove('dragging'); };

            thumb.addEventListener('mousedown', onDown);
            track.addEventListener('mousedown', (e) => { onDown(e); onMove(e); });
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
            thumb.addEventListener('touchstart', onDown, { passive: false });
            document.addEventListener('touchmove', onMove, { passive: false });
            document.addEventListener('touchend', onUp);
        }
        syncEQSliders();
    });
})();

function drawEQCurve() {
    const canvas = document.getElementById('eqCurveCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    ctx.strokeStyle = '#1c1c1c';
    ctx.lineWidth = 1;
    [0, 0.25, 0.5, 0.75, 1].forEach(t => {
        const y = t * H;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    });

    ctx.strokeStyle = '#2a2a2a';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2); ctx.stroke();

    // Curve
    const bandX = eqGains.map((_, i) => (i / (eqGains.length - 1)) * W);
    const bandY = eqGains.map(g => H / 2 - (g / 12) * (H / 2 - 6));



    // Line
    ctx.beginPath();
    ctx.moveTo(bandX[0], bandY[0]);
    for (let i = 0; i < bandX.length - 1; i++) {
        const cpx = (bandX[i] + bandX[i + 1]) / 2;
        ctx.bezierCurveTo(cpx, bandY[i], cpx, bandY[i + 1], bandX[i + 1], bandY[i + 1]);
    }
    ctx.strokeStyle = '#c8a84b';
    ctx.lineWidth = 2;
    ctx.shadowColor = 'rgba(200,168,75,0.6)';
    ctx.shadowBlur = 6;
    ctx.stroke();
    ctx.shadowBlur = 0;

    bandX.forEach((x, i) => {
        ctx.beginPath();
        ctx.arc(x, bandY[i], 3, 0, Math.PI * 2);
        ctx.fillStyle = '#c8a84b';
        ctx.fill();
    });
}

function EQCustom() {
    const modal = document.getElementById('eqCustomModal');
    modal.classList.toggle('open');
    syncEQSliders();
    setTimeout(drawEQCurve, 50);
}

const EQ_PRESETS = {
    rock: [5, 4, 3, 1, 0, -1, 2, 4, 5, 4],
    pop: [2, 1, 0, 2, 4, 3, 2, 1, 2, 2],
    dance: [8, 7, 5, 2, -1, -2, 0, 2, 3, 4],
    jazz: [3, 2, 1, -1, 2, 3, 2, 1, -1, -2],
    classic: [-2, -1, 0, 0, 0, 0, 1, 2, 3, 2],
    live: [-2, 0, 2, 3, 3, 2, 2, 3, 3, 2],
    vocal: [-4, -3, -2, 1, 5, 5, 4, 2, 1, 0],
    flat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
};

let currentPreset = null;

function applyEQPreset(name) {
    if (!eqFilters.length) return;
    const gains = EQ_PRESETS[name];
    if (!gains) return;
    applyEQGains(gains, true);
    // Also sync bass/treble knob values for bypass restore
    bassLevel = gains[0];
    trebleLevel = gains[9];
    currentPreset = name === 'flat' ? null : name;
    const ind = document.getElementById('eq-preset-ind');
    if (ind) ind.textContent = currentPreset ? `DSP: ${currentPreset.toUpperCase()}` : '';
    setTimeout(updateStatusText, 1500);
}


function doShuttle(v) { if (v != 0) { audio.currentTime += v * 0.5; showCenter(v > 0 ? "SEARCH >>" : "<< SEARCH", 600); } }
function resetShuttle() { document.getElementById('shuttle').value = 0; updateStatusText(); }
function updateTrackDisplay() {
    const grid = document.getElementById('track-grid');
    grid.innerHTML = '';

    const displayLimit = 20;
    const tracksToShow = playlist.slice(0, displayLimit);

    for (let i = 0; i < displayLimit; i++) {
        const s = document.createElement('span');
        if (i < tracksToShow.length) {
            s.className = 'track-num' + (i === currentIndex ? ' active' : '');
            s.innerText = i + 1;
        } else {
            s.className = 'track-num track-num-off';
            s.innerText = i + 1;
        }
        grid.appendChild(s);
    }

    if (playlist.length > displayLimit) {
        const more = document.createElement('span');
        more.className = 'track-more';
        more.innerHTML = '<i class="fa-solid fa-caret-right"></i>';
        grid.appendChild(more);
    } else {
        const more = document.createElement('span');
        more.className = 'track-more track-more-off';
        more.innerHTML = '<i class="fa-solid fa-caret-right"></i>';
        grid.appendChild(more);
    }
}
function skip(v) { audio.currentTime += v; }
function changeVolume(d) {
    audio.volume = Math.min(1, Math.max(0, audio.volume + d));
    showVolume();
    _syncKnob();
}
function showVolume() { showCenter(`VOL: ${Math.round(audio.volume * 40)}`); }

function _syncKnob() {
    const knob = document.getElementById('volumeKnob');
    if (!knob) return;
    const angle = -135 + audio.volume * 270;
    knob.style.setProperty('--knob-angle', angle.toFixed(2) + 'deg');
}

(function initKnob() {
    document.addEventListener('DOMContentLoaded', () => {
        const knob = document.getElementById('volumeKnob');
        const zoneL = document.getElementById('knobLeft');
        const zoneR = document.getElementById('knobRight');
        if (!knob || !zoneL || !zoneR) return;

        let holdInterval = null;
        const STEP = 0.01;      // volume step per tick
        const RATE = 30;        // ms per tick — smooth continuous rotation

        function startHold(direction) {
            stopHold();
            changeVolume(direction * STEP); // immediate first tick
            holdInterval = setInterval(() => changeVolume(direction * STEP), RATE);
        }

        function stopHold() {
            if (holdInterval !== null) {
                clearInterval(holdInterval);
                holdInterval = null;
            }
        }

        zoneL.addEventListener('mousedown', (e) => { e.preventDefault(); startHold(-1); });
        zoneR.addEventListener('mousedown', (e) => { e.preventDefault(); startHold(+1); });
        document.addEventListener('mouseup', stopHold);

        // Scroll wheel
        knob.addEventListener('wheel', (e) => {
            e.preventDefault();
            changeVolume(e.deltaY < 0 ? 0.05 : -0.05);
        }, { passive: false });

        _syncKnob();
    });
})();
function changeBalance(d) {
    if (!pannerNode) return;
    balanceLevel = Math.min(1, Math.max(-1, Math.round((balanceLevel + d) * 10) / 10));
    pannerNode.pan.setTargetAtTime(balanceLevel, audioCtx.currentTime, 0.05);
    showBalance();
}
function showBalance() {
    if (balanceLevel === 0) { showCenter('BALANCE: CENTER'); return; }
    const side = balanceLevel > 0 ? 'R' : 'L';
    showCenter(`BALANCE: ${side} ${Math.round(Math.abs(balanceLevel) * 10)}`);
}
function toggleTime() { timeMode = (timeMode === 'elapsed' ? 'remaining' : 'elapsed'); }
function toggleVUMode() { vuVisible = !vuVisible; }
let spectrumVisible = true;
function toggleSpectrum() {
    spectrumVisible = !spectrumVisible;
    if (!spectrumVisible && specCtx) {
        const specCanvas = document.getElementById('spectrum-canvas');
        const W = specCanvas.offsetWidth || 200;
        const H = specCanvas.offsetHeight || 80;
        specCtx.clearRect(0, 0, W, H);
        const barCount = 28;
        const barW = Math.floor(W / barCount) - 2;
        const barGap = Math.floor(W / barCount) - barW;
        const ledH = 3, ledStep = 5, ledCount = Math.floor(H / ledStep);
        for (let i = 0; i < barCount; i++) {
            const x = i * (barW + barGap);
            for (let l = 0; l < ledCount; l++) {
                specCtx.fillStyle = '#111';
                specCtx.fillRect(x, H - (l + 1) * ledStep, barW, ledH);
            }
        }
    }
}
function toggleRepeat() { repeatMode = (repeatMode + 1) % 3; document.getElementById('ind-repeat1').classList.toggle('active', repeatMode === 1); document.getElementById('ind-repeatAll').classList.toggle('active', repeatMode === 2); }
function handleAB() {
    const ind = document.getElementById('ind-ab');
    if (pointA === null) {
        pointA = audio.currentTime;
        ind.classList.remove('active', 'ab-active');
        ind.classList.add('ab-waiting');
    } else if (pointB === null) {
        pointB = audio.currentTime;
        ind.classList.remove('ab-waiting', 'active');
        ind.classList.add('ab-active');
    } else {
        pointA = pointB = null;
        ind.classList.remove('active', 'ab-waiting', 'ab-active');
    }
}
function toggleShuffle() { isShuffle = !isShuffle; document.getElementById('ind-shuffle').classList.toggle('active', isShuffle); }

function toggleMusicScan() {
    musicScanActive = !musicScanActive;
    clearTimeout(musicScanTimer);
    const ind = document.getElementById('ind-musicscan');
    ind.classList.toggle('active', musicScanActive);
    if (musicScanActive) {
        if (playlist.length > 0) {
            if (!audioCtx) initAudio();
            audio.currentTime = 0;
            stopPauseBlink();
            audio.play().then(() => {
                updateStatusText();
                startMusicScanTimer();
            });
        }
    } else {
        clearTimeout(musicScanTimer);
    }
}

function startMusicScanTimer() {
    clearTimeout(musicScanTimer);
    if (!musicScanActive) return;
    musicScanTimer = setTimeout(() => {
        if (!musicScanActive) return;
        // Passer à la piste suivante
        currentIndex = (currentIndex + 1) % playlist.length;
        loadTrack(currentIndex);
        audio.currentTime = 0;
        stopPauseBlink();
        audio.play().then(() => {
            updateStatusText();
            startMusicScanTimer();
        });
    }, 15000);
}
function openArtModal() {
    if (!playlist.length) return;
    document.getElementById('art-track-info').innerText = fileInfoLine.innerText;
    document.getElementById('artModal').classList.add('open');
}

function toggleInfo() {
    const modal = document.getElementById('infoModal');
    modal.classList.toggle('open');
}
function confirmRestart() { document.getElementById('restartModal').style.display = 'flex'; }

let trayOpen = false;
function toggleTray() {
    trayOpen = !trayOpen;
    const door = document.getElementById('trayDoor');
    const icon = document.getElementById('trayIcon');
    if (trayOpen) {
        door.classList.add('tray-open');
        icon.classList.replace('fa-chevron-down', 'fa-chevron-up');
    } else {
        door.classList.remove('tray-open');
        icon.classList.replace('fa-chevron-up', 'fa-chevron-down');
    }
}

let vuGain = 1.8;
function changeVUGain(d) {
    vuGain = Math.min(3, Math.max(0.1, Math.round((vuGain + d) * 10) / 10));
    showCenter(`VU GAIN: ${Math.round(vuGain * 100)}%`);
    setTimeout(updateStatusText, 1200);
}

const specCanvas = document.getElementById('spectrum-canvas');
if (specCanvas) { specCtx = specCanvas.getContext('2d'); drawSpectrum(); }
updateTrackDisplay();

// ── DRAG & DROP
(function initDragDrop() {
    const overlay = document.getElementById('drop-overlay');
    let dragCounter = 0;

    document.addEventListener('dragenter', (e) => {
        e.preventDefault();
        dragCounter++;
        overlay.classList.add('visible');
    });

    document.addEventListener('dragleave', (e) => {
        dragCounter--;
        if (dragCounter === 0) overlay.classList.remove('visible');
    });

    document.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
    });

    document.addEventListener('drop', (e) => {
        e.preventDefault();
        dragCounter = 0;
        overlay.classList.remove('visible');

        const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('audio/') || /\.(mp3|flac|wav|ogg|aac|m4a|opus|weba)$/i.test(f.name));
        if (!files.length) return;

        if (playlist.length > 0) {
            playlist.push(...files);
            showCenter(`+${files.length} TRACK${files.length > 1 ? 'S' : ''}`);
            setTimeout(updateStatusText, 1500);
            updateTrackDisplay();
        } else {
            playlist = files;
            currentIndex = 0;
            loadTrack(0);
            handlePlay();
        }
        renderPlaylistItems();
        cacheDurations(playlist, updateTotalTime);
        updateEjectAnimation();
    });
})();

(function initGenericDrag() {
    document.addEventListener('DOMContentLoaded', () => {
        [
            { modal: 'artModal', handle: 'artDragHandle' },
            { modal: 'infoModal', handle: 'infoDragHandle' },
            { modal: 'eqCustomModal', handle: 'eqCustomDragHandle' },
        ].forEach(({ modal: modalId, handle: handleId }) => {
            const modal = document.getElementById(modalId);
            const handle = document.getElementById(handleId);
            if (!modal || !handle) return;
            let dragging = false, ox = 0, oy = 0;

            handle.addEventListener('mousedown', (e) => {
                dragging = true;
                const rect = modal.getBoundingClientRect();
                modal.style.left = rect.left + 'px';
                modal.style.top = rect.top + 'px';
                modal.style.transform = 'none';
                ox = e.clientX - rect.left;
                oy = e.clientY - rect.top;
                e.preventDefault();
            });

            document.addEventListener('mousemove', (e) => {
                if (!dragging) return;
                let x = Math.max(0, Math.min(window.innerWidth - modal.offsetWidth, e.clientX - ox));
                let y = Math.max(0, Math.min(window.innerHeight - modal.offsetHeight, e.clientY - oy));
                modal.style.left = x + 'px';
                modal.style.top = y + 'px';
            });

            document.addEventListener('mouseup', () => { dragging = false; });
        });
    });
})();


window.addEventListener('beforeunload', (e) => {
    if (!audio.paused) {
        e.preventDefault();
        e.returnValue = '';
    }
});
document.addEventListener('DOMContentLoaded', updateEjectAnimation);