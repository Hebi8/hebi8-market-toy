/**
 * Note: When using the Node.JS APIs, the config file
 * doesn't apply. Instead, pass options directly to the APIs.
 *
 * All configuration options: https://remotion.dev/docs/config
 */

import { Config } from "@remotion/cli/config";

Config.setRspack(true);
// The game is thin light lines on black: frames go to the encoder as PNG.
Config.setVideoImageFormat("png");
Config.setColorSpace("bt709");
Config.setCodec("h264");
// No sound is made here; the track is added by hand afterwards.
Config.setMuted(true);
// This machine also runs live services.
Config.setConcurrency(4);
Config.setOverwriteOutput(true);
