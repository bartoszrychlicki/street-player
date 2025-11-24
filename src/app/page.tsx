"use client";

import { useRef, useState, useEffect } from "react";
import MapView, { MapViewRef } from "@/components/map-view";

const ROAD_TYPES = [
  { id: 'footway', label: 'Footway', description: 'Pedestrian paths' },
  { id: 'path', label: 'Path', description: 'Unpaved paths' },
  { id: 'cycleway', label: 'Cycleway', description: 'Bike paths' },
  { id: 'pedestrian', label: 'Pedestrian', description: 'Pedestrian zones' },
  { id: 'track', label: 'Track', description: 'Forest/agricultural tracks' },
  { id: 'steps', label: 'Steps', description: 'Stairs' },
  { id: 'service', label: 'Service', description: 'Service roads' },
  { id: 'unclassified', label: 'Unclassified', description: 'Minor roads' },
  { id: 'residential', label: 'Residential', description: 'Residential streets' },
];

export default function Home() {
  const [uploading, setUploading] = useState(false);
  const [stats, setStats] = useState<{ captured: number; totalCaptured: number } | null>(null);
  const [totalGridCount, setTotalGridCount] = useState<number>(0);
  const mapRef = useRef<MapViewRef>(null);
  const [selectedRoadTypes, setSelectedRoadTypes] = useState<string[]>(
    ROAD_TYPES.map(rt => rt.id)
  );
  const [showFilters, setShowFilters] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  // Fetch total grid count on mount
  useEffect(() => {
    fetch('/oliwa-grid.geojson')
      .then(res => res.json())
      .then(data => {
        const total = data.features.length;
        const captured = data.features.filter((f: any) => f.properties.captured).length;
        setTotalGridCount(total);
        setStats({ captured: 0, totalCaptured: captured });
      })
      .catch(err => console.error('Failed to load grid:', err));
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    setUploading(true);
    try {
      const res = await fetch('/api/upload-activity', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) throw new Error('Upload failed');

      const data = await res.json();
      setStats(data);

      mapRef.current?.refreshGrid();

      alert(`Success! Captured ${data.captured} new squares.`);
    } catch (error) {
      console.error(error);
      alert('Error uploading file');
    } finally {
      setUploading(false);
    }
  };

  const toggleRoadType = (typeId: string) => {
    setSelectedRoadTypes(prev =>
      prev.includes(typeId)
        ? prev.filter(id => id !== typeId)
        : [...prev, typeId]
    );
  };

  const selectAll = () => setSelectedRoadTypes(ROAD_TYPES.map(rt => rt.id));
  const deselectAll = () => setSelectedRoadTypes([]);

  const progressPercentage = totalGridCount > 0 && stats
    ? (stats.totalCaptured / totalGridCount) * 100
    : 0;
  const remaining = totalGridCount - (stats?.totalCaptured || 0);

  return (
    <main className="flex h-screen flex-col">
      {/* Top Bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between z-20">
        <h1 className="text-xl font-bold text-gray-900">Street Player</h1>

        {/* Progress Bar */}
        {totalGridCount > 0 && (
          <div
            className="flex-1 mx-8 max-w-md relative"
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
          >
            <div className="h-6 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-green-500 to-green-600 transition-all duration-500 ease-out flex items-center justify-end pr-2"
                style={{ width: `${progressPercentage}%` }}
              >
                {progressPercentage > 10 && (
                  <span className="text-xs font-semibold text-white">
                    {progressPercentage.toFixed(1)}%
                  </span>
                )}
              </div>
            </div>

            {/* Tooltip */}
            {showTooltip && (
              <div className="absolute top-full mt-2 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white px-4 py-3 rounded-lg shadow-lg z-30 whitespace-nowrap">
                <div className="text-xs space-y-1">
                  <div className="flex justify-between gap-4">
                    <span className="text-gray-300">Total squares:</span>
                    <span className="font-semibold">{totalGridCount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-green-400">Captured:</span>
                    <span className="font-semibold">{stats?.totalCaptured.toLocaleString() || 0}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-red-400">Remaining:</span>
                    <span className="font-semibold">{remaining.toLocaleString()}</span>
                  </div>
                </div>
                {/* Tooltip arrow */}
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-b-4 border-transparent border-b-gray-900"></div>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-4">
          {stats && (
            <div className="text-sm text-gray-600">
              <span className="font-semibold text-green-600">+{stats.captured}</span> new squares
              <span className="mx-2">•</span>
              <span className="font-semibold">{stats.totalCaptured}</span> total
            </div>
          )}

          <button
            onClick={() => setShowFilters(!showFilters)}
            className="px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-2"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            Filters
            <span className="text-xs text-gray-500">({selectedRoadTypes.length}/{ROAD_TYPES.length})</span>
          </button>

          <label className="cursor-pointer">
            <input
              type="file"
              accept=".gpx"
              onChange={handleFileUpload}
              disabled={uploading}
              className="hidden"
            />
            <div className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors font-medium text-sm flex items-center gap-2">
              {uploading ? (
                <>
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing...
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  Import GPX
                </>
              )}
            </div>
          </label>
        </div>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="bg-gray-50 border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700">Road Types</h2>
            <div className="flex gap-2">
              <button
                onClick={selectAll}
                className="text-xs px-2 py-1 text-violet-600 hover:bg-violet-50 rounded"
              >
                Select All
              </button>
              <button
                onClick={deselectAll}
                className="text-xs px-2 py-1 text-gray-600 hover:bg-gray-100 rounded"
              >
                Clear
              </button>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {ROAD_TYPES.map(type => (
              <label
                key={type.id}
                className="flex items-start gap-2 cursor-pointer hover:bg-white p-2 rounded transition-colors"
              >
                <input
                  type="checkbox"
                  checked={selectedRoadTypes.includes(type.id)}
                  onChange={() => toggleRoadType(type.id)}
                  className="mt-0.5 h-4 w-4 text-violet-600 rounded border-gray-300 focus:ring-violet-500"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900">{type.label}</div>
                  <div className="text-xs text-gray-500">{type.description}</div>
                </div>
              </label>
            ))}
          </div>
          <div className="flex justify-end mt-3">
            <button
              onClick={() => setShowFilters(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 bg-gray-100 rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Map Container */}
      <div className="flex-1 h-full relative">
        <MapView ref={mapRef} selectedRoadTypes={selectedRoadTypes} />
      </div>
    </main>
  );
}
