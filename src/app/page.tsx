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
      <div className="flex-1 h-full relative">
        <MapView ref={mapRef} />

        <div className="absolute top-4 left-4 w-80 z-10">
          <Card className="bg-white/90 backdrop-blur-sm shadow-lg">
            <CardHeader>
              <CardTitle>Oliwa Grid Explorer</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Explore the paths of Oliwa district. Upload your GPX tracks to mark squares as visited.
                </p>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Upload Activity (GPX)</label>
                  <input
                    type="file"
                    accept=".gpx"
                    onChange={handleFileUpload}
                    disabled={uploading}
                    className="block w-full text-sm text-slate-500
                      file:mr-4 file:py-2 file:px-4
                      file:rounded-full file:border-0
                      file:text-sm file:font-semibold
                      file:bg-violet-50 file:text-violet-700
                      hover:file:bg-violet-100
                    "
                  />
                  {uploading && <p className="text-xs text-blue-500">Processing...</p>}
                </div>

                {stats && (
                  <div className="pt-2 border-t">
                    <p className="text-sm font-bold text-green-600">
                      Last upload: +{stats.captured} squares
                    </p>
                    <p className="text-xs text-gray-500">
                      Total captured: {stats.totalCaptured}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
