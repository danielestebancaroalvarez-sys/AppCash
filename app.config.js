const appJson = require('./app.json');

/**
 * Ensures Google Client IDs (and other EXPO_PUBLIC_*) are available in
 * Constants.expoConfig.extra for release builds where Metro inlining alone
 * is not enough on every path.
 */
module.exports = () => {
  const expo = appJson.expo;
  return {
    ...expo,
    extra: {
      ...(expo.extra ?? {}),
      googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '',
      googleAndroidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? '',
    },
  };
};
