const { withAppBuildGradle } = require('@expo/config-plugins');

/**
 * Wires the committed self-signed keystore (android-signing/release.keystore)
 * into the release build type, so `gradlew assembleRelease` produces a
 * signed, installable APK in CI without needing an EAS account or manually
 * editing the generated android/ folder after every `expo prebuild`.
 *
 * This keystore is for personal sideloading only — not suitable for a
 * Play Store submission, where a securely-stored, non-committed keystore
 * would be required instead.
 */
module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (config) => {
    let contents = config.modResults.contents;

    if (!contents.includes('callvault release signing')) {
      // Add a signingConfigs.release block right after the "android {" opening line.
      contents = contents.replace(
        /android\s*\{/,
        `android {
    // callvault release signing
    signingConfigs {
        release {
            storeFile file("../../android-signing/release.keystore")
            storePassword "callvault123"
            keyAlias "callvault"
            keyPassword "callvault123"
        }
    }
`
      );

      // Point the release buildType at the new signing config.
      contents = contents.replace(
        /(buildTypes\s*\{[\s\S]*?release\s*\{)/,
        `$1
            signingConfig signingConfigs.release`
      );
    }

    config.modResults.contents = contents;
    return config;
  });
};
