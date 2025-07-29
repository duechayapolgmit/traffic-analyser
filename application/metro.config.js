// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Resolvers
config.resolver.assetExts.push('bin', 'tflite', 'png', 'jpg')

module.exports = config;
