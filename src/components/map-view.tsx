"use client";

import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

export interface MapViewRef {
  refreshGrid: () => void;
  updateGridData: (data: any) => void;
}

interface MapViewProps {
  selectedRoadTypes?: string[];
}

const MapView = forwardRef<MapViewRef, MapViewProps>(({ selectedRoadTypes = [] }, ref) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);

  useImperativeHandle(ref, () => ({
    refreshGrid: () => {
      if (map.current && map.current.getSource('grid')) {
        const source = map.current.getSource('grid') as maplibregl.GeoJSONSource;
        // Force reload by fetching fresh data
        fetch(`/oliwa-grid.geojson?t=${Date.now()}`)
          .then(res => res.json())
          .then(data => {
            source.setData(data);
          });
      }
    },
    updateGridData: (data: any) => {
      if (map.current && map.current.getSource('grid')) {
        const source = map.current.getSource('grid') as maplibregl.GeoJSONSource;
        source.setData(data);
      }
    }
  }));

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

    // Add geolocate control
    map.current.addControl(
      new maplibregl.GeolocateControl({
        positionOptions: {
          enableHighAccuracy: true
        },
        trackUserLocation: true
      }),
      'top-right'
    );

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

      // Add fill layer for grid
      // Red for uncaptured, Green for captured
      map.current.addLayer({
        id: 'grid-fill',
        type: 'fill',
        source: 'grid',
        paint: {
          'fill-color': [
            'case',
            ['boolean', ['get', 'captured'], false],
            '#00ff00', // Captured: Green
            '#ff0000'  // Uncaptured: Red
          ],
          'fill-opacity': [
            'case',
            ['boolean', ['get', 'captured'], false],
            0.4, // Captured: more visible
            0.15 // Uncaptured: faint
          ]
        }
      });

      // Add outline layer for grid
      map.current.addLayer({
        id: 'grid-outline',
        type: 'line',
        source: 'grid',
        paint: {
          'line-color': [
            'case',
            ['boolean', ['get', 'captured'], false],
            '#00cc00', // Captured: Darker Green
            '#ff0000'  // Uncaptured: Red
          ],
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

  // Update filter when selectedRoadTypes changes
  useEffect(() => {
    if (!map.current) return;

    // Wait for map to be loaded and layer to exist
    const applyFilter = () => {
      if (!map.current?.getLayer('grid-fill')) return;

      // Build filter expression
      // Show squares that have at least one of the selected road types
      let filter: any;

      if (selectedRoadTypes.length === 0) {
        // No types selected - hide all
        filter = ['==', ['get', 'id'], ''];
      } else {
        // Create an 'any' filter that checks if roadTypes array contains any selected type
        const conditions = selectedRoadTypes.map(type => [
          'in',
          type,
          ['get', 'roadTypes']
        ]);

        if (conditions.length === 1) {
          filter = conditions[0];
        } else {
          filter = ['any', ...conditions];
        }
      }

      map.current.setFilter('grid-fill', filter);
      map.current.setFilter('grid-outline', filter);
    };

    // If map is already loaded, apply filter immediately
    if (map.current.isStyleLoaded()) {
      applyFilter();
    } else {
      // Otherwise wait for load event
      map.current.once('load', applyFilter);
    }
  }, [selectedRoadTypes]);

  return (
    <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />
  );
});

MapView.displayName = 'MapView';

export default MapView;
