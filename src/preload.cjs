// src/preload.cjs
// Ponte segura entre as janelas (controle e tela) e o processo principal.
// CommonJS porque roda com sandbox: true.
const { contextBridge, ipcRenderer } = require('electron');

function ouvir(canal) {
  return (cb) => {
    const ouvinte = (_evento, dado) => cb(dado);
    ipcRenderer.on(canal, ouvinte);
    return () => ipcRenderer.removeListener(canal, ouvinte);
  };
}

contextBridge.exposeInMainWorld('vl', {
  // controle
  conectar: (arroba) => ipcRenderer.invoke('vl:conectar', String(arroba ?? '')),
  desconectar: () => ipcRenderer.invoke('vl:desconectar'),
  config: {
    ler: () => ipcRenderer.invoke('vl:config.ler'),
    salvar: (mudancas) => ipcRenderer.invoke('vl:config.salvar', mudancas),
  },
  testar: (tipo) => ipcRenderer.invoke('vl:testar', tipo),
  abrirPastaDados: () => ipcRenderer.invoke('vl:abrirPastaDados'),
  abrirLogs: () => ipcRenderer.invoke('vl:abrirLogs'),
  abrirTela: () => ipcRenderer.invoke('vl:abrirTela'),
  aoEstado: ouvir('vl:aoEstado'),
  aoRegistro: ouvir('vl:aoRegistro'),
  aoFila: ouvir('vl:aoFila'),
  aoAviso: ouvir('vl:aoAviso'),
  // tela
  aoMostrar: ouvir('vl:aoMostrar'),
});
