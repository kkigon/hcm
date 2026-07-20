"use client";

import { useEffect, useRef, useState } from "react";
import type { Map, Marker, Popup } from "maplibre-gl";
import type { LngLat, Question, Stop } from "../data/questions";

export type MapPhase = "menu" | "countdown" | "playing" | "reveal" | "summary";

type FocusTarget = {
  coordinates: LngLat;
  key: number;
};

type GameMapProps = {
  question: Question;
  phase: MapPhase;
  focusTarget: FocusTarget | null;
  selectedStop: Stop | null;
  onStopSelect: (stop: Stop) => void;
};

type NaverCoord = object;
type NaverEventListener = object;

type NaverMapInstance = {
  destroy: () => void;
  fitBounds: (coordinates: NaverCoord[], options?: Record<string, number>) => void;
  morph: (coordinate: NaverCoord, zoom?: number, options?: { duration?: number }) => void;
  refresh: (noEffect?: boolean) => void;
};

type NaverMarkerInstance = {
  setMap: (map: NaverMapInstance | null) => void;
};

type NaverPolylineInstance = {
  setMap: (map: NaverMapInstance | null) => void;
};

type NaverInfoWindowInstance = {
  close: () => void;
  open: (map: NaverMapInstance, anchor: NaverMarkerInstance | NaverCoord) => void;
};

type NaverMapsNamespace = {
  Event: {
    addListener: (target: object, eventName: string, listener: () => void) => NaverEventListener;
    removeListener: (listener: NaverEventListener) => void;
  };
  InfoWindow: new (options: Record<string, unknown>) => NaverInfoWindowInstance;
  LatLng: new (latitude: number, longitude: number) => NaverCoord;
  Map: new (container: HTMLElement, options: Record<string, unknown>) => NaverMapInstance;
  Marker: new (options: Record<string, unknown>) => NaverMarkerInstance;
  Point: new (x: number, y: number) => object;
  Polyline: new (options: Record<string, unknown>) => NaverPolylineInstance;
  Size: new (width: number, height: number) => object;
};

type NaverWindow = Window &
  typeof globalThis & {
    naver?: { maps: NaverMapsNamespace };
    navermap_authFailure?: () => void;
  };

type OpenBackend = {
  provider: "open";
  map: Map;
  maplibre: typeof import("maplibre-gl");
  markers: Marker[];
  popup: Popup | null;
};

type NaverBackend = {
  provider: "naver";
  map: NaverMapInstance;
  maps: NaverMapsNamespace;
  markers: NaverMarkerInstance[];
  polylines: NaverPolylineInstance[];
  popup: NaverInfoWindowInstance | null;
};

type MapBackend = OpenBackend | NaverBackend;
type ProviderState = "loading" | "naver" | "open" | "error";

const KOREA_CENTER: LngLat = [127.75, 36.15];
const NAVER_CLIENT_ID = import.meta.env.VITE_NAVER_MAP_CLIENT_ID?.trim() ?? "";
let naverMapsPromise: Promise<NaverMapsNamespace> | null = null;

function loadNaverMaps(clientId: string) {
  const naverWindow = window as NaverWindow;
  if (naverWindow.naver?.maps) return Promise.resolve(naverWindow.naver.maps);
  if (naverMapsPromise) return naverMapsPromise;

  naverMapsPromise = new Promise<NaverMapsNamespace>((resolve, reject) => {
    let settled = false;
    let timeout = 0;
    const finish = (maps?: NaverMapsNamespace, error?: Error) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      if (maps) resolve(maps);
      else {
        naverMapsPromise = null;
        reject(error ?? new Error("네이버 지도 SDK를 불러오지 못했습니다."));
      }
    };

    naverWindow.navermap_authFailure = () => {
      window.dispatchEvent(new Event("hcm:naver-auth-failure"));
      finish(undefined, new Error("네이버 지도 Client ID 또는 Web 서비스 URL 인증에 실패했습니다."));
    };

    const script = document.createElement("script");
    script.async = true;
    script.dataset.hcmNaverMap = "true";
    script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(clientId)}`;
    script.addEventListener("load", () => {
      const maps = naverWindow.naver?.maps;
      finish(maps, maps ? undefined : new Error("네이버 지도 SDK 초기화에 실패했습니다."));
    }, { once: true });
    script.addEventListener("error", () => finish(undefined, new Error("네이버 지도 SDK 네트워크 요청에 실패했습니다.")), {
      once: true,
    });

    timeout = window.setTimeout(
      () => finish(undefined, new Error("네이버 지도 SDK 응답 시간이 초과되었습니다.")),
      15_000,
    );
    document.head.appendChild(script);
  });

  return naverMapsPromise;
}

function makeEndpointElement(type: "start" | "finish", label: string) {
  const element = document.createElement("div");
  element.className = `endpoint-marker endpoint-marker--${type}`;
  element.setAttribute("aria-label", label);
  element.innerHTML = `<span>${type === "start" ? "출" : "도"}</span><i></i>`;
  return element;
}

function makeStopElement(stop: Stop, active = false) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `stop-marker ${active ? "is-active" : ""}`;
  button.setAttribute("aria-label", `${stop.name} 교통 정보 보기`);
  button.textContent = stop.kind === "버스정류장" ? "B" : stop.kind === "기차역" ? "K" : "S";
  return button;
}

function makePopupContent(stop: Stop) {
  const wrap = document.createElement("div");
  wrap.className = "map-stop-popup";

  const type = document.createElement("span");
  type.className = "map-stop-popup__type";
  type.textContent = stop.kind;

  const title = document.createElement("strong");
  title.textContent = stop.name;

  const lines = document.createElement("p");
  lines.textContent = stop.lines.join(" · ");

  const description = document.createElement("small");
  description.textContent = stop.description;

  wrap.append(type, title, lines, description);
  return wrap;
}

function clearBackendOverlays(backend: MapBackend) {
  if (backend.provider === "open") {
    backend.markers.forEach((marker) => marker.remove());
    backend.markers = [];
    backend.popup?.remove();
    backend.popup = null;
  } else {
    backend.markers.forEach((marker) => marker.setMap(null));
    backend.markers = [];
    backend.popup?.close();
    backend.popup = null;
  }
}

function clearNaverPolylines(backend: NaverBackend) {
  backend.polylines.forEach((polyline) => polyline.setMap(null));
  backend.polylines = [];
}

export function GameMap({ question, phase, focusTarget, selectedStop, onStopSelect }: GameMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const backendRef = useRef<MapBackend | null>(null);
  const [provider, setProvider] = useState<ProviderState>("loading");
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let cancelled = false;
    let fallbackStarted = false;

    async function createOpenMap(reason?: string) {
      if (!mapContainerRef.current || cancelled) return;
      if (fallbackStarted || backendRef.current?.provider === "open") return;
      fallbackStarted = true;
      if (backendRef.current?.provider === "naver") {
        clearBackendOverlays(backendRef.current);
        clearNaverPolylines(backendRef.current);
        backendRef.current.map.destroy();
        backendRef.current = null;
      }
      setReady(false);
      setProvider("loading");
      const maplibre = await import("maplibre-gl");
      if (!mapContainerRef.current || cancelled) return;

      const map = new maplibre.Map({
        container: mapContainerRef.current,
        style: "https://tiles.openfreemap.org/styles/positron",
        center: KOREA_CENTER,
        zoom: 6.1,
        minZoom: 5.4,
        maxZoom: 18,
        maxBounds: [[124.1, 33.2], [131.4, 39.2]],
        attributionControl: false,
        dragRotate: false,
        pitchWithRotate: false,
      });

      map.addControl(new maplibre.NavigationControl({ showCompass: false, visualizePitch: false }), "bottom-right");
      map.addControl(new maplibre.ScaleControl({ maxWidth: 110, unit: "metric" }), "bottom-left");
      map.addControl(new maplibre.AttributionControl({ compact: true }), "bottom-right");
      backendRef.current = { provider: "open", map, maplibre, markers: [], popup: null };
      map.on("load", () => {
        if (cancelled) return;
        map.addSource("answer-route", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
        map.addLayer({
          id: "answer-route-casing",
          type: "line",
          source: "answer-route",
          filter: ["!=", ["get", "mode"], "walk"],
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": "#ffffff", "line-width": 11, "line-opacity": 0.9, "line-blur": 0.3 },
        });
        map.addLayer({
          id: "answer-route-main",
          type: "line",
          source: "answer-route",
          filter: ["!=", ["get", "mode"], "walk"],
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": ["get", "color"], "line-width": 6, "line-opacity": 1 },
        });
        map.addLayer({
          id: "answer-route-walk",
          type: "line",
          source: "answer-route",
          filter: ["==", ["get", "mode"], "walk"],
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": "#66727f", "line-width": 4, "line-dasharray": [1.2, 1.4], "line-opacity": 0.9 },
        });
        setProvider("open");
        setLoadError(reason ?? "");
        setReady(true);
      });
    }

    const handleNaverAuthFailure = () => {
      if (!cancelled) void createOpenMap("네이버 지도 Client ID 또는 Web 서비스 URL 인증에 실패했습니다.");
    };
    window.addEventListener("hcm:naver-auth-failure", handleNaverAuthFailure);

    async function createMap() {
      if (!mapContainerRef.current || backendRef.current) return;
      if (!NAVER_CLIENT_ID) {
        await createOpenMap("네이버 지도 Client ID가 아직 등록되지 않았습니다.");
        return;
      }

      try {
        const maps = await loadNaverMaps(NAVER_CLIENT_ID);
        if (!mapContainerRef.current || cancelled) return;
        const map = new maps.Map(mapContainerRef.current, {
          center: new maps.LatLng(KOREA_CENTER[1], KOREA_CENTER[0]),
          zoom: 7,
          minZoom: 6,
          maxZoom: 20,
          zoomControl: true,
          scaleControl: true,
          logoControl: true,
          mapDataControl: true,
          mapTypeControl: false,
        });
        backendRef.current = { provider: "naver", map, maps, markers: [], polylines: [], popup: null };
        setProvider("naver");
        setLoadError("");
        setReady(true);
      } catch (error) {
        if (!cancelled) await createOpenMap(error instanceof Error ? error.message : "네이버 지도를 불러오지 못했습니다.");
      }
    }

    void createMap().catch((error: unknown) => {
      if (cancelled) return;
      setProvider("error");
      setLoadError(error instanceof Error ? error.message : "지도를 불러오지 못했습니다.");
    });

    return () => {
      cancelled = true;
      window.removeEventListener("hcm:naver-auth-failure", handleNaverAuthFailure);
      const backend = backendRef.current;
      if (!backend) return;
      clearBackendOverlays(backend);
      if (backend.provider === "naver") {
        clearNaverPolylines(backend);
        backend.map.destroy();
      } else {
        backend.map.remove();
      }
      backendRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!ready || !backendRef.current) return;
    const backend = backendRef.current;
    clearBackendOverlays(backend);

    if (phase === "menu" || phase === "summary") {
      if (backend.provider === "naver") {
        backend.map.morph(new backend.maps.LatLng(KOREA_CENTER[1], KOREA_CENTER[0]), 7, { duration: 1150 });
      } else {
        backend.map.easeTo({ center: KOREA_CENTER, zoom: 6.1, duration: 1150 });
      }
      return;
    }

    if (backend.provider === "open") {
      const startMarker = new backend.maplibre.Marker({
        element: makeEndpointElement("start", question.origin.name),
        anchor: "bottom",
      }).setLngLat(question.origin.coordinates).addTo(backend.map);
      const finishMarker = new backend.maplibre.Marker({
        element: makeEndpointElement("finish", question.destination.name),
        anchor: "bottom",
      }).setLngLat(question.destination.coordinates).addTo(backend.map);
      backend.markers.push(startMarker, finishMarker);

      const addStop = (stop: Stop) => {
        const element = makeStopElement(stop, selectedStop?.id === stop.id);
        const marker = new backend.maplibre.Marker({ element }).setLngLat(stop.coordinates).addTo(backend.map);
        element.addEventListener("click", (event) => {
          event.stopPropagation();
          onStopSelect(stop);
          backend.popup?.remove();
          backend.popup = new backend.maplibre.Popup({ offset: 18, closeButton: false, maxWidth: "260px" })
            .setLngLat(stop.coordinates)
            .setDOMContent(makePopupContent(stop))
            .addTo(backend.map);
        });
        backend.markers.push(marker);
      };

      if (phase === "reveal") question.stops.forEach(addStop);
      else if (selectedStop) addStop(selectedStop);

      const bounds = new backend.maplibre.LngLatBounds(question.origin.coordinates, question.origin.coordinates);
      bounds.extend(question.destination.coordinates);
      if (phase === "reveal") question.legs.forEach((leg) => leg.coordinates.forEach((point) => bounds.extend(point)));
      backend.map.fitBounds(bounds, {
        padding: { top: 130, right: 90, bottom: 110, left: 90 },
        duration: 1150,
        maxZoom: 13.3,
      });
      return;
    }

    const toCoord = ([longitude, latitude]: LngLat) => new backend.maps.LatLng(latitude, longitude);
    const makeNaverMarker = (element: HTMLElement, coordinates: LngLat, anchor: object) =>
      new backend.maps.Marker({
        map: backend.map,
        position: toCoord(coordinates),
        icon: { content: element, anchor },
      });

    backend.markers.push(
      makeNaverMarker(
        makeEndpointElement("start", question.origin.name),
        question.origin.coordinates,
        new backend.maps.Point(18, 48),
      ),
      makeNaverMarker(
        makeEndpointElement("finish", question.destination.name),
        question.destination.coordinates,
        new backend.maps.Point(18, 48),
      ),
    );

    const addNaverStop = (stop: Stop) => {
      const element = makeStopElement(stop, selectedStop?.id === stop.id);
      const marker = makeNaverMarker(element, stop.coordinates, new backend.maps.Point(16, 16));
      element.addEventListener("click", (event) => {
        event.stopPropagation();
        onStopSelect(stop);
        backend.popup?.close();
        backend.popup = new backend.maps.InfoWindow({
          content: makePopupContent(stop),
          borderWidth: 0,
          backgroundColor: "#ffffff",
          anchorSize: new backend.maps.Size(10, 10),
          pixelOffset: new backend.maps.Point(0, -8),
        });
        backend.popup.open(backend.map, marker);
      });
      backend.markers.push(marker);
      if (selectedStop?.id === stop.id && phase !== "reveal") {
        backend.popup = new backend.maps.InfoWindow({
          content: makePopupContent(stop),
          borderWidth: 0,
          backgroundColor: "#ffffff",
          anchorSize: new backend.maps.Size(10, 10),
          pixelOffset: new backend.maps.Point(0, -8),
        });
        backend.popup.open(backend.map, marker);
      }
    };

    if (phase === "reveal") question.stops.forEach(addNaverStop);
    else if (selectedStop) addNaverStop(selectedStop);

    const coordinates = [question.origin.coordinates, question.destination.coordinates];
    if (phase === "reveal") question.legs.forEach((leg) => coordinates.push(...leg.coordinates));
    backend.map.fitBounds(coordinates.map(toCoord), { top: 130, right: 90, bottom: 110, left: 90, maxZoom: 14 });
  }, [onStopSelect, phase, question, ready, selectedStop]);

  useEffect(() => {
    if (!ready || !backendRef.current) return;
    const backend = backendRef.current;
    if (backend.provider === "open") {
      const source = backend.map.getSource("answer-route") as
        | { setData: (data: object) => void }
        | undefined;
      if (!source) return;
      source.setData(
        phase === "reveal"
          ? {
              type: "FeatureCollection",
              features: question.legs.map((leg) => ({
                type: "Feature",
                properties: { mode: leg.mode, color: leg.color, label: leg.label },
                geometry: { type: "LineString", coordinates: leg.coordinates },
              })),
            }
          : { type: "FeatureCollection", features: [] },
      );
      return;
    }

    clearNaverPolylines(backend);
    if (phase !== "reveal") return;
    for (const leg of question.legs) {
      const path = leg.coordinates.map(
        ([longitude, latitude]) => new backend.maps.LatLng(latitude, longitude),
      );
      if (leg.mode !== "walk") {
        backend.polylines.push(
          new backend.maps.Polyline({
            map: backend.map,
            path,
            strokeColor: "#ffffff",
            strokeOpacity: 0.9,
            strokeWeight: 11,
            strokeLineCap: "round",
            strokeLineJoin: "round",
          }),
        );
      }
      backend.polylines.push(
        new backend.maps.Polyline({
          map: backend.map,
          path,
          strokeColor: leg.mode === "walk" ? "#66727f" : leg.color,
          strokeOpacity: 1,
          strokeWeight: leg.mode === "walk" ? 4 : 6,
          strokeStyle: leg.mode === "walk" ? "shortdash" : "solid",
          strokeLineCap: "round",
          strokeLineJoin: "round",
        }),
      );
    }
  }, [phase, question, ready]);

  useEffect(() => {
    if (!focusTarget || !ready || !backendRef.current) return;
    const backend = backendRef.current;
    if (backend.provider === "naver") {
      backend.map.morph(
        new backend.maps.LatLng(focusTarget.coordinates[1], focusTarget.coordinates[0]),
        16,
        { duration: 1250 },
      );
    } else {
      backend.map.flyTo({ center: focusTarget.coordinates, zoom: 15.2, duration: 1250, essential: true });
    }
  }, [focusTarget, ready]);

  useEffect(() => {
    if (!backendRef.current) return;
    const resizeTimer = window.setTimeout(() => {
      const backend = backendRef.current;
      if (backend?.provider === "naver") backend.map.refresh(true);
      else backend?.map.resize();
    }, 760);
    return () => window.clearTimeout(resizeTimer);
  }, [phase]);

  const providerLabel = provider === "naver"
    ? "NAVER 지도 · 경로검색 없음"
    : provider === "open"
      ? "OPEN MAP · NAVER 대체 지도"
      : "지도 준비 중";

  return (
    <div className={`game-map map-provider-${provider}`} aria-label="대한민국 대중교통 탐색 지도">
      <div ref={mapContainerRef} className="game-map__canvas" />
      {!ready && (
        <div className="map-loading" role="status">
          <span className="map-loading__orb" />
          <p>{provider === "error" ? loadError : "지도를 불러오는 중…"}</p>
        </div>
      )}
      <div className="map-provider-pill" title={loadError || undefined}>{providerLabel}</div>
    </div>
  );
}
