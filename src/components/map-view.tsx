"use client";

import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

export default function MapView() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);

  useEffect(() => {
    if (map.current) return; // initialize map only once
    if (!mapContainer.current) return;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          'osm-tiles': {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '© OpenStreetMap contributors'
          }
        },
        layers: [
          {
            id: 'osm-tiles',
            type: 'raster',
            source: 'osm-tiles',
            minzoom: 0,
            maxzoom: 19
          }
        ]
      },
      center: [18.5383, 54.4013], // Oliwa district center
      zoom: 13
    });

    // Add navigation controls
    map.current.addControl(new maplibregl.NavigationControl(), 'top-right');

    // Wait for map to load, then add layers
    map.current.on('load', () => {
      if (!map.current) return;

      // Add GeoJSON source for districts
      map.current.addSource('districts', {
        type: 'geojson',
        data: '/dzielnice.geojson'
      });

      // Add fill layer for districts (semi-transparent)
      map.current.addLayer({
        id: 'districts-fill',
        type: 'fill',
        source: 'districts',
        paint: {
          'fill-color': '#088',
          'fill-opacity': 0.1
        }
      });

      // Add outline layer for districts
      map.current.addLayer({
        id: 'districts-outline',
        type: 'line',
        source: 'districts',
        paint: {
          'line-color': '#088',
          'line-width': 2
        }
      });

      // Add GeoJSON source for grid squares
      map.current.addSource('grid', {
        type: 'geojson',
        data: '/oliwa-grid.geojson'
      });

      // Add fill layer for grid (semi-transparent red)
      map.current.addLayer({
        id: 'grid-fill',
        type: 'fill',
        source: 'grid',
        paint: {
          'fill-color': '#ff0000',
          'fill-opacity': 0.15
        }
      });

      // Add outline layer for grid (red lines)
      map.current.addLayer({
        id: 'grid-outline',
        type: 'line',
        source: 'grid',
        paint: {
          'line-color': '#ff0000',
          'line-width': 1,
          'line-opacity': 0.6
        }
      });

      console.log('All layers loaded successfully');
    });

    return () => {
      map.current?.remove();
    };
  }, []);

  return (
    <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />
  );
}
