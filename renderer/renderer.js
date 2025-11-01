const urlsEl = document.getElementById("urls");
const heightEl = document.getElementById("height");
const logEl = document.getElementById("log");
const btn = document.getElementById("btn");

// preload kontrolü
if (!window.yt) {
  if (logEl) {
    logEl.textContent =
      "Preload yüklenemedi. Lütfen preload.cjs ve webPreferences ayarlarını kontrol edin.";
  }
}

function appendLog(line) {
  logEl.textContent += line + "\n";
  logEl.scrollTop = logEl.scrollHeight;
}

window.yt.onProgress(({ message }) => {
  appendLog(message.trim());
});

window.yt.onConvertProgress?.(({ message }) => {
  appendLog(message.trim());
});

btn.addEventListener("click", async () => {
  const raw = urlsEl.value.trim();
  if (!raw) return appendLog("Lütfen en az bir URL gir.");

  const maxHeight = parseInt(heightEl.value, 10) || 720;
  const urls = raw
    .split(/\r?\n/)
    .map((u) => u.trim())
    .filter((u) => u);

  appendLog(`Toplam ${urls.length} video işlenecek...\n`);

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    appendLog(`=== [${i + 1}/${urls.length}] ===`);
    appendLog(`URL: ${url}`);
    appendLog(`İndirme başladı… (<= ${maxHeight}p, mp4)`);

    try {
      await window.yt.download({ url, maxHeight });
      appendLog("✅ Tamamlandı!\n");
    } catch (e) {
      appendLog("❌ Hata: " + e.message + "\n");
    }
  }

  appendLog("🎉 Tüm videolar tamamlandı.");
});
