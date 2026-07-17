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

const KOREA_CENTER: LngLat = [127.75, 36.15];

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

export function GameMap({ question, phase, focusTarget, selectedStop, onStopSelect }: GameMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const maplibreRef = useRef<typeof import("maplibre-gl") | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const popupRef = useRef<Popup | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function createMap() {
      if (!mapContainerRef.current || mapRef.current) return;
      const maplibre = await import("maplibre-gl");
      if (cancelled || !mapContainerRef.current) return;

      maplibreRef.current = maplibre;
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

      map.on("load", () => {
        map.addSource("answer-route", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });

        map.addLayer({
          id: "answer-route-casing",
          type: "line",
          source: "answer-route",
          filter: ["!=", ["get", "mode"], "walk"],
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": "#ffffff",
            "line-width": 11,
            "line-opacity": 0,
            "line-blur": 0.3,
            "line-opacity-transition": { duration: 650, delay: 60 },
          },
        });

        map.addLayer({
          id: "answer-route-main",
          type: "line",
          source: "answer-route",
          filter: ["!=", ["get", "mode"], "walk"],
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": ["get", "color"],
            "line-width": 6,
            "line-opacity": 0,
            "line-opacity-transition": { duration: 650, delay: 140 },
          },
        });

        map.addLayer({
          id: "answer-route-walk",
          type: "line",
          source: "answer-route",
          filter: ["==", ["get", "mode"], "walk"],
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": "#66727f",
            "line-width": 4,
            "line-dasharray": [1.2, 1.4],
            "line-opacity": 0,
            "line-opacity-transition": { duration: 450, delay: 220 },
          },
        });

        setReady(true);
      });

      mapRef.current = map;
    }

    void createMap();
    return () => {
      cancelled = true;
      popupRef.current?.remove();
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!ready || !mapRef.current || !maplibreRef.current) return;
    const map = mapRef.current;
    const maplibre = maplibreRef.current;

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];
    popupRef.current?.remove();

    if (phase === "menu" || phase === "summary") {
      map.easeTo({ center: KOREA_CENTER, zoom: 6.1, duration: 1150 });
      return;
    }

    const startMarker = new maplibre.Marker({ element: makeEndpointElement("start", question.origin.name), anchor: "bottom" })
      .setLngLat(question.origin.coordinates)
      .addTo(map);
    const finishMarker = new maplibre.Marker({ element: makeEndpointElement("finish", question.destination.name), anchor: "bottom" })
      .setLngLat(question.destination.coordinates)
      .addTo(map);
    markersRef.current.push(startMarker, finishMarker);

    if (phase === "reveal") {
      question.stops.forEach((stop) => {
        const element = makeStopElement(stop, selectedStop?.id === stop.id);
        element.addEventListener("click", (event) => {
          event.stopPropagation();
          onStopSelect(stop);
          popupRef.current?.remove();
          popupRef.current = new maplibre.Popup({ offset: 18, closeButton: false, maxWidth: "260px" })
            .setLngLat(stop.coordinates)
            .setDOMContent(makePopupContent(stop))
            .addTo(map);
        });
        markersRef.current.push(new maplibre.Marker({ element }).setLngLat(stop.coordinates).addTo(map));
      });
    } else if (selectedStop) {
      const element = makeStopElement(selectedStop, true);
      element.addEventListener("click", () => onStopSelect(selectedStop));
      const marker = new maplibre.Marker({ element }).setLngLat(selectedStop.coordinates).addTo(map);
      markersRef.current.push(marker);
      popupRef.current = new maplibre.Popup({ offset: 18, closeButton: false, maxWidth: "260px" })
        .setLngLat(selectedStop.coordinates)
        .setDOMContent(makePopupContent(selectedStop))
        .addTo(map);
    }

    const bounds = new maplibre.LngLatBounds(question.origin.coordinates, question.origin.coordinates);
    bounds.extend(question.destination.coordinates);
    if (phase === "reveal") question.legs.forEach((leg) => leg.coordinates.forEach((point) => bounds.extend(point)));
    map.fitBounds(bounds, { padding: { top: 130, right: 90, bottom: 110, left: 90 }, duration: 1150, maxZoom: 13.3 });
  }, [onStopSelect, phase, question, ready, selectedStop]);

  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const map = mapRef.current;
    const source = map.getSource("answer-route") as { setData: (data: GeoJSON.FeatureCollection) => void } | undefined;
    if (!source) return;

    if (phase !== "reveal") {
      source.setData({ type: "FeatureCollection", features: [] });
      return;
    }

    source.setData({
      type: "FeatureCollection",
      features: question.legs.map((leg) => ({
        type: "Feature",
        properties: { mode: leg.mode, color: leg.color, label: leg.label },
        geometry: { type: "LineString", coordinates: leg.coordinates },
      })),
    });

    map.setPaintProperty("answer-route-casing", "line-opacity", 0.9);
    map.setPaintProperty("answer-route-main", "line-opacity", 1);
    map.setPaintProperty("answer-route-walk", "line-opacity", 0.9);
  }, [phase, question, ready]);

  useEffect(() => {
    if (!focusTarget || !ready || !mapRef.current) return;
    mapRef.current.flyTo({ center: focusTarget.coordinates, zoom: 15.2, duration: 1250, essential: true });
  }, [focusTarget, ready]);

  useEffect(() => {
    if (!mapRef.current) return;
    const resizeTimer = window.setTimeout(() => mapRef.current?.resize(), 760);
    return () => window.clearTimeout(resizeTimer);
  }, [phase]);

  return (
    <div className="game-map" aria-label="대한민국 대중교통 탐색 지도">
      <div ref={mapContainerRef} className="game-map__canvas" />
      {!ready && (
        <div className="map-loading" role="status">
          <span className="map-loading__orb" />
          <p>지도를 불러오는 중…</p>
        </div>
      )}
      <div className="map-provider-pill">OPEN MAP · 경로검색 없음</div>
    </div>
  );
}
