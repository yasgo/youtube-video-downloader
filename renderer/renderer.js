const urlEl = document.getElementById('url');
const heightEl = document.getElementById('height');
const logEl = document.getElementById('log');
const btn = document.getElementById('btn');

// renderer/renderer.js
if (!window.yt) {
  const logEl = document.getElementById('log');
  if (logEl) {
    logEl.textContent =
      'Preload yüklenemedi. Lütfen preload.cjs ve webPreferences ayarlarını kontrol edin.';
  }
  // Burada return edip devam etmeyebilirsin
}

function appendLog(line) {
  logEl.textContent += line + '\n';
  logEl.scrollTop = logEl.scrollHeight;
}

// renderer.js
window.yt.onProgress(({ message }) => {
  appendLog(message.trim());
});

// MP4 dönüştürme logları:
window.yt.onConvertProgress?.(({ message }) => {
  appendLog(message.trim());
});

btn.addEventListener('click', async () => {
  const url = urlEl.value.trim();
  const maxHeight = parseInt(heightEl.value, 10) || 720;
  if (!url) return appendLog('Lütfen URL gir.');

  appendLog(`İndirme başladı… (<= ${maxHeight}p, mp4)`);
  try {
    await window.yt.download({ url, maxHeight });
    appendLog('✅ Tamamlandı!');
  } catch (e) {
    appendLog('❌ Hata: ' + e.message);
  }
});
