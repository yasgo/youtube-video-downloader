// preload.cjs
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('yt', {
  download: (payload) => ipcRenderer.invoke('download:youtube', payload),
  onProgress: (cb) => {
    const listener = (_evt, data) => cb(data);
    ipcRenderer.on('download:progress', listener);
    return () => ipcRenderer.removeListener('download:progress', listener);
  },
  onConvertProgress: (cb) => {
    const listener = (_evt, data) => cb(data);
    ipcRenderer.on('convert:progress', listener);
    return () => ipcRenderer.removeListener('convert:progress', listener);
  },
});
