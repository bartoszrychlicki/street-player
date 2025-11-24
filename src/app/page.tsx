"use client";

import { useState, useRef } from "react";
import MapView, { MapViewRef } from "@/components/map-view";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Home() {
  const [uploading, setUploading] = useState(false);
  const [stats, setStats] = useState<{ captured: number; totalCaptured: number } | null>(null);
  const mapRef = useRef<MapViewRef>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;

    const file = e.target.files[0];
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

      // Refresh the grid data without unmounting the map
      mapRef.current?.refreshGrid();

      alert(`Success! Captured ${data.captured} new squares.`);
    } catch (error) {
      console.error(error);
      alert('Error uploading file');
    } finally {
      setUploading(false);
    }
  };

  return (
    <main className="flex h-screen flex-col">
      {/* Top Bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between z-20">
        <h1 className="text-xl font-bold text-gray-900">Street Player</h1>

        <div className="flex items-center gap-4">
          {stats && (
            <div className="text-sm text-gray-600">
              <span className="font-semibold text-green-600">+{stats.captured}</span> new squares
              <span className="mx-2">•</span>
              <span className="font-semibold">{stats.totalCaptured}</span> total
            </div>
          )}

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

      {/* Map Container */}
      <div className="flex-1 h-full relative">
        <MapView ref={mapRef} />
      </div>
    </main>
  );
}
