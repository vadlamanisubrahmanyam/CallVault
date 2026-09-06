// This local module has no JS surface — HomeScreen talks to it via
// expo-modules-core's requireNativeModule('CallRecorder'), which reads the
// native module registry directly rather than importing this file. This
// file exists only so `"main": "index.js"` in package.json resolves to a
// real file.
module.exports = {};
