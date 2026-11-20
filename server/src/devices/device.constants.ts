/** Cookie that binds a browser/POS terminal to a registered device. */
export const DEVICE_COOKIE = 'restodash.device';

/** Device cookies stay valid for one year; servers can still revoke them. */
export const DEVICE_COOKIE_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;

export const DEVICE_NAME_MAX_LENGTH = 80;
