import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { updateLocationAPI } from '../networks/delivery/deliveryNetwork';

export interface LocationData {
  lat: number;
  lng: number;
  heading: number | null;
  speed: number | null;
  accuracy: number | null;
  timestamp: number;
}

type LocationListener = (data: LocationData) => void;

// Background task identifier registered with the OS.
export const BACKGROUND_LOCATION_TASK = 'finmatrix-background-location';

// Master kill-switch for online location tracking. When false, the service
// requests no permission, starts no foreground/background tracking, and
// sends no GPS to the backend. Re-enabled for phase3 Chunk 1 (delivery
// module production-ready); tracking runs only while the rider is on duty
// or actively working a delivery, and stops off-shift.
// NOTE: background tracking needs a dev/standalone build — Expo Go and web
// fall back to foreground-only updates (handled below).
const TRACKING_ENABLED = true;

// Minimum movement in meters before we POST a new fix (saves battery + rows).
const MIN_DISTANCE_METERS = 10;
// Deliver an update at least this often even when stationary (online heartbeat).
const TRACKING_INTERVAL_MS = 15_000;
// OS-level distance filter for delivering updates to the task.
const DISTANCE_FILTER_METERS = 20;

function haversineDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 6371e3;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toLocationData(pos: Location.LocationObject): LocationData {
  return {
    lat: pos.coords.latitude,
    lng: pos.coords.longitude,
    heading: pos.coords.heading ?? null,
    speed: pos.coords.speed != null ? Math.max(0, pos.coords.speed) : null,
    accuracy: pos.coords.accuracy ?? null,
    timestamp: pos.timestamp,
  };
}

class LocationService {
  private _isTracking = false;
  private _lastPosition: LocationData | null = null;
  private _lastSentPosition: LocationData | null = null;
  private _permissionGranted = false;
  private _backgroundGranted = false;
  private _listeners: Set<LocationListener> = new Set();

  get isTracking() { return this._isTracking; }
  get lastPosition() { return this._lastPosition; }
  get permissionGranted() { return this._permissionGranted; }
  get backgroundGranted() { return this._backgroundGranted; }

  addListener(fn: LocationListener): () => void {
    this._listeners.add(fn);
    return () => { this._listeners.delete(fn); };
  }

  private notifyListeners(data: LocationData): void {
    this._listeners.forEach(fn => fn(data));
  }

  /** Request foreground (required) and background (best-effort) permissions. */
  async requestPermission(): Promise<boolean> {
    if (!TRACKING_ENABLED) return true; // no prompt while tracking is disabled
    try {
      const fg = await Location.requestForegroundPermissionsAsync();
      this._permissionGranted = fg.status === 'granted';
      if (this._permissionGranted) {
        try {
          const bg = await Location.requestBackgroundPermissionsAsync();
          this._backgroundGranted = bg.status === 'granted';
        } catch {
          this._backgroundGranted = false;
        }
      }
      return this._permissionGranted;
    } catch {
      this._permissionGranted = false;
      return false;
    }
  }

  async getCurrentPosition(): Promise<LocationData | null> {
    try {
      if (!this._permissionGranted) {
        const granted = await this.requestPermission();
        if (!granted) return null;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const data = toLocationData(pos);
      this._lastPosition = data;
      this.notifyListeners(data);
      return data;
    } catch {
      return null;
    }
  }

  /**
   * Called by the background task (and the immediate-send path) with a fresh
   * fix. Updates the in-app UI and POSTs to the backend when we've moved far
   * enough (or when forced).
   */
  async ingest(data: LocationData, force = false): Promise<void> {
    this._lastPosition = data;
    this.notifyListeners(data);
    if (!force && this._lastSentPosition) {
      const moved = haversineDistance(
        this._lastSentPosition.lat, this._lastSentPosition.lng,
        data.lat, data.lng,
      );
      if (moved < MIN_DISTANCE_METERS) return;
    }
    try {
      await updateLocationAPI(data.lat, data.lng, {
        heading: data.heading,
        speed: data.speed,
        accuracy: data.accuracy,
        timestamp: data.timestamp,
      });
      this._lastSentPosition = data;
    } catch {
      // Silent — the OS will deliver another fix shortly.
    }
  }

  /** Send an immediate update (e.g. on a status transition). */
  async sendImmediateUpdate(): Promise<LocationData | null> {
    if (!TRACKING_ENABLED) return null;
    const data = await this.getCurrentPosition();
    if (data) await this.ingest(data, true);
    return data;
  }

  /**
   * Begin continuous tracking. Uses an OS background task so location keeps
   * flowing when the app is backgrounded or the phone is locked, with an
   * Android foreground-service notification (required on modern Android).
   */
  async startTracking(intervalMs = TRACKING_INTERVAL_MS): Promise<void> {
    if (!TRACKING_ENABLED) return; // online tracking disabled
    if (this._isTracking) return;
    const granted = await this.requestPermission();
    if (!granted) return;
    this._isTracking = true;

    // Immediate first fix so the map populates and admin sees us online.
    this.sendImmediateUpdate();

    try {
      const already = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK).catch(() => false);
      if (!already) {
        await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
          accuracy: Location.Accuracy.High,
          timeInterval: intervalMs,
          distanceInterval: DISTANCE_FILTER_METERS,
          pausesUpdatesAutomatically: false,
          showsBackgroundLocationIndicator: true,
          activityType: Location.ActivityType.AutomotiveNavigation,
          foregroundService: {
            notificationTitle: 'FinMatrix — On Delivery',
            notificationBody: 'Sharing your live location with dispatch.',
            notificationColor: '#0A1628',
          },
        });
      }
    } catch {
      // Background updates unavailable (e.g. permission/sdk) — the immediate
      // send above still works; foreground status changes still call ingest.
    }
  }

  async stopTracking(): Promise<void> {
    this._isTracking = false;
    try {
      const started = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK).catch(() => false);
      if (started) await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    } catch {
      // ignore
    }
  }
}

export const locationService = new LocationService();

// ──────────────────────────────────────────────────────────────────────────
// Background task — defined at module scope so the OS can invoke it even after
// the app is relaunched. Import this module from the app entry point so the
// registration runs on every cold start.
// ──────────────────────────────────────────────────────────────────────────
TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
  if (error) return;
  const locations = (data as { locations?: Location.LocationObject[] } | undefined)?.locations;
  if (!locations || !locations.length) return;
  // Use the freshest fix in the batch.
  const latest = locations[locations.length - 1];
  await locationService.ingest(toLocationData(latest));
});
