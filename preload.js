/**
 * =============================================================================
 * © 2026 VeryCoolApps — PT. Agra Karya Digital
 * ALL RIGHTS RESERVED — PROPRIETARY & CONFIDENTIAL
 * =============================================================================
 * @product    SalesDesk Pro v1.0.0 — Preload Bridge (contextIsolation)
 * @license    PROPRIETARY — lihat LICENSE.md
 * =============================================================================
 */
'use strict';
const { contextBridge, ipcRenderer } = require('electron');

const api = {
  boot: () => ipcRenderer.invoke('app:boot'),
  login: (u, p) => ipcRenderer.invoke('auth:login', u, p),
  logout: () => ipcRenderer.invoke('auth:logout'),
  lock: () => ipcRenderer.invoke('auth:lock'),
  unlock: (p) => ipcRenderer.invoke('auth:unlock', p),
  activate: (key) => ipcRenderer.invoke('license:activate', key),
  licenseStatus: () => ipcRenderer.invoke('license:status'),
  call: (fn, ...args) => ipcRenderer.invoke('svc:call', fn, args),
  flush: () => ipcRenderer.invoke('app:flush'),
  quit: () => ipcRenderer.invoke('app:quit'),
  openPath: (p) => ipcRenderer.invoke('app:openPath', p),
  onLock: (cb) => ipcRenderer.on('ui:lock', () => cb())
};

contextBridge.exposeInMainWorld('sdp', api);
