# 🎬 YouTube Video Downloader (Electron + yt-dlp + ffmpeg)

This is a **desktop application built with Electron** that allows downloading YouTube videos and converting them from **WebM → MP4 (H.264 + AAC)** format.  
The app streams real-time progress updates from both the download and conversion processes to the UI.

---

## 🚀 Features

- 📥 **Download YouTube videos** using `yt-dlp`
- 🎶 **Merge audio + video** automatically (via ffmpeg-static)
- 🔄 **Convert WebM → MP4** with `libx264 + AAC`
- ⏱ **Progress tracking** (percentage + remaining time)
- 🧹 Optional **auto-delete of original WebM**
- 🖥 Real-time **IPC messaging** to Renderer

---

## 📦 Tech Stack

| Technology                                                                             | Purpose                                  |
| -------------------------------------------------------------------------------------- | ---------------------------------------- |
| [Electron](https://www.electronjs.org/)                                                | Desktop app framework                    |
| [yt-dlp](https://github.com/yt-dlp/yt-dlp) (`youtube-dl-exec`)                         | Video downloader                         |
| [ffmpeg-static](https://github.com/eugeneware/ffmpeg-static)                           | ffmpeg binary (used for merging)         |
| [fluent-ffmpeg](https://github.com/fluent-ffmpeg/node-fluent-ffmpeg)                   | ffmpeg wrapper for Node.js               |
| [@ffmpeg-installer/ffmpeg](https://www.npmjs.com/package/@ffmpeg-installer/ffmpeg)     | Cross-platform ffmpeg binary             |
| [@ffprobe-installer/ffprobe](https://www.npmjs.com/package/@ffprobe-installer/ffprobe) | ffprobe binary to inspect video metadata |

---

## 📂 Project Structure

```
project-root/
├─ main.js                # Electron main process (entry point)
├─ preload.cjs            # Secure preload for Renderer
├─ renderer/
│  └─ index.html          # Basic UI
├─ downloads/             # Default download directory
```

---

## ⚙️ Workflow

1. **Renderer triggers IPC call**

   ```js
   ipcRenderer.invoke('download:youtube', { url, maxHeight, outDir, keepWebm });
   ```

   - `url`: YouTube video URL
   - `maxHeight`: Max video resolution (default: 720p)
   - `outDir`: Target download folder
   - `keepWebm`: Keep original WebM file or delete after conversion

2. **Main Process (`main.js`)**

   - Calls `yt-dlp` to download the video
   - Streams **stdout/stderr** to Renderer via `download:progress`
   - Finds the most recently downloaded `.webm` file
   - Converts it to MP4 using `fluent-ffmpeg`
   - Sends progress updates via `convert:progress`

3. **Result**
   - Returns `{ ok: true, mp4: "...", webm: "..." }`
   - Deletes WebM if `keepWebm` is `false`

---

## 🔑 Key Functions

### `runYtDlp(url, opts)`

Runs `yt-dlp` with given options, streams logs to Renderer.

### `getLatestFile(dir, ext)`

Finds the latest modified file with a given extension in a directory.

### `probeDurationSeconds(filePath)`

Uses ffprobe to calculate total video duration in seconds.

### `webmToMp4WithProgress(input, output)`

Converts WebM to MP4 while emitting progress events (percentage & ETA).

---

## 🖥 IPC Events

| Event Name          | Description                          |
| ------------------- | ------------------------------------ |
| `download:progress` | Logs / progress messages from yt-dlp |
| `convert:progress`  | Progress updates from MP4 conversion |

---

## 📝 Example (Renderer)

```js
import { ipcRenderer } from 'electron';

async function startDownload() {
  const result = await ipcRenderer.invoke('download:youtube', {
    url: 'https://www.youtube.com/watch?v=xxxxxxx',
    maxHeight: 720,
    outDir: './downloads',
    keepWebm: false,
  });

  console.log('Result:', result);
}

ipcRenderer.on('download:progress', (_, data) =>
  console.log('Download:', data.message)
);
ipcRenderer.on('convert:progress', (_, data) =>
  console.log('Convert:', data.message)
);

startDownload();
```

---

## ⚡ Possible Improvements

- Use `yt-dlp --print filename` to get exact output path (instead of guessing latest file)
- Use `--recode-video mp4` to download directly as MP4 (skips conversion step)
- Format progress as JSON using `--progress-template`
- Sanitize filenames using [`sanitize-filename`](https://www.npmjs.com/package/sanitize-filename)
- Add a proper **progress bar UI** in Renderer

---

## 🛠 Installation & Run

```bash
# Install dependencies
npm install

# Development mode
npm run start

# Build (example)
npm run build
```

---

## 📜 License

MIT
