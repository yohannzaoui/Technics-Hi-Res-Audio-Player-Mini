const { app, BrowserWindow, globalShortcut, nativeImage, ipcMain } = require('electron');
const path = require('path');

let win;
let pendingFiles = [];

function sendFilesToRenderer(filePaths) {
  if (win && win.webContents) {
    win.webContents.send('open-files', filePaths);
  } else {
    pendingFiles = filePaths;
  }
}

const openWithFiles = process.argv.slice(2).filter(f => !f.startsWith('--'));
if (openWithFiles.length) pendingFiles = openWithFiles;

app.on('open-file', (event, filePath) => {
  event.preventDefault();
  sendFilesToRenderer([filePath]);
});

app.on('second-instance', (event, argv) => {
  const files = argv.slice(2).filter(f => !f.startsWith('--'));
  if (files.length) sendFilesToRenderer(files);
  if (win) { if (win.isMinimized()) win.restore(); win.focus(); }
});

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) { app.quit(); }

function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    autoHideMenuBar: true,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#080808',
      symbolColor: '#786b46',
      height: 32
    },
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  win.loadFile('index.html');

  win.webContents.on('did-finish-load', () => {
    if (pendingFiles.length) {
      sendFilesToRenderer(pendingFiles);
      pendingFiles = [];
    }
  });

  win.once('ready-to-show', () => {
    setThumbar(false);
  });

  ipcMain.on('update-thumbar', (event, isPlaying) => {
    setThumbar(isPlaying);
  });
}

function registerMediaKeys() {
  // Play / Pause
  const playPauseReg = globalShortcut.register('MediaPlayPause', () => {
    if (win) win.webContents.send('media-control', 'play-pause');
  });
  if (!playPauseReg) console.log('Échec de l’enregistrement de MediaPlayPause (probablement intercepté par une autre app)');

  // Next
  const nextReg = globalShortcut.register('MediaNextTrack', () => {
    if (win) win.webContents.send('media-control', 'next');
  });
  if (!nextReg) console.log('Échec de l’enregistrement de MediaNextTrack');

  // Previous
  const prevReg = globalShortcut.register('MediaPreviousTrack', () => {
    if (win) win.webContents.send('media-control', 'prev');
  });
  if (!prevReg) console.log('Échec de l’enregistrement de MediaPreviousTrack');
}

function setThumbar(isPlaying) {
  if (!win) return;
  win.setThumbarButtons([
    {
      tooltip: 'Précédent',
      icon: path.join(__dirname, 'assets/windows/prev.png'),
      click() { win.webContents.send('media-control', 'prev'); }
    },
    {
      tooltip: isPlaying ? 'Pause' : 'Play',
      icon: isPlaying ? path.join(__dirname, 'assets/windows/pause.png') : path.join(__dirname, 'assets/windows/play.png'),
      click() { win.webContents.send('media-control', 'play-pause'); }
    },
    {
      tooltip: 'Suivant',
      icon: path.join(__dirname, 'assets/windows/next.png'),
      click() { win.webContents.send('media-control', 'next'); }
    }
  ]);
}

// Enregistrement propre au démarrage
app.whenReady().then(() => {
  createWindow();
  registerMediaKeys(); 
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});