const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const https = require('https');
const fs = require('fs');
const { spawn } = require('child_process');
let mainWindow = null;
let splashWindow = null;
let pendingUpdate = null;
let downloadedInstallerPath = null;

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

function getDialogParent() {
  if (mainWindow && !mainWindow.isDestroyed()) return mainWindow;
  if (splashWindow && !splashWindow.isDestroyed()) return splashWindow;
  return null;
}

function compareSemver(a, b) {
  const pa = String(a || '').replace(/^v/i, '').split('.').map(n => Number(n || 0));
  const pb = String(b || '').replace(/^v/i, '').split('.').map(n => Number(n || 0));
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const da = pa[i] ?? 0;
    const db = pb[i] ?? 0;
    if (da > db) return 1;
    if (da < db) return -1;
  }
  return 0;
}

function fetchJson(url, timeoutMs) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        headers: {
          Accept: 'application/json'
        }
      },
      (res) => {
        const status = Number(res.statusCode || 0);
        if (status < 200 || status >= 300) {
          res.resume();
          reject(new Error(`HTTP ${status}`));
          return;
        }
        let raw = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          raw += chunk;
        });
        res.on('end', () => {
          try {
            resolve(JSON.parse(raw));
          } catch (e) {
            reject(e);
          }
        });
      }
    );
    req.on('error', reject);
    if (timeoutMs && timeoutMs > 0) {
      req.setTimeout(timeoutMs, () => {
        req.destroy(new Error('timeout'));
      });
    }
  });
}

function pickGiteeInstallerAsset(assets) {
  const list = Array.isArray(assets) ? assets : [];
  const items = list
    .map(a => ({
      name: String(a?.name || ''),
      url: String(a?.browser_download_url || a?.url || '')
    }))
    .filter(a => a.url && /\.exe(\?|$)/i.test(a.url));

  const preferred =
    items.find(a => /(安装程序|setup)/i.test(a.name) && /\.exe(\?|$)/i.test(a.url)) ||
    items.find(a => /(安装程序|setup)/i.test(a.url)) ||
    items[0];

  return preferred ? preferred.url : '';
}

async function checkGiteeLatest() {
  const apiUrl = 'https://gitee.com/api/v5/repos/a1meon/prompt_manager_release/releases/latest';
  const data = await fetchJson(apiUrl, 3500);
  const tag = String(data?.tag_name || data?.name || '').trim();
  const version = tag.replace(/^v/i, '').trim();
  if (!version) throw new Error('无法解析 Gitee 版本号');
  const downloadUrl = pickGiteeInstallerAsset(data?.assets);
  return {
    version,
    downloadUrl,
    releaseUrl: 'https://gitee.com/a1meon/prompt_manager_release/releases'
  };
}

function downloadFileWithProgress(url, outPath, onProgress) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      const status = Number(res.statusCode || 0);
      if (status >= 300 && status < 400 && res.headers.location) {
        res.resume();
        downloadFileWithProgress(String(res.headers.location), outPath, onProgress).then(resolve, reject);
        return;
      }
      if (status < 200 || status >= 300) {
        res.resume();
        reject(new Error(`HTTP ${status}`));
        return;
      }

      const total = Number(res.headers['content-length'] || 0);
      let transferred = 0;
      const file = fs.createWriteStream(outPath);
      res.on('data', (chunk) => {
        transferred += chunk.length;
        if (typeof onProgress === 'function') {
          const percent = total > 0 ? (transferred / total) * 100 : 0;
          onProgress({
            percent,
            transferred,
            total,
            bytesPerSecond: 0
          });
        }
      });
      res.on('error', (err) => {
        file.close(() => reject(err));
      });
      file.on('error', (err) => {
        res.destroy(err);
        file.close(() => reject(err));
      });
      res.pipe(file);
      file.on('finish', () => {
        file.close(() => resolve());
      });
    });
    req.on('error', reject);
  });
}

app.whenReady().then(() => {
  ipcMain.handle('app:getVersion', () => app.getVersion());

  ipcMain.handle('update:check', async () => {
    if (!app.isPackaged) {
      return { status: 'error', message: '开发模式不支持自动更新检查' };
    }

    pendingUpdate = null;
    downloadedInstallerPath = null;

    const currentVersion = app.getVersion();
    try {
      const gitee = await checkGiteeLatest();
      if (compareSemver(gitee.version, currentVersion) > 0 && gitee.downloadUrl) {
        pendingUpdate = { source: 'gitee', version: gitee.version, downloadUrl: gitee.downloadUrl };
        return {
          status: 'update_available',
          version: gitee.version,
          source: 'gitee',
          releaseUrl: gitee.releaseUrl
        };
      }
      if (compareSemver(gitee.version, currentVersion) <= 0) {
        return { status: 'no_update' };
      }
    } catch {
    }

    let autoUpdater;
    try {
      ({ autoUpdater } = require('electron-updater'));
    } catch {
      return { status: 'error', message: '更新模块未就绪' };
    }
    const token =
      process.env.PROMPT_MANAGER_GH_TOKEN ||
      process.env.GH_TOKEN ||
      process.env.GITHUB_TOKEN;
    if (token && typeof token === 'string') {
      autoUpdater.requestHeaders = {
        Authorization: `token ${token}`
      };
    }

    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;
    try {
      const result = await autoUpdater.checkForUpdates();
      if (!result || !result.updateInfo || !result.updateInfo.version) return { status: 'no_update' };
      pendingUpdate = { source: 'github', version: result.updateInfo.version };
      return {
        status: 'update_available',
        version: result.updateInfo.version,
        source: 'github',
        releaseName: result.updateInfo.releaseName,
        releaseNotes: typeof result.updateInfo.releaseNotes === 'string' ? result.updateInfo.releaseNotes : ''
      };
    } catch (err) {
      return { status: 'error', message: String(err?.message || err || '') };
    }
  });

  ipcMain.handle('update:download', async (event) => {
    if (!app.isPackaged) return { status: 'error', message: '开发模式不支持自动更新下载' };

    if (pendingUpdate?.source === 'gitee' && pendingUpdate.downloadUrl) {
      const wc = event.sender;
      const version = String(pendingUpdate.version || '').replace(/^v/i, '');
      const safeVersion = version || 'latest';
      const fileName = `prompt-manager-setup-${safeVersion}.exe`;
      const outPath = path.join(app.getPath('temp'), fileName);
      try {
        await downloadFileWithProgress(pendingUpdate.downloadUrl, outPath, (info) => {
          wc.send('update:downloadProgress', {
            percent: Number(info?.percent || 0),
            transferred: Number(info?.transferred || 0),
            total: Number(info?.total || 0),
            bytesPerSecond: Number(info?.bytesPerSecond || 0)
          });
        });
        downloadedInstallerPath = outPath;
        return { status: 'downloaded' };
      } catch (err) {
        return { status: 'error', message: String(err?.message || err || '') };
      }
    }

    let autoUpdater;
    try {
      ({ autoUpdater } = require('electron-updater'));
    } catch {
      return { status: 'error', message: '更新模块未就绪' };
    }
    const token =
      process.env.PROMPT_MANAGER_GH_TOKEN ||
      process.env.GH_TOKEN ||
      process.env.GITHUB_TOKEN;
    if (token && typeof token === 'string') {
      autoUpdater.requestHeaders = {
        Authorization: `token ${token}`
      };
    }

    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;

    const wc = event.sender;
    let lastSentAt = 0;
    const onProgress = (info) => {
      const now = Date.now();
      if (now - lastSentAt < 200 && Number(info?.percent || 0) < 100) return;
      lastSentAt = now;
      wc.send('update:downloadProgress', {
        percent: Number(info?.percent || 0),
        transferred: Number(info?.transferred || 0),
        total: Number(info?.total || 0),
        bytesPerSecond: Number(info?.bytesPerSecond || 0)
      });
    };

    autoUpdater.on('download-progress', onProgress);
    try {
      await autoUpdater.downloadUpdate();
      return { status: 'downloaded' };
    } catch (err) {
      return { status: 'error', message: String(err?.message || err || '') };
    } finally {
      autoUpdater.removeListener('download-progress', onProgress);
    }
  });

  ipcMain.handle('update:quitAndInstall', () => {
    if (pendingUpdate?.source === 'gitee' && downloadedInstallerPath && fs.existsSync(downloadedInstallerPath)) {
      try {
        spawn(downloadedInstallerPath, [], { detached: true, stdio: 'ignore' }).unref();
        app.quit();
        return;
      } catch {
        return;
      }
    }
    let autoUpdater;
    try {
      ({ autoUpdater } = require('electron-updater'));
    } catch {
      return;
    }
    autoUpdater.quitAndInstall(false, true);
  });

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
