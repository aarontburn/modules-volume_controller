import { app, BrowserWindow, Menu } from "electron";
import { ModuleController } from "./ModuleController";

const ipcMain: Electron.IpcMain = require('electron').ipcMain;
const guiHandler: ModuleController = new ModuleController(ipcMain, process.argv);


// Menu.setApplicationMenu(null)

app.whenReady().then(() => {
    guiHandler.start();
    app.on("activate", () => { // MacOS stuff
        if (BrowserWindow.getAllWindows().length === 0) {
            guiHandler.start();
        }
    });
});

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        guiHandler.stop();
        app.quit();
    }
});









