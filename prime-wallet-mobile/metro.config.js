const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// Setup for ethers v6 and noble/hashes
config.resolver.unstable_enablePackageExports = true;
config.resolver.sourceExts.push('mjs', 'cjs');

module.exports = withNativeWind(config, { input: "./global.css" });
