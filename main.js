// main.js
import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import youtubedl from 'youtube-dl-exec';
import ffmpegStatic from 'ffmpeg-static';

// Dönüşüm için fluent-ffmpeg + installer'lar
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import ffprobeInstaller from '@ffprobe-installer/ffprobe';

ffmpeg.setFfmpegPath(ffmpegInstaller.path);
ffmpeg.setFfprobePath(ffprobeInstaller.path);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let win;

async function createWindow() {
  win = new BrowserWindow({
    width: 900,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'), // <-- CommonJS preload
      contextIsolation: true,
      sandbox: false,
      nodeIntegration: false,
    },
  });

  await win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  // win.webContents.openDevTools();
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// ---------- Yardımcılar ----------

// yt-dlp çalıştırıp stdout/stderr'i renderer'a akıt
function runYtDlp(url, opts) {
  return new Promise((resolve, reject) => {
    const sp = youtubedl.exec(url, opts);

    sp.stdout.on('data', (d) =>
      win?.webContents.send('download:progress', { message: d.toString() })
    );
    sp.stderr.on('data', (d) =>
      win?.webContents.send('download:progress', { message: d.toString() })
    );

    sp.on('error', reject);
    sp.on('close', (code) => (code === 0 ? resolve(0) : reject(code)));
  });
}

// Klasörde en son değişen .ext dosyasını bul
function getLatestFile(dir, ext = '.webm') {
  const files = readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith(ext))
    .map((f) => ({ f, t: statSync(path.join(dir, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t);
  return files.length ? path.join(dir, files[0].f) : null;
}

// saniyeyi 00:00:00 biçimine çevir (gerektiğinde)
function secondsToHMS(sec) {
  const h = Math.floor(sec / 3600)
    .toString()
    .padStart(2, '0');
  const m = Math.floor((sec % 3600) / 60)
    .toString()
    .padStart(2, '0');
  const s = Math.floor(sec % 60)
    .toString()
    .padStart(2, '0');
  return `${h}:${m}:${s}`;
}

// ffprobe ile süreyi al
function probeDurationSeconds(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, data) => {
      if (err) return reject(err);
      const dur = data?.format?.duration;
      resolve(dur ? Number(dur) : null);
    });
  });
}

// WebM → MP4 (H.264 + AAC) çevir ve ilerlemeyi gönder
async function webmToMp4WithProgress(inputPath, outputPath) {
  const totalSeconds = (await probeDurationSeconds(inputPath)) || 0;

  return new Promise((resolve, reject) => {
    let lastPercent = -1;

    ffmpeg(inputPath)
      .outputOptions([
        '-c:v libx264',
        '-c:a aac',
        '-movflags +faststart',
        '-pix_fmt yuv420p',
        '-vf',
        'scale=trunc(iw/2)*2:trunc(ih/2)*2',
      ])
      .on('progress', (progress) => {
        if (progress.timemark && totalSeconds > 0) {
          // timemark "00:01:23.45" gibi gelir
          const [h, m, sRaw] = progress.timemark.split(':');
          const s = parseFloat(sRaw || '0');
          const current = parseFloat(h) * 3600 + parseFloat(m) * 60 + s;
          const percent = Math.min(100, (current / totalSeconds) * 100);
          const rounded = Math.floor(percent);
          if (rounded !== lastPercent) {
            lastPercent = rounded;
            win?.webContents.send('convert:progress', {
              message: `MP4 dönüşüm: %${rounded} (${secondsToHMS(
                Math.max(0, totalSeconds - current)
              )} kala)`,
            });
          }
        } else {
          win?.webContents.send('convert:progress', {
            message: 'MP4 dönüşüm devam ediyor…',
          });
        }
      })
      .on('end', () => {
        win?.webContents.send('convert:progress', {
          message: '✅ MP4 dönüşüm tamamlandı.',
        });
        resolve(outputPath);
      })
      .on('error', (err) => {
        win?.webContents.send('convert:progress', {
          message: '❌ MP4 dönüşüm hatası: ' + err.message,
        });
        reject(err);
      })
      .save(outputPath);
  });
}

// ---------- IPC: İndir + (biter bitmez) MP4'e çevir ----------

ipcMain.handle(
  'download:youtube',
  async (_evt, { url, maxHeight = 720, outDir, keepWebm = false }) => {
    const targetHeight = Number.isFinite(maxHeight) ? maxHeight : 720;
    const downloadsDir = outDir || path.join(__dirname, 'downloads');
    mkdirSync(downloadsDir, { recursive: true });

    // Dosya adı şablonu
    const outTemplate = path.join(downloadsDir, '%(title)s.%(ext)s');

    // 1) 720p WebM (video+ses birleştirilmiş) dene
    const exact720Webm = {
      format: [
        `bestvideo[height=720][ext=webm]+bestaudio[acodec=opus]`,
        `bestvideo[height=720]+bestaudio`,
      ].join('/'),
      output: outTemplate,
      ffmpegLocation: ffmpegStatic, // yt-dlp de birleştime için ffmpeg kullanabilir
      mergeOutputFormat: 'webm',
      restrictFilenames: true,
      noCheckCertificates: true,
      noWarnings: true,
    };

    // 2) ≤720p WebM fallback
    const le720Webm = {
      format: [
        `bestvideo[height<=${targetHeight}][ext=webm]+bestaudio[acodec=opus]`,
        `bestvideo[height<=${targetHeight}]+bestaudio`,
        `best[height<=${targetHeight}][ext=webm]`,
        `best[height<=${targetHeight}]`,
      ].join('/'),
      output: outTemplate,
      ffmpegLocation: ffmpegStatic,
      mergeOutputFormat: 'webm',
      restrictFilenames: true,
      noCheckCertificates: true,
      noWarnings: true,
    };

    // --- İNDİRME ---
    try {
      win?.webContents.send('download:progress', {
        message: '720p WebM aranıyor…',
      });
      await runYtDlp(url, exact720Webm);
    } catch {
      win?.webContents.send('download:progress', {
        message: '720p WebM yok, ≤720p WebM’e düşülüyor…',
      });
      await runYtDlp(url, le720Webm);
    }

    // En son inen .webm dosyasını bul
    const webmPath = getLatestFile(downloadsDir, '.webm');
    if (!webmPath) {
      throw new Error('İndirme tamamlandı ama .webm dosyası bulunamadı.');
    }
    win?.webContents.send('download:progress', {
      message: `✅ WebM hazır: ${path.basename(webmPath)}`,
    });

    // --- DÖNÜŞÜM (WebM → MP4) ---
    const mp4Path = webmPath.replace(/\.webm$/i, '.mp4');
    win?.webContents.send('convert:progress', {
      message: 'WebM → MP4 dönüşüm başlatılıyor…',
    });

    await webmToMp4WithProgress(webmPath, mp4Path);

    // İstersen WebM'i sil
    if (!keepWebm) {
      try {
        unlinkSync(webmPath);
      } catch {}
    }

    return { ok: true, webm: keepWebm ? webmPath : null, mp4: mp4Path };
  }
);
