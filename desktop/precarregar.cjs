const { contextBridge } = require('electron');
contextBridge.exposeInMainWorld('NutriFotoDesktop', true);
