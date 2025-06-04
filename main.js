const { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain, Notification, screen } = require('electron');
const path = require('path');
const Store = require('electron-store');

// Initialize settings store
const store = new Store({
  defaults: {
    workInterval: 20, // minutes
    breakInterval: 20, // seconds
    darkMode: false,
    activeHours: {
      start: '09:00',
      end: '17:00',
      weekdaysOnly: true
    }
  }
});

let mainWindow;
let overlayWindows = [];  // Array to store multiple overlay windows
let tray;
let isQuitting = false;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 400,
    height: 600,
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    show: false,
    frame: true,
    resizable: false,
    skipTaskbar: false,
    center: true,
    alwaysOnTop: true
  });

  mainWindow.loadFile('index.html');

  mainWindow.on('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
      return false;
    }
  });
}

function createTray() {
  const icon = nativeImage.createFromPath(path.join(__dirname, 'assets', 'icon.png'));
  // Resize icon to 18x18 pixels for macOS menu bar
  const resizedIcon = icon.resize({ width: 18, height: 18 });
  tray = new Tray(resizedIcon);
  
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show App', click: () => mainWindow.show() },
    { label: 'Start Break', click: startBreak },
    { type: 'separator' },
    { label: 'Quit', click: () => {
      isQuitting = true;
      app.quit();
    }}
  ]);

  tray.setToolTip('20-20-20 Eye Care');
  tray.setContextMenu(contextMenu);
}

function createOverlayWindows() {
  // Get all displays
  const displays = screen.getAllDisplays();
  
  // Create an overlay window for each display
  displays.forEach(display => {
    const { width, height, x, y } = display.workArea;
    
    const overlayWindow = new BrowserWindow({
      width: width,
      height: height,
      x: x,
      y: y,
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    });

    overlayWindow.loadFile('overlay.html');
    overlayWindow.setVisibleOnAllWorkspaces(true);
    overlayWindow.setAlwaysOnTop(true, 'screen-saver');
    overlayWindow.setIgnoreMouseEvents(false);
    
    // Prevent keyboard interaction
    overlayWindow.webContents.on('before-input-event', (event, input) => {
      // Allow only Escape key to close the window
      if (input.key !== 'Escape') {
        event.preventDefault();
      }
    });
    
    overlayWindows.push(overlayWindow);
  });
}

function startBreak() {
  const settings = store.store;
  
  // Create and show overlay windows
  if (overlayWindows.length === 0) {
    createOverlayWindows();
  }
  overlayWindows.forEach(window => {
    window.show();
    window.focus();
  });
  
  // Send break start event to all windows with settings
  mainWindow.webContents.send('start-break');
  overlayWindows.forEach(window => {
    window.webContents.send('start-break', settings);
  });
}

app.whenReady().then(() => {
  // Set the dock icon
  if (process.platform === 'darwin') {
    app.dock.setIcon(path.join(__dirname, 'assets', 'icon.png'));
  }
  createWindow();
  createTray();
  mainWindow.show();

  // Request notification permission
  if (process.platform === 'darwin') {
    app.dock.setMenu(Menu.buildFromTemplate([
      { label: 'Show', click: () => mainWindow.show() }
    ]));
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC handlers for settings
ipcMain.handle('get-settings', () => {
  return store.store;
});

ipcMain.handle('update-settings', (event, newSettings) => {
  store.store = { ...store.store, ...newSettings };
  return store.store;
});

// Add IPC handlers for minimize and close window events
ipcMain.on('minimize-window', () => {
  mainWindow.minimize();
});

ipcMain.on('close-window', () => {
  mainWindow.hide();
});

// Add IPC handler for break end
ipcMain.on('break-ended', () => {
  console.log('Break ended');
  overlayWindows.forEach(window => {
    window.hide();
  });
  // Notify renderer to restart timer
  mainWindow.webContents.send('break-ended');
});

// Add IPC handler for break snooze
ipcMain.on('break-snoozed', () => {
  console.log('Snooze requested');
  overlayWindows.forEach(window => {
    window.hide();
  });
  // Notify renderer to start snooze timer
  mainWindow.webContents.send('break-snoozed');
});

// Add IPC handler for break start
ipcMain.on('start-break', startBreak);

// Clean up overlay windows when app quits
app.on('before-quit', () => {
  overlayWindows.forEach(window => {
    window.destroy();
  });
  overlayWindows = [];
}); 