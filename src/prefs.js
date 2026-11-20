const fs = require('fs')
const path = require('path')
const { app } = require('electron')
const { readPrivateJson, writePrivateJson } = require('./private-json')

function prefsPath() {
  return path.join(app.getPath('userData'), 'preferences.json')
}

function readPrefs() {
  try {
    return readPrivateJson(prefsPath())
  } catch (err) {
    return {}
  }
}

function writePrefs(prefs) {
  try {
    writePrivateJson(prefsPath(), prefs)
  } catch (err) {}
}

module.exports = { readPrefs, writePrefs }
