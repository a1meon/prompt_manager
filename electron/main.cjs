const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
let mainWindow = null;
let splashWindow = null;

app.setName('一世提示词管理');

if (process.platform === 'win32') {
  app.setAppUserModelId('com.yishi.promptmanager');
}

app.setPath('userData', path.join(app.getPath('appData'), 'com.yishi.promptmanager'));

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) {
      if (splashWindow) {
        splashWindow.show();
        splashWindow.focus();
      }
      return;
    }
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });
}

function createSplashWindow() {
  const win = new BrowserWindow({
    width: 420,
    height: 260,
    frame: false,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    show: true,
    backgroundColor: '#0b1220',
    alwaysOnTop: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  win.setMenuBarVisibility(false);
  win.setAutoHideMenuBar(true);
  win.removeMenu();

  const html = encodeURIComponent(`
    <!doctype html>
    <html lang="zh-CN">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>启动中</title>
        <style>
          html,body{height:100%;margin:0;background:#0b1220;color:#e5e7eb;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial}
          .wrap{height:100%;display:flex;align-items:center;justify-content:center}
          .card{width:340px;border-radius:16px;background:rgba(15,23,42,.72);border:1px solid rgba(148,163,184,.18);padding:18px 18px 16px;box-shadow:0 14px 30px rgba(0,0,0,.35)}
          .row{display:flex;align-items:center;gap:10px}
          .dot{height:10px;width:10px;border-radius:999px;background:#6366f1;box-shadow:0 0 0 6px rgba(99,102,241,.18)}
          .name{font-weight:700;letter-spacing:.2px}
          .sub{margin-top:10px;color:rgba(226,232,240,.72);font-size:12px;line-height:1.6}
          .bar{margin-top:14px;height:8px;border-radius:999px;background:rgba(148,163,184,.18);overflow:hidden}
          .bar>i{display:block;height:100%;width:38%;background:linear-gradient(90deg,#6366f1,#22d3ee);border-radius:999px;animation:move 1.15s ease-in-out infinite}
          @keyframes move{0%{transform:translateX(-30%)}50%{transform:translateX(140%)}100%{transform:translateX(-30%)}}
        </style>
      </head>
      <body>
        <div class="wrap">
          <div class="card">
            <div class="row">
              <div class="dot"></div>
              <div class="name">一世提示词管理</div>
            </div>
            <div class="sub">正在启动…</div>
            <div class="bar"><i></i></div>
          </div>
        </div>
      </body>
    </html>
  `);

  win.loadURL(`data:text/html;charset=utf-8,${html}`);
  return win;
}

function createMainWindow() {
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, 'icon.ico')
    : path.join(__dirname, '..', 'public', 'icon.ico');

  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 1000,
    minHeight: 650,
    title: '一世提示词管理',
    icon: iconPath,
    backgroundColor: '#0b1220',
    frame: false,
    show: !app.isPackaged,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs')
    }
  });

  win.setMenuBarVisibility(false);
  win.setAutoHideMenuBar(true);
  win.removeMenu();

  const notifyMax = () => {
    win.webContents.send('window:maximizedChanged', win.isMaximized());
  };
  win.on('maximize', notifyMax);
  win.on('unmaximize', notifyMax);

  if (process.env.ELECTRON_DEV_SERVER_URL) {
    win.loadURL(process.env.ELECTRON_DEV_SERVER_URL);
    win.webContents.openDevTools({ mode: 'detach' });
    return;
  }

  const indexHtml = path.join(__dirname, '..', 'dist', 'index.html');
  win.loadFile(indexHtml);
  win.once('ready-to-show', () => {
    if (splashWindow) {
      splashWindow.close();
      splashWindow = null;
    }
    win.show();
  });

  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null;
  });

  return win;
}

app.whenReady().then(() => {
  ipcMain.handle('window:minimize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return;
    win.minimize();
  });

  ipcMain.handle('window:toggleMaximize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return;
    if (win.isMaximized()) win.unmaximize();
    else win.maximize();
  });

  ipcMain.handle('window:close', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return;
    win.close();
  });

  ipcMain.handle('window:isMaximized', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return false;
    return win.isMaximized();
  });

  if (app.isPackaged) {
    splashWindow = createSplashWindow();
  }

  mainWindow = createMainWindow();
  app.on('activate', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
      return;
    }
    if (app.isPackaged) {
      splashWindow = createSplashWindow();
    }
    mainWindow = createMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
