// Learn more https://docs.expo.dev/guides/customizing-metro
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Don't resolve from the generated native folders or the local Gradle cache at
// the project root (only there: libraries have their own android/ folders).
const root = path.resolve(__dirname).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const blocked = [new RegExp(`^${root}/(android|ios|\\.gradle-home)/.*`)];
const existing = config.resolver.blockList;
config.resolver.blockList = existing
  ? [...(Array.isArray(existing) ? existing : [existing]), ...blocked]
  : blocked;

module.exports = config;
