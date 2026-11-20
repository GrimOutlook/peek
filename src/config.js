const fs = require('fs')
const path = require('path')
const { app } = require('electron')
const { readPrivateJson, writePrivateJson } = require('./private-json')
const { validateConfig } = require('./security')

function configPath() {
  return path.join(app.getPath('userData'), 'config.json')
}

function candidatePaths() {
  return [
    process.env.FRIGATE_OVERLAY_CONFIG,
    configPath()
  ].filter(Boolean)
}

function findConfig() {
  for (const file of candidatePaths()) {
    if (fs.existsSync(file)) return file
  }
  return null
}

function loadConfig() {
  const file = findConfig()
  if (!file) {
    throw new Error('config.json not found. Copy config.example.json to config.json and edit it.')
  }
  return validateConfig(readPrivateJson(file))
}

function readConfig() {
  try {
    return loadConfig()
  } catch (err) {
    console.error('[peek] configuration rejected: ' + err.message)
    return null
  }
}

function saveConfig(data) {
  writePrivateJson(configPath(), validateConfig(data))
}

module.exports = { loadConfig, readConfig, saveConfig, configPath, findConfig }
