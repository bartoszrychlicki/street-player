"use client";

import { useRef, useState, useEffect } from "react";
import MapView, { MapViewRef } from "@/components/map-view";
import { gpx } from "@tmcw/togeojson";
import * as turf from "@turf/turf";
import { DOMParser } from "xmldom";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc, arrayUnion, onSnapshot } from "firebase/firestore";
import AuthModal from "@/components/auth-modal";
import { toast } from "sonner";

const ROAD_TYPES = [
  { id: 'footway', label: 'Chodnik', description: 'Ścieżki dla pieszych' },
  { id: 'path', label: 'Ścieżka', description: 'Nieutwardzone ścieżki' },
  { id: 'cycleway', label: 'Ścieżka rowerowa', description: 'Drogi rowerowe' },
  { id: 'pedestrian', label: 'Strefa piesza', description: 'Strefy dla pieszych' },
  { id: 'track', label: 'Trakt', description: 'Drogi leśne/rolnicze' },
  { id: 'steps', label: 'Schody', description: 'Schody' },
  { id: 'service', label: 'Droga serwisowa', description: 'Drogi dojazdowe' },
  { id: 'unclassified', label: 'Nieklasyfikowana', description: 'Drogi pomniejsze' },
  { id: 'residential', label: 'Osiedlowa', description: 'Ulice osiedlowe' },
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
  const [gridData, setGridData] = useState<any>(null);

  // Auth State
  const [user, setUser] = useState<User | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Load grid data
  useEffect(() => {
    fetch('/oliwa-grid.geojson')
      .then(res => res.json())
      .then(data => {
        setGridData(data);
        setTotalGridCount(data.features.length);
        // Initial load will happen in auth effect
      })
      .catch(err => console.error('Failed to load grid:', err));
  }, []);

  // Handle Auth & Data Sync
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      if (!gridData) return;

      if (currentUser) {
        // User is logged in - Sync with Firestore
        setIsSyncing(true);
        const userRef = doc(db, "users", currentUser.uid);

        try {
          // Check for local data to migrate
          const localCaptured = JSON.parse(localStorage.getItem('capturedSquares') || '[]');

          if (localCaptured.length > 0) {
            // Migrate local data to Firestore
            const userDoc = await getDoc(userRef);

            if (userDoc.exists()) {
              await updateDoc(userRef, {
                capturedSquares: arrayUnion(...localCaptured)
              });
            } else {
              await setDoc(userRef, {
                capturedSquares: localCaptured,
                email: currentUser.email,
                createdAt: new Date().toISOString()
              });
            }

            // Clear local storage after migration
            localStorage.removeItem('capturedSquares');
            console.log("Migrated local data to cloud");
          }

          // Subscribe to real-time updates
          const unsubscribeSnapshot = onSnapshot(userRef, (doc) => {
            if (doc.exists()) {
              const data = doc.data();
              const capturedSquares = new Set(data.capturedSquares || []);
              updateGridWithCaptured(capturedSquares);
            } else {
              // New user without doc
              updateGridWithCaptured(new Set());
            }
            setIsSyncing(false);
          });
          return () => unsubscribeSnapshot(); // Cleanup snapshot listener

        } catch (err) {
          console.error("Sync error:", err);
          setIsSyncing(false);
        }
      } else {
        // Guest - Load from LocalStorage
        const localCaptured = JSON.parse(localStorage.getItem('capturedSquares') || '[]');
        updateGridWithCaptured(new Set(localCaptured));
      }
    });

    return () => unsubscribe();
  }, [gridData]); // Re-run when gridData loads

  const updateGridWithCaptured = (capturedSet: Set<any>) => {
    if (!gridData) return;

    let capturedCount = 0;
    // Create a deep copy to avoid mutating state directly if needed, 
    // but here we modify properties for MapView
    gridData.features.forEach((f: any) => {
      if (capturedSet.has(f.properties.id)) {
        f.properties.captured = true;
        capturedCount++;
      } else {
        f.properties.captured = false;
      }
    });

    setStats({ captured: 0, totalCaptured: capturedCount });
    if (mapRef.current) {
      mapRef.current.updateGridData({ ...gridData });
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !gridData) return;

    setUploading(true);

    try {
      const text = await file.text();
      const parser = new DOMParser();
      const gpxDoc = parser.parseFromString(text, "text/xml");
      const geojson = gpx(gpxDoc);

      let newCapturedCount = 0;
      const newCapturedIds: string[] = [];

      // Determine current captured set
      let currentCapturedSet = new Set<string>();
      if (user) {
        gridData.features.forEach((f: any) => {
          if (f.properties.captured) currentCapturedSet.add(f.properties.id);
        });
      } else {
        currentCapturedSet = new Set(JSON.parse(localStorage.getItem('capturedSquares') || '[]'));
      }

      // Process features in batches to keep UI responsive
      const BATCH_SIZE = 5; // Process 5 features at a time
      const features = geojson.features.filter(
        (f: any) => f.geometry?.type === 'LineString' || f.geometry?.type === 'MultiLineString'
      );

      const processBatch = async (startIndex: number): Promise<void> => {
        const endIndex = Math.min(startIndex + BATCH_SIZE, features.length);

        for (let i = startIndex; i < endIndex; i++) {
          const feature = features[i];
          const bufferedPath = turf.buffer(feature as any, 0.0005, { units: 'kilometers' });
          const pathBbox = turf.bbox(bufferedPath as any);

          const candidates = gridData.features.filter((cell: any) => {
            const cLat = cell.properties.centerLat;
            const cLon = cell.properties.centerLon;
            return cLat >= pathBbox[1] - 0.0002 && cLat <= pathBbox[3] + 0.0002 &&
              cLon >= pathBbox[0] - 0.0002 && cLon <= pathBbox[2] + 0.0002;
          });

          for (const cell of candidates) {
            if (currentCapturedSet.has(cell.properties.id)) continue;

            if (turf.booleanIntersects(cell as any, bufferedPath as any)) {
              cell.properties.captured = true;
              newCapturedIds.push(cell.properties.id);
              currentCapturedSet.add(cell.properties.id);
              newCapturedCount++;
            }
          }
        }

        // If there are more features, process next batch after a short delay
        if (endIndex < features.length) {
          await new Promise(resolve => setTimeout(resolve, 0));
          await processBatch(endIndex);
        }
      };

      // Start processing
      await processBatch(0);

      // Save results
      if (newCapturedCount > 0) {
        if (user) {
          try {
            const userRef = doc(db, "users", user.uid);
            const userDoc = await getDoc(userRef);

            if (userDoc.exists()) {
              await updateDoc(userRef, {
                capturedSquares: arrayUnion(...newCapturedIds)
              });
            } else {
              await setDoc(userRef, {
                capturedSquares: newCapturedIds,
                email: user.email,
                createdAt: new Date().toISOString()
              });
            }

            setStats(prev => ({
              captured: newCapturedCount,
              totalCaptured: (prev?.totalCaptured || 0) + newCapturedCount
            }));
          } catch (firestoreError: any) {
            console.error('Firestore error:', firestoreError);
            toast.error('Nie udało się zapisać postępu', {
              description: `${firestoreError.message}. Twój postęp nie został zapisany. Sprawdź połączenie z internetem.`,
              duration: 5000,
            });
            newCapturedIds.forEach(id => {
              const cell = gridData.features.find((f: any) => f.properties.id === id);
              if (cell) cell.properties.captured = false;
            });
            mapRef.current?.updateGridData({ ...gridData });
            setUploading(false);
            return;
          }
        } else {
          localStorage.setItem('capturedSquares', JSON.stringify(Array.from(currentCapturedSet)));
          updateGridWithCaptured(currentCapturedSet);
        }
      }

      toast.success('Import zakończony sukcesem!', {
        description: `Zdobyto ${newCapturedCount} ${newCapturedCount === 1 ? 'nowy kwadrat' : newCapturedCount < 5 ? 'nowe kwadraty' : 'nowych kwadratów'}. Eksploruj dalej!`,
        duration: 4000,
      });
      setUploading(false);

    } catch (error) {
      console.error('Processing error:', error);
      toast.error('Import nie powiódł się', {
        description: 'Wystąpił błąd podczas przetwarzania pliku GPX. Spróbuj ponownie.',
        duration: 4000,
      });
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
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />

      {/* Top Bar */}
      <div className="bg-white border-b border-gray-200 px-3 sm:px-6 py-2 sm:py-3 flex items-center justify-between z-20">
        <h1 className="text-lg sm:text-xl font-bold text-gray-900">Street Player</h1>

        {/* Progress Bar - Hidden on mobile */}
        {totalGridCount > 0 && (
          <div
            className="hidden md:flex flex-1 mx-8 max-w-md relative"
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
          >
            <div className="h-6 bg-gray-200 rounded-full overflow-hidden w-full">
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
                    <span className="text-gray-300">Wszystkich kwadratów:</span>
                    <span className="font-semibold">{totalGridCount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-green-400">Zdobytych:</span>
                    <span className="font-semibold">{stats?.totalCaptured.toLocaleString() || 0}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-red-400">Pozostało:</span>
                    <span className="font-semibold">{remaining.toLocaleString()}</span>
                  </div>
                </div>
                {/* Tooltip arrow */}
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-b-4 border-transparent border-b-gray-900"></div>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-2 sm:gap-4">
          {/* Auth Button */}
          {user ? (
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="text-xs sm:text-sm text-gray-700 hidden lg:block">
                {user.email}
              </div>
              <button
                onClick={() => signOut(auth)}
                className="px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <span className="hidden sm:inline">Wyloguj</span>
                <span className="sm:hidden">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                </span>
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsAuthModalOpen(true)}
              className="px-2 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-white bg-gray-900 hover:bg-gray-800 rounded-lg transition-colors"
            >
              <span className="hidden sm:inline">Zaloguj</span>
              <span className="sm:hidden">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                </svg>
              </span>
            </button>
          )}

          <div className="h-4 sm:h-6 w-px bg-gray-300 hidden sm:block"></div>

          {/* Stats - Hidden on mobile, shown on tablet+ */}
          {stats && (
            <div className="text-xs sm:text-sm text-gray-600 hidden md:block">
              <span className="font-semibold text-green-600">+{stats.captured}</span> nowych
              <span className="mx-1 sm:mx-2">•</span>
              <span className="font-semibold">{stats.totalCaptured}</span> łącznie
            </div>
          )}

          {/* Filter Button - Icon only on mobile */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-1 sm:gap-2"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            <span className="hidden sm:inline">Filtry</span>
            <span className="text-xs text-gray-500">({selectedRoadTypes.length}/{ROAD_TYPES.length})</span>
          </button>

          {/* Import Button - Icon only on mobile */}
          <label className="cursor-pointer">
            <input
              type="file"
              accept=".gpx"
              onChange={handleFileUpload}
              disabled={uploading}
              className="hidden"
            />
            <div className="px-2 sm:px-4 py-1.5 sm:py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors font-medium text-xs sm:text-sm flex items-center gap-1 sm:gap-2">
              {uploading ? (
                <>
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span className="hidden sm:inline">Przetwarzanie...</span>
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <span className="hidden sm:inline">Importuj GPX</span>
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
            <h2 className="text-sm font-semibold text-gray-700">Typy dróg</h2>
            <div className="flex gap-2">
              <button
                onClick={selectAll}
                className="text-xs px-2 py-1 text-violet-600 hover:bg-violet-50 rounded"
              >
                Zaznacz wszystkie
              </button>
              <button
                onClick={deselectAll}
                className="text-xs px-2 py-1 text-gray-600 hover:bg-gray-100 rounded"
              >
                Wyczyść
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
              Zamknij
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
