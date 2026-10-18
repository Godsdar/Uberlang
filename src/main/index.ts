import { join } from 'node:path'
import { app, BrowserWindow, ipcMain } from 'electron'
import { IPC } from '@shared/types'
import type { AnalyzeRequest, TranslateRequest } from '@shared/types'
import { translateSentence } from '../core/translate'
import { analyze } from '../core/analyze'

function createWindow (): void {
  const win = new BrowserWindow({
    width: 1180,
    height: 820,
    minWidth: 900,
    minHeight: 640,
    title: 'UberLang',
    backgroundColor: '#f4f1ea',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  const rendererUrl = process.env['ELECTRON_RENDERER_URL']
  if (rendererUrl) {
    win.loadURL(rendererUrl)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function registerIpc (): void {
  ipcMain.handle(IPC.translate, (_event, request: TranslateRequest) => translateSentence(request))
  ipcMain.handle(IPC.analyze, (_event, request: AnalyzeRequest) => analyze(request))
}

app.whenReady().then(() => {
  registerIpc()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
