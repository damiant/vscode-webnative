import mixpanel from 'mixpanel';
import { env } from 'vscode';
import { platform } from 'os';

const mp = mixpanel.init('f787e632a507ccd1838204b7b5ca70b3', { geolocate: true });

let anonymousUserId: string | undefined;
let userIdentified = false;

/**
 * Get a human-readable OS name for Mixpanel
 */
function getOSName(): string {
  const platformName = platform();
  switch (platformName) {
    case 'darwin':
      return 'macOS';
    case 'win32':
      return 'Windows';
    case 'linux':
      return 'Linux';
    default:
      return platformName;
  }
}

/**
 * Extract country code and region from VS Code language setting
 * Language format is typically: en-US, de-DE, pt-BR, etc.
 */
function getLocaleInfo(): { countryCode?: string; locale?: string } {
  const language = env.language;

  if (language && language.includes('-')) {
    const parts = language.split('-');
    return {
      countryCode: parts[1]?.toUpperCase(),
      locale: language,
    };
  }

  return { locale: language };
}

/**
 * Initialize telemetry with anonymous user tracking
 * Uses VS Code's machineId for anonymous user identification
 */
export function initializeTelemetry() {
  if (!userIdentified) {
    // Use VS Code's machineId for anonymous user tracking
    anonymousUserId = env.machineId;

    const localeInfo = getLocaleInfo();

    // Set user properties
    // ip: 1 tells Mixpanel to use the request IP for geolocation
    // Mixpanel will auto-resolve $city, $region, $country_code from the IP
    mp.people.set(anonymousUserId, {
      $distinct_id: anonymousUserId,
      $os: getOSName(),
      $ip: '1', // Tell Mixpanel to use request IP for geolocation
      locale: localeInfo.locale,
      country_code_from_locale: localeInfo.countryCode,
      vscode_version: env.appName,
      language: env.language,
      ui_kind: env.uiKind,
      is_telemetry_enabled: env.isTelemetryEnabled,
      first_seen: new Date().toISOString(),
    });

    userIdentified = true;
  }
}

/**
 * Track an event with optional properties
 * Automatically includes anonymous user ID
 */
export function writeEvent(event: string, props?: { [key: string]: any }) {
  if (!userIdentified) {
    initializeTelemetry();
  }

  // ip: 1 tells Mixpanel to use the request IP for geolocation
  // Mixpanel will automatically resolve $city, $region, and $country_code from IP
  mp.track(event, {
    distinct_id: anonymousUserId,
    $os: getOSName(),
    ...props,
  });
}

/**
 * Update user properties
 * Useful for tracking long-term user characteristics
 */
export function updateUserProperties(properties: { [key: string]: any }) {
  if (!userIdentified) {
    initializeTelemetry();
  }

  if (anonymousUserId) {
    mp.people.set(anonymousUserId, properties);
  }
}

/**
 * Increment a user property (e.g., number of times an action was performed)
 */
export function incrementUserProperty(property: string, value: number = 1) {
  if (!userIdentified) {
    initializeTelemetry();
  }

  if (anonymousUserId) {
    mp.people.increment(anonymousUserId, property, value);
  }
}

/**
 * Track a timed event
 * Returns a function to call when the event completes
 */
export function trackTimedEvent(event: string, props?: { [key: string]: any }): () => void {
  const startTime = Date.now();

  return () => {
    const duration = Date.now() - startTime;
    writeEvent(event, {
      ...props,
      duration_ms: duration,
    });
  };
}
