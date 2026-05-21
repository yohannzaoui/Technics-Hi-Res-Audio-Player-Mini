# Technics Hi-Res Audio Player

A high-fidelity web application emulating the aesthetics and user experience of the iconic Technics CD player from the 1990s.

<img width="1257" height="197" alt="Technics_cover" src="https://github.com/user-attachments/assets/4cbd644c-e987-4431-b7e1-9cbaeafd9f76" />
.
<img width="1866" height="821" alt="1" src="https://github.com/user-attachments/assets/257b0c46-7c81-4334-8b02-b30e8b278430" />
.
<img width="1856" height="809" alt="2" src="https://github.com/user-attachments/assets/e94527da-5fe2-4930-ab89-fb7d1148209c" />

## 📱 Overview

This audio player recreates the authentic look of vintage Vacuum Fluorescent Displays (VFD) and physical tactile controls, blending retro hardware aesthetics with modern web capabilities. Built as a PWA with no framework dependencies.

---

## ✨ Features

### 🎛 Playback Controls

- **Play / Pause / Stop** — Standard transport controls
- **Previous / Next Track** — Navigate through the playlist
- **Skip ±10s** — Jump backward or forward 10 seconds within a track
- **Mute** — Toggle audio on/off without losing volume level
- **Time Mode** — Switch between elapsed and remaining time display
- **Numeric Keypad (0–9)** — Direct track selection by number with 1.2s input timeout
- **Jog Shuttle** — Interactive slider for rapid search and position scrubbing

### 📂 File Management

- **Open Button** — Load one or multiple audio files via the system file picker
- **Drag & Drop** — Drag audio files directly onto the player
  - Playlist empty: loads and starts playback immediately
  - Playlist active: appends files to the end without interrupting playback
- **Supported formats** — MP3, FLAC, WAV, OGG, AAC, M4A, Opus

### 🎵 Playlist

- **Floating draggable popup** — Movable anywhere on screen by dragging the header
- **Resizable width** — Drag the right edge to resize the popup
- **Scrollable track list** — Styled VFD-themed scrollbar
- **Cover art per track** — Album artwork (48×48px) extracted from ID3 tags
- **Track removal** — ✕ button on each track to remove it without stopping playback
- **Eject button (⏏)** — Add more files to the current playlist from within the popup
- **Active track highlight** — Current track shown in red

### 🔁 Playback Modes

- **Shuffle (Random)** — Randomizes track order
- **Repeat** — Cycles through Off → Repeat 1 → Repeat All
- **A-B Loop** — Set loop start (A) and end (B) points for section repeat
- **Music Scan** — Plays the first 15 seconds of each track automatically; pressing Play deactivates scan and resumes normal playback

### 🎚 Audio Processing (5-Band EQ)

All tone controls use Web Audio API BiquadFilter nodes chained in series:

- **Bass** — Low shelf at 250 Hz (±2 dB steps)
- **Treble** — High shelf at 10 kHz (±2 dB steps)
- **Loudness** — Boosts bass and treble at low listening volumes
- **Mono** — Collapses stereo to mono
- **Bypass** — Temporarily disables all EQ/tone processing; restores on toggle off
- **Tone Flat** — Resets all EQ bands to 0 dB

**EQ Presets (5-band: 250 Hz / 500 Hz / 2 kHz / 8 kHz / 10 kHz):**

| Preset | Character |
|--------|-----------|
| ROCK | Boosted bass and upper mids, bright treble |
| POP | Enhanced mids and presence, smooth highs |
| DANCE | Deep bass emphasis, punchy attack |
| JAZZ | Warm low-mids, open high-mids, rolled treble |
| CLASSIC | Natural with slight high-mid and treble lift |
| LIVE | Scooped low-mids, forward mids and highs |
| VOCAL | Bass cut, strong mid presence boost |
| FLAT | All bands at 0 dB |

### 📊 VFD Display (Vacuum Fluorescent Display)

- **Time counter** — Stabilized with tabular numerals to prevent layout jitter
- **File info line** — Artist / Album / Title from ID3 tags with VFD pixel-grid background texture
- **Format indicator** — Displays current file format (MP3, FLAC, WAV…)
- **Track number grid** — 1–20 slots always visible; unloaded slots shown as dim VFD pixels; active track in red; arrow indicator when playlist exceeds 20 tracks
- **Status indicators** (dim until active):
  - A-B
  - RANDOM
  - REPEAT 1
  - REPEAT ALL
  - MUSIC SCAN
- **VU Meters** — Dual-channel L/R LED bar meters with peak hold, color zones (cyan → orange → red), and adjustable VU gain
- **Spectrum Analyzer** — 28-band LED frequency display with frequency labels above each band and dB scale below
- Toggle between VU Meter and Spectrum Analyzer views

### 🎨 Design & Themes

- **Dark / Light chassis** — Click the Technics logo to toggle between black and beige/ivory theme; saved to `localStorage`
- **Tray mechanism** — Animated CD tray door reveals hidden EQ preset and utility buttons

### 🖥 Draggable Popup Windows

All popup windows are freely movable by dragging their header bar:

- **Album Art** — Displays embedded cover art and track metadata; open by clicking the file info line or TRACK ART button
- **Track List** — Full playlist manager with covers, track removal, and file addition
- **Info** — Displays the Technics brand logo and app information; triggered by the INFO button

### 🖥 Hidden Tray Controls

Accessible by opening the CD tray:

- EQ Presets (ROCK, POP, DANCE, JAZZ, CLASSIC, LIVE, VOCAL, FLAT)
- TONE FLAT
- VU GAIN − / VU GAIN +
- TRACK LIST
- TRACK ART
- INFO

### ⚙️ System

- **Media Session API** — Native OS media controls and metadata in the system notification tray
- **PWA ready** — Service Worker + Web App Manifest for offline use and installability
- **Volume & Balance** — Separate controls with real-time VFD feedback
- **Restart** — Power button triggers a confirm dialog before reloading

---

## 🛠 Technical Stack

- **HTML5 / CSS3** — CSS custom properties for theming, Flexbox/Grid layout
- **JavaScript (Vanilla)** — No framework, no build step
- **Web Audio API** — 5-band BiquadFilter EQ chain, ChannelSplitter for stereo VU metering, AnalyserNode for spectrum
- **jsmediatags** — ID3/metadata extraction from MP3/FLAC files
- **DS-Digital** — Vintage digital font for the time counter
- **Inter** — UI typeface (weights 400/500/700)
- **Font Awesome** — Icons

---

## 🚀 Getting Started

1. Download and unzip the project folder
2. Open `index.html` in any modern browser (Chrome, Firefox, Edge, Safari)
3. An internet connection is required on first load for Google Fonts and jsmediatags CDN
4. Load audio files via the **OPEN** button or by **drag & dropping** files onto the player

---

## 📝 Persistent Settings

Saved automatically via `localStorage`:

- **Theme** — Dark or Light chassis

---

*Developed with passion for vintage audio by Yohann Zaoui — [Yohann Zaoui](https://github.com/HDSoundSystem)*
