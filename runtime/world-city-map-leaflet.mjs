const LEAFLET_VERSION = "1.6.0";
const LEAFLET_LOAD_TIMEOUT_MS = 8000;
const LEAFLET_SCRIPT = "modules/cyberpunk-remaster/vendor/leaflet/leaflet.js";

export const DEFAULT_NIGHT_CITY_TILESET = Object.freeze({
  id: "night-city-2045",
  title: "Night City 2045 Atlas",
  width: 10600,
  height: 16384,
  tileSize: 256,
  minNativeZoom: 0,
  maxNativeZoom: 5,
  maxZoom: 7,
  urlTemplate: "modules/cyberpunk-remaster/assets/maps/night-city-2045/tiles/z{z}/{x}-{y}.webp",
});

const clamp01 = (value) => Math.max(0, Math.min(1, Number.isFinite(Number(value)) ? Number(value) : 0));

function logicalSize(manifest = DEFAULT_NIGHT_CITY_TILESET) {
  const scale = 2 ** Math.max(0, Number(manifest?.maxNativeZoom) || 0);
  return {
    width: Math.max(1, Number(manifest?.width) || DEFAULT_NIGHT_CITY_TILESET.width) / scale,
    height: Math.max(1, Number(manifest?.height) || DEFAULT_NIGHT_CITY_TILESET.height) / scale,
  };
}

export function normalizedToLeafletLatLng(point, manifest = DEFAULT_NIGHT_CITY_TILESET) {
  const { width, height } = logicalSize(manifest);
  const x = clamp01(point?.x);
  const y = clamp01(point?.y);
  return {
    lat: y === 0 ? 0 : -y * height,
    lng: x * width,
  };
}

export function leafletLatLngToNormalized(latlng, manifest = DEFAULT_NIGHT_CITY_TILESET) {
  const { width, height } = logicalSize(manifest);
  return {
    x: clamp01((Number(latlng?.lng) || 0) / width),
    y: clamp01(-(Number(latlng?.lat) || 0) / height),
  };
}

let leafletLoadPromise = null;

export function loadWorldCityLeaflet() {
  if (globalThis.L?.version === LEAFLET_VERSION) return Promise.resolve(globalThis.L);
  if (leafletLoadPromise) return leafletLoadPromise;

  leafletLoadPromise = new Promise((resolve, reject) => {
    const doc = globalThis.document;
    if (!doc?.head) {
      reject(new Error("Leaflet requires a browser document"));
      return;
    }

    let settled = false;
    let timer = null;
    const settle = (callback, value) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      callback(value);
    };
    const fail = (message) => settle(reject, new Error(message));
    const finish = () => {
      if (globalThis.L?.version === LEAFLET_VERSION) {
        settle(resolve, globalThis.L);
      } else {
        fail(`Leaflet ${LEAFLET_VERSION} did not initialize`);
      }
    };

    timer = setTimeout(() => {
      fail(`Leaflet ${LEAFLET_VERSION} local runtime load timeout after ${LEAFLET_LOAD_TIMEOUT_MS} ms`);
    }, LEAFLET_LOAD_TIMEOUT_MS);

    let script = doc.querySelector?.(`script[data-cpr-leaflet="${LEAFLET_VERSION}"]`);
    if (script) {
      if (globalThis.L?.version === LEAFLET_VERSION) finish();
      else {
        script.addEventListener("load", finish, { once: true });
        script.addEventListener("error", () => fail("Failed to load local Leaflet runtime"), { once: true });
      }
      return;
    }

    script = doc.createElement("script");
    script.dataset.cprLeaflet = LEAFLET_VERSION;
    script.src = LEAFLET_SCRIPT;
    script.async = true;
    script.addEventListener("load", finish, { once: true });
    script.addEventListener("error", () => fail("Failed to load local Leaflet runtime"), { once: true });
    doc.head.appendChild(script);
  }).catch((error) => {
    leafletLoadPromise = null;
    throw error;
  });

  return leafletLoadPromise;
}

function sourceBounds(L, manifest) {
  const { width, height } = logicalSize(manifest);
  return L.latLngBounds([0, 0], [-height, width]);
}

function loadImageDimensions(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({
      width: Math.max(1, Number(image.naturalWidth) || DEFAULT_NIGHT_CITY_TILESET.width),
      height: Math.max(1, Number(image.naturalHeight) || DEFAULT_NIGHT_CITY_TILESET.height),
    });
    image.onerror = () => reject(new Error(`Не удалось открыть изображение карты: ${source}`));
    image.src = source;
  });
}

export function worldCityMarkerSizeForZoom(zoom) {
  const value = Number(zoom);
  if (!Number.isFinite(value) || value <= 2) return 24;
  if (value < 4) return 30;
  if (value < 5) return 36;
  if (value < 6) return 42;
  return 48;
}

function markerIcon(L, marker, zoom = 2) {
  const size = worldCityMarkerSizeForZoom(zoom);
  return L.divIcon({
    className: `world-city-map-leaflet-div-icon world-city-map-marker-size-${size}`,
    html: String(marker?.html ?? ""),
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
  });
}

export async function createWorldCityLeafletMap(container, options = {}) {
  if (!container) throw new Error("World map Leaflet container is missing");
  const L = await loadWorldCityLeaflet();

  const customImage = String(options.image ?? "").trim();
  let manifest = { ...DEFAULT_NIGHT_CITY_TILESET };
  if (customImage) {
    const dimensions = await loadImageDimensions(customImage);
    manifest = {
      ...manifest,
      ...dimensions,
      maxNativeZoom: 2,
      maxZoom: 6,
    };
  }

  const bounds = sourceBounds(L, manifest);
  const map = L.map(container, {
    crs: L.CRS.Simple,
    minZoom: -2,
    maxZoom: Number(manifest.maxZoom) || Number(DEFAULT_NIGHT_CITY_TILESET.maxZoom) || 7,
    zoomControl: false,
    attributionControl: false,
    zoomSnap: 0.25,
    zoomDelta: 1,
    scrollWheelZoom: true,
    doubleClickZoom: true,
    boxZoom: true,
    keyboard: true,
    dragging: true,
    inertia: true,
    maxBounds: bounds.pad(0.25),
    maxBoundsViscosity: 0.85,
  });

  let baseLayer;
  if (customImage) {
    baseLayer = L.imageOverlay(customImage, bounds, {
      interactive: false,
      className: "world-city-map-custom-image",
    }).addTo(map);
  } else {
    baseLayer = L.tileLayer(DEFAULT_NIGHT_CITY_TILESET.urlTemplate, {
      tileSize: DEFAULT_NIGHT_CITY_TILESET.tileSize,
      minZoom: -2,
      maxZoom: Number(manifest.maxZoom) || Number(DEFAULT_NIGHT_CITY_TILESET.maxZoom) || 7,
      minNativeZoom: DEFAULT_NIGHT_CITY_TILESET.minNativeZoom,
      maxNativeZoom: DEFAULT_NIGHT_CITY_TILESET.maxNativeZoom,
      bounds,
      noWrap: true,
      keepBuffer: 2,
      updateWhenIdle: false,
    }).addTo(map);
  }

  const markerLayer = L.layerGroup().addTo(map);
  const markerObjects = new Map();
  const markerDataObjects = new Map();
  let placementMode = false;
  let destroyed = false;
  let initialFitDone = false;
  let resizeObserver = null;

  function hasUsableContainerSize() {
    const rect = container.getBoundingClientRect?.();
    if (!rect) return true;
    return Number(rect.width) > 2 && Number(rect.height) > 2;
  }

  function fit({ initial = false } = {}) {
    if (destroyed || !hasUsableContainerSize()) return false;
    map.invalidateSize(false);
    map.fitBounds(bounds, { padding: [16, 16], animate: false });
    if (initial) {
      const closerZoom = Math.min(map.getMaxZoom(), map.getZoom() + 0.5);
      map.setZoom(closerZoom, { animate: false });
      initialFitDone = true;
    }
    return true;
  }

  function ensureInitialFit() {
    if (destroyed || initialFitDone) return;
    fit({ initial: true });
  }

  const ResizeObserverCtor = globalThis.ResizeObserver;
  if (typeof ResizeObserverCtor === "function") {
    resizeObserver = new ResizeObserverCtor(() => {
      if (destroyed) return;
      map.invalidateSize(false);
      ensureInitialFit();
    });
    resizeObserver.observe(container);
  }

  function setPlacementMode(enabled) {
    placementMode = Boolean(enabled);
    container.closest?.("[data-world-map-viewport]")?.classList?.toggle?.("placing", placementMode);
    if (placementMode) map.dragging?.disable?.();
    else map.dragging?.enable?.();
  }

  function setMarkers(markers = []) {
    markerLayer.clearLayers();
    markerObjects.clear();
    markerDataObjects.clear();
    for (const marker of Array.isArray(markers) ? markers : []) {
      const id = String(marker?.id ?? "").trim();
      if (!id) continue;
      const leafletMarker = L.marker(normalizedToLeafletLatLng(marker, manifest), {
        icon: markerIcon(L, marker, map.getZoom()),
        draggable: Boolean(options.isGM),
        keyboard: true,
        riseOnHover: true,
        title: String(marker?.title ?? "Точка интереса"),
      });
      leafletMarker.on("click", () => options.onMarkerClick?.(id));
      leafletMarker.on("dragend", (event) => {
        const next = leafletLatLngToNormalized(event.target.getLatLng(), manifest);
        options.onMarkerDragEnd?.(id, next);
      });
      leafletMarker.addTo(markerLayer);
      markerObjects.set(id, leafletMarker);
      markerDataObjects.set(id, marker);
    }
  }

  map.on("zoomend", () => {
    if (destroyed) return;
    for (const [id, leafletMarker] of markerObjects) {
      const markerData = markerDataObjects.get(id);
      if (markerData) leafletMarker.setIcon(markerIcon(L, markerData, map.getZoom()));
    }
  });

  function focusMarker(markerId, { zoom = null } = {}) {
    const marker = markerObjects.get(String(markerId ?? ""));
    if (!marker || destroyed) return false;
    const targetZoom = Number.isFinite(Number(zoom))
      ? Math.max(map.getMinZoom(), Math.min(map.getMaxZoom(), Number(zoom)))
      : map.getZoom();
    initialFitDone = true;
    map.setView(marker.getLatLng(), targetZoom, { animate: false });
    return true;
  }

  map.on("click", (event) => {
    if (!placementMode) return;
    options.onMapClick?.(leafletLatLngToNormalized(event.latlng, manifest), event);
  });

  const onBaseError = (event) => options.onImageError?.(event);
  baseLayer.on?.("tileerror", onBaseError);
  baseLayer.on?.("error", onBaseError);

  requestAnimationFrame(() => {
    if (!destroyed) ensureInitialFit();
  });

  return {
    map,
    manifest,
    bounds,
    setMarkers,
    setPlacementMode,
    focusMarker,
    fit,
    zoomIn() { if (!destroyed) map.zoomIn(1); },
    zoomOut() { if (!destroyed) map.zoomOut(1); },
    invalidateSize() { if (!destroyed) map.invalidateSize(false); },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      resizeObserver?.disconnect?.();
      resizeObserver = null;
      markerObjects.clear();
      markerDataObjects.clear();
      markerLayer.clearLayers();
      map.off();
      map.remove();
      container.innerHTML = "";
    },
  };
}
