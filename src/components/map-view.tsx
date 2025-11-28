"use client";

import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

export interface MapViewRef {
  refreshGrid: () => void;
  updateGridData: (data: any) => void;
  updateCapturedState: (capturedIds: string[]) => void;
  updateRecordingRoute: (points: { lat: number; lon: number }[]) => void;
}

interface MapViewProps {
  selectedRoadTypes?: string[];
  selectedDistricts?: string[];
}

const MapView = forwardRef<MapViewRef, MapViewProps>(({ selectedRoadTypes = [], selectedDistricts = [] }, ref) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const pendingCapturedIds = useRef<string[]>([]);
  const gridLoadLogged = useRef(false);
  const pendingGridData = useRef<any | null>(null);

  const logGridStatus = (tag: string) => {
    if (!map.current) return;

    let sourceFeatures: number | string = 'n/a';
    let sourceLoaded = false;
    let sampleFeatures: any = [];
    try {
      const source = map.current.getSource('grid') as any;
      sourceLoaded = map.current.isSourceLoaded('grid');
      sourceFeatures = source?._data?.features?.length ?? 'n/a';
      if (sourceLoaded) {
        const qs = map.current.querySourceFeatures('grid', { sourceLayer: undefined });
        sampleFeatures = qs.slice(0, 3).map(f => {
          const featureId = f.id ?? f.properties?.id;
          let hasCapturedState: boolean | string = 'n/a';
          if (featureId !== undefined && featureId !== null) {
            try {
              hasCapturedState = !!map.current?.getFeatureState({ source: 'grid', id: featureId })?.captured;
            } catch (err) {
              hasCapturedState = `error: ${(err as Error).message}`;
            }
          }
          return {
            id: featureId,
            district: f.properties?.d,
            roadTypes: f.properties?.rt,
            hasCapturedState
          };
        });
      }
    } catch (err) {
      sourceFeatures = `error: ${(err as Error).message}`;
    }

    let renderedFeatures: number | string = 'n/a';
    try {
      renderedFeatures = map.current.queryRenderedFeatures({ layers: ['grid-fill'] }).length;
    } catch (err) {
      renderedFeatures = `error: ${(err as Error).message}`;
    }

    const summary = {
      tag,
      selectedRoadTypes,
      selectedDistricts,
      sourceLoaded,
      sourceFeatures,
      renderedFeatures,
      styleLoaded: map.current.isStyleLoaded(),
      fillFilter: map.current.getFilter('grid-fill'),
      outlineFilter: map.current.getFilter('grid-outline'),
      sampleFeatures
    };

    console.log('[grid] status:', summary);
    console.log('[grid] debug:', `sourceLoaded=${sourceLoaded} sourceFeatures=${sourceFeatures} rendered=${renderedFeatures}`);
    console.log('[grid] filters:', {
      fill: summary.fillFilter,
      outline: summary.outlineFilter
    });
  };

  useImperativeHandle(ref, () => ({
    refreshGrid: () => {
      if (map.current && map.current.getSource('grid')) {
        const source = map.current.getSource('grid') as maplibregl.GeoJSONSource;
        // @ts-ignore - internal _data reference
        const data = source._data;
        if (data) {
          source.setData(data);
        }
      }
    },
    updateGridData: (data: any) => {
      pendingGridData.current = data;
      if (map.current && map.current.getSource('grid')) {
        const source = map.current.getSource('grid') as maplibregl.GeoJSONSource;
        source.setData(data);
        pendingGridData.current = null;

        // After loading grid data, apply any pending captured state
        if (pendingCapturedIds.current.length > 0) {
          console.log(`Applying ${pendingCapturedIds.current.length} pending captured squares after grid load`);

          // Remove all feature states from grid source
          map.current.removeFeatureState({ source: 'grid' });

          // Set captured state for all pending IDs
          pendingCapturedIds.current.forEach(id => {
            map.current?.setFeatureState(
              { source: 'grid', id },
              { captured: true }
            );
          });

          pendingCapturedIds.current = [];
        }
      } else {
        console.warn('updateGridData: map or grid source not ready, storing data for later');
      }
    },
    updateCapturedState: (capturedIds: string[]) => {
      if (!map.current || !map.current.getSource('grid')) {
        console.warn('updateCapturedState: map or grid source not ready, storing for later');
        // Store for later when map is ready
        pendingCapturedIds.current = capturedIds;
        return;
      }

      console.log(`updateCapturedState: Setting ${capturedIds.length} captured squares`);
      console.log('First 5 IDs:', capturedIds.slice(0, 5));

      // Check if features exist in the source
      const source = map.current.getSource('grid') as maplibregl.GeoJSONSource;
      // @ts-ignore - accessing internal _data
      const sourceData = source._data;
      if (sourceData && sourceData.features) {
        console.log(`Grid source has ${sourceData.features.length} features`);
        const firstFeature = sourceData.features[0];
        console.log('First feature ID:', firstFeature.id);
        console.log('First feature structure:', {
          id: firstFeature.id,
          hasProperties: !!firstFeature.properties,
          propertiesKeys: firstFeature.properties ? Object.keys(firstFeature.properties) : []
        });
      }

      // Remove all feature states from grid source
      map.current.removeFeatureState({ source: 'grid' });

      // Test: try to set state for first ID and check if it works
      if (capturedIds.length > 0) {
        const testId = capturedIds[0];
        console.log(`Setting state for test ID (string id): ${testId}`);
        map.current.setFeatureState(
          { source: 'grid', id: testId },
          { captured: true }
        );

        // Also try numeric ID if present
        const numericId = Number(testId);
        if (!Number.isNaN(numericId)) {
          try {
            map.current.setFeatureState(
              { source: 'grid', id: numericId },
              { captured: true }
            );
            console.log(`Also set state for numeric id: ${numericId}`);
          } catch (err) {
            console.warn('Numeric id setFeatureState failed', err);
          }
        }

        // Check if it was set
        const state = map.current.getFeatureState({ source: 'grid', id: testId });
        console.log(`Test feature state for ${testId}:`, state);

        // Try to find this feature in the source (either top-level id or properties.id)
        if (sourceData && sourceData.features) {
          const foundFeature = sourceData.features.find((f: any) => f.id === testId || f.properties?.id === testId);
          console.log(`Feature ${testId} found in source:`, !!foundFeature);
        }
      }

      // Set all captured states
      capturedIds.forEach(id => {
        map.current?.setFeatureState(
          { source: 'grid', id },
          { captured: true }
        );
      });

      console.log('All feature states set. Forcing map repaint...');
      map.current.triggerRepaint();
      logGridStatus('after setting captured states');

      // Clear pending since we just applied them
      pendingCapturedIds.current = [];
    },
    updateRecordingRoute: (points: { lat: number; lon: number }[]) => {
      if (map.current && map.current.getSource('recording-route')) {
        const source = map.current.getSource('recording-route') as maplibregl.GeoJSONSource;
        const geojson = {
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: points.map(p => [p.lon, p.lat])
          },
          properties: {}
        };
        source.setData(geojson as any);
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
      center: [18.5543, 54.4065], // Leśna, Gdańsk Oliwa (zoom out + 150m w prawo)
      zoom: 16
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

      // Add GeoJSON source for grid squares (data provided externally)
      map.current.addSource('grid', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
        promoteId: 'id'
      });

      map.current.on('sourcedata', (e) => {
        if (e.sourceId === 'grid' && map.current?.isSourceLoaded('grid') && !gridLoadLogged.current) {
          gridLoadLogged.current = true;
          logGridStatus('grid source loaded');
        }
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
            ['coalesce', ['feature-state', 'captured'], false],
            '#00ff00', // Captured: Green
            '#ff0000'  // Uncaptured: Red
          ],
          'fill-opacity': [
            'case',
            ['coalesce', ['feature-state', 'captured'], false],
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
            ['coalesce', ['feature-state', 'captured'], false],
            '#00cc00', // Captured: Darker Green
            '#ff0000'  // Uncaptured: Red
          ],
          'line-width': 1,
          'line-opacity': 0.6
        }
      });

      // Add source for recording route
      map.current.addSource('recording-route', {
        type: 'geojson',
        data: {
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: []
          },
          properties: {}
        }
      });

      // Add layer for recording route
      map.current.addLayer({
        id: 'recording-route-line',
        type: 'line',
        source: 'recording-route',
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': '#3b82f6', // Blue-500
          'line-width': 3,
          'line-opacity': 0.7
        }
      });

      console.log('All layers loaded successfully');

      // Apply any pending captured state that was set before map was ready
      if (pendingCapturedIds.current.length > 0) {
        console.log(`Applying ${pendingCapturedIds.current.length} pending captured squares`);

        // Remove all feature states from grid source
        map.current.removeFeatureState({ source: 'grid' });

        // Set captured state for all pending IDs
        pendingCapturedIds.current.forEach(id => {
          map.current?.setFeatureState(
            { source: 'grid', id },
            { captured: true }
          );
        });

        pendingCapturedIds.current = [];
        logGridStatus('applied pending captured after load');
      }

      // Apply pending grid data if it arrived before map load
      if (pendingGridData.current) {
        const source = map.current.getSource('grid') as maplibregl.GeoJSONSource;
        source.setData(pendingGridData.current);
        pendingGridData.current = null;
        logGridStatus('applied pending grid data after load');
      }
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

      // If no filter selected, hide all
      if (selectedRoadTypes.length === 0) {
        filter = ['==', ['get', 'rt'], ''];
      } else {
        // Create an 'any' filter that checks if roadTypes array contains any selected type
        const conditions = selectedRoadTypes.map(type => [
          'in',
          type,
          ['get', 'rt']
        ]);

        filter = conditions.length === 1 ? conditions[0] : ['any', ...conditions];
      }

      map.current.setFilter('grid-fill', filter);
      map.current.setFilter('grid-outline', filter);
      logGridStatus('after road type filter');
    };

    // If map is already loaded, apply filter immediately
    if (map.current.isStyleLoaded()) {
      applyFilter();
    } else {
      // Otherwise wait for load event
      map.current.once('load', applyFilter);
    }
  }, [selectedRoadTypes]);

  // Update filter when selectedDistricts changes
  useEffect(() => {
    if (!map.current) return;

    const applyFilter = () => {
      if (!map.current?.getLayer('grid-fill')) return;

      // Build combined filter for road types AND districts
      let roadTypeFilter: any;
      let districtFilter: any;

      // Road type filter
      if (selectedRoadTypes.length === 0) {
        roadTypeFilter = ['==', ['get', 'rt'], ''];
      } else {
        const roadConditions = selectedRoadTypes.map(type => [
          'in',
          type,
          ['get', 'rt']
        ]);
        roadTypeFilter = roadConditions.length === 1 ? roadConditions[0] : ['any', ...roadConditions];
      }

      // District filter
      if (selectedDistricts.length === 0) {
        districtFilter = ['==', ['get', 'd'], ''];
      } else {
        const districtConditions = selectedDistricts.map(district => [
          '==',
          ['get', 'd'],
          district
        ]);
        districtFilter = districtConditions.length === 1 ? districtConditions[0] : ['any', ...districtConditions];
      }

      // Combine filters with AND logic
      const combinedFilter: any = ['all', roadTypeFilter, districtFilter];

      map.current.setFilter('grid-fill', combinedFilter);
      map.current.setFilter('grid-outline', combinedFilter);
      logGridStatus('after district filter');
    };

    if (map.current.isStyleLoaded()) {
      applyFilter();
    } else {
      map.current.once('load', applyFilter);
    }
  }, [selectedRoadTypes, selectedDistricts]);

  return (
    <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />
  );
});

MapView.displayName = 'MapView';

export default MapView;
