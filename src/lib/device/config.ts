/**
 * Everything the console assumes about the Breathband hardware, in one place.
 *
 * What is known comes from the Flutter app (`breathband-app/lib/bluetooth_manager.dart`
 * and `calibration_procedure.dart`): the band advertises as "BreathBand", sends
 * one ASCII number per notification, and takes newline-terminated text commands
 * ("calibration", "start") on a write characteristic. The app samples the latest
 * value every 50 ms (20 Hz) rather than per notification, and so does the console.
 *
 * What is ASSUMED, and must be confirmed against the firmware before a real band
 * is used, is marked ASSUMPTION. The app never names its UUIDs (it takes whatever
 * notify and write characteristics it finds), but Web Bluetooth must declare the
 * services it will open up front, so the console assumes the Nordic UART Service.
 */

/** The advertised name, exactly as the app scans for it. */
export const BAND_NAME = "BreathBand";

/**
 * ASSUMPTION: the band speaks the Nordic UART Service (NUS), the usual choice for
 * a text-over-BLE device and consistent with the app's newline framing.
 */
export const NUS = {
  service: "6e400001-b5a3-f393-e0a9-e50e24dcca9e",
  /** Central → band (write). */
  rx: "6e400002-b5a3-f393-e0a9-e50e24dcca9e",
  /** Band → central (notify). */
  tx: "6e400003-b5a3-f393-e0a9-e50e24dcca9e",
} as const;

/**
 * Services the console asks permission for. Battery is standard and optional:
 * if the band doesn't expose it the console simply shows no battery level.
 */
export const OPTIONAL_SERVICES = [NUS.service, "battery_service"] as const;

/** Text commands the band understands, sent newline-terminated (`calibration_procedure.dart`). */
export const BAND_COMMANDS = {
  calibrate: "calibration",
  start: "start",
} as const;

/** The app's sampling clock: the latest value is read every 50 ms. */
export const SAMPLE_RATE_HZ = 20;

/** How long the console keeps trying to reconnect after the band drops, before giving up. */
export const RECONNECT = { attempts: 3, firstDelayMs: 800 } as const;

/**
 * ASSUMPTION: the strap-tension gauge reads the raw resting level and is green
 * inside this band of raw counts. The simulator's sensor uses the same scale.
 * Replace with the firmware's real range when it is known.
 */
export const STRAP_TENSION = { min: 1700, max: 2400, full: 3000 } as const;

/** No sample for this long while connected means the stream has stalled. */
export const STALL_MS = 1500;
