"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useRef, useState, useEffect, useCallback } from "react";
import MapView, { MapViewRef } from "@/components/map-view";
import { gpx } from "@tmcw/togeojson";
import * as turf from "@turf/turf";
import Flatbush from 'flatbush';
import { DOMParser } from "xmldom";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc, arrayUnion, onSnapshot } from "firebase/firestore";
import AuthModal from "@/components/auth-modal";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import WelcomePanel from "@/components/welcome-panel";
import HelpModal from "@/components/help-modal";
import UsernameModal from "@/components/username-modal";
import SettingsModal from "@/components/settings-modal";
import { generateUsername } from "@/lib/username-generator";

type RecordedPoint = { lat: number; lon: number; timestamp: number; accuracy?: number };

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

type WakeLockSentinelLike = {
  release?: () => Promise<void>;
  addEventListener: (type: 'release', listener: () => void) => void;
};

type WakeLockNavigator = Navigator & {
  wakeLock?: {
    request: (type: 'screen') => Promise<WakeLockSentinelLike>;
  };
  standalone?: boolean;
};

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

const DISTRICTS = [
  { id: 'oliwa', name: 'Oliwa' },
  { id: 'vii_dwor', name: 'VII Dwór' },
  { id: 'strzyza', name: 'Strzyża' },
  { id: 'piecki_migowo', name: 'Piecki-Migowo' },
  { id: 'wrzeszcz_gorny', name: 'Wrzeszcz Górny' },
];

export default function Home() {
  const [uploading, setUploading] = useState(false);
  const [stats, setStats] = useState<{ captured: number; totalCaptured: number } | null>(null);
  const [totalGridCount, setTotalGridCount] = useState<number>(0);
  const mapRef = useRef<MapViewRef>(null);
  const [selectedRoadTypes, setSelectedRoadTypes] = useState<string[]>(
    ROAD_TYPES.map(rt => rt.id)
  );
  const [selectedDistricts, setSelectedDistricts] = useState<string[]>(
    ['Oliwa'] // Default only Oliwa
  );
  const [showFilters, setShowFilters] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  // Refs for data storage (performance optimization)
  const gridIndexRef = useRef<Flatbush | null>(null);
  const gridFeaturesRef = useRef<GeoJSON.Feature[]>([]);
  const capturedSetRef = useRef<Set<string>>(new Set());

  // Auth State
  const [user, setUser] = useState<User | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const [isUsernameModalOpen, setIsUsernameModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [username, setUsername] = useState<string>("");
  const [isSyncing, setIsSyncing] = useState(false);

  // GPS Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordedPoints, setRecordedPoints] = useState<RecordedPoint[]>([]);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const watchIdRef = useRef<number | null>(null);
  const [locationPermission, setLocationPermission] = useState<PermissionState | 'unknown'>('unknown');
  const [highAccuracyEnabled, setHighAccuracyEnabled] = useState(true);
  const [keepScreenOn, setKeepScreenOn] = useState(false);
  const [wakeLockSupported, setWakeLockSupported] = useState(false);
  const [wakeLockActive, setWakeLockActive] = useState(false);
  const [wakeLockError, setWakeLockError] = useState<string | null>(null);
  const wakeLockRef = useRef<WakeLockSentinelLike | null>(null);
  const [lastFixTimestamp, setLastFixTimestamp] = useState<number | null>(null);
  const [lastFixAccuracy, setLastFixAccuracy] = useState<number | null>(null);
  const [gpsStale, setGpsStale] = useState(false);
  const [backgroundWarning, setBackgroundWarning] = useState(false);
  const gpsGapNotifiedRef = useRef(false);
  const [qualityStats, setQualityStats] = useState({
    droppedForAccuracy: 0,
    droppedForSpeed: 0,
    staleGaps: 0
  });

  // PWA nudges
  const [installPromptEvent, setInstallPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPwaNudge, setShowPwaNudge] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [pwaDismissed, setPwaDismissed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Check location permission on mount
  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationPermission('denied');
      return;
    }

    navigator.permissions.query({ name: 'geolocation' }).then((result) => {
      setLocationPermission(result.state);
      result.onchange = () => {
        setLocationPermission(result.state);
      };
    });
  }, []);

  // Hydrate preferences and capability flags
  useEffect(() => {
    const savedAccuracy = localStorage.getItem('highAccuracyEnabled');
    if (savedAccuracy !== null) {
      setHighAccuracyEnabled(savedAccuracy === 'true');
    }
    const savedKeepScreenOn = localStorage.getItem('keepScreenOn');
    if (savedKeepScreenOn !== null) {
      setKeepScreenOn(savedKeepScreenOn === 'true');
    }
    setWakeLockSupported('wakeLock' in navigator);
    const navWithExtras = window.navigator as WakeLockNavigator;
    const standalone = window.matchMedia('(display-mode: standalone)').matches || !!navWithExtras.standalone;
    setIsStandalone(standalone);

    const media = window.matchMedia('(max-width: 768px)');
    const updateMobile = () => setIsMobile(media.matches);
    updateMobile();

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      if (!isMobile) return;
      const promptEvent = event as BeforeInstallPromptEvent;
      setInstallPromptEvent(promptEvent);
      setShowPwaNudge(true);
    };

    media.addEventListener('change', updateMobile);
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      media.removeEventListener('change', updateMobile);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, [isMobile]);

  // Load grid data dynamically based on selected districts
  useEffect(() => {
    const loadGrids = async () => {
      if (selectedDistricts.length === 0) {
        gridFeaturesRef.current = [];
        gridIndexRef.current = null;
        setTotalGridCount(0);
        if (mapRef.current) {
          mapRef.current.updateGridData({ type: 'FeatureCollection', features: [] });
        }
        return;
      }

      const allFeatures: GeoJSON.Feature[] = [];

      try {
        const promises = selectedDistricts.map(async (districtName) => {
          const districtId = DISTRICTS.find(d => d.name === districtName)?.id;
          if (!districtId) return;

          try {
            const res = await fetch(`/grid-${districtId}.geojson`);
            if (!res.ok) throw new Error(`Failed to load ${districtId}`);
            const data = await res.json();
            return data.features;
          } catch (e) {
            console.error(`Error loading grid for ${districtName}:`, e);
            return [];
          }
        });

        const results = await Promise.all(promises);
        results.forEach(features => {
          if (features) allFeatures.push(...features);
        });

        // Store features in ref
        gridFeaturesRef.current = allFeatures;
        setTotalGridCount(allFeatures.length);
        if (process.env.NODE_ENV === 'development') {
          console.log('[grid] loaded features', {
            count: allFeatures.length,
            sampleIds: allFeatures.slice(0, 5).map(f => f.id)
          });
        }

        // Build Spatial Index (Flatbush)
        // Initialize with number of items
        const index = new Flatbush(allFeatures.length);

        allFeatures.forEach(f => {
          // Calculate bbox from geometry (Polygon ring 0)
          // Coordinates are [ [ [lon, lat], ... ] ]
          const coords = f.geometry.coordinates[0];
          let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

          for (const p of coords) {
            if (p[0] < minX) minX = p[0];
            if (p[1] < minY) minY = p[1];
            if (p[0] > maxX) maxX = p[0];
            if (p[1] > maxY) maxY = p[1];
          }

          index.add(minX, minY, maxX, maxY);
        });

        index.finish();
        gridIndexRef.current = index;

        // Update Map
        const combinedData = {
          type: 'FeatureCollection',
          features: allFeatures
        };

        if (mapRef.current) {
          mapRef.current.updateGridData(combinedData);
          // Re-apply captured state if we already have it from Firestore
          if (capturedSetRef.current.size > 0) {
            mapRef.current.updateCapturedState(Array.from(capturedSetRef.current));
          }
        }

        // Debug intersection between captured IDs and loaded grid IDs
        if (process.env.NODE_ENV === 'development' && capturedSetRef.current.size > 0) {
          const gridIds = new Set(allFeatures.map(f => f.id));
          let hits = 0;
          capturedSetRef.current.forEach(id => {
            if (gridIds.has(id)) hits++;
          });
          console.log('[capture] intersection', {
            capturedCount: capturedSetRef.current.size,
            gridCount: allFeatures.length,
            hits,
            misses: capturedSetRef.current.size - hits
          });
        }

      } catch (err) {
        console.error('Failed to load grids:', err);
      }
    };

    loadGrids();
  }, [selectedDistricts]); // Re-run when selected districts change

  // Handle Auth & Data Sync
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

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
          const unsubscribeSnapshot = onSnapshot(userRef, async (docSnap) => {
            if (docSnap.exists()) {
              const data = docSnap.data();
          const capturedSquares = new Set<string>(data.capturedSquares || []);

          capturedSetRef.current = capturedSquares;
        if (process.env.NODE_ENV === 'development') {
          console.log('[capture] loaded from Firestore', {
            count: capturedSquares.size,
            sample: Array.from(capturedSquares).slice(0, 5)
          });
        }
        updateMapCapturedState();

              // Load username
              if (data.username) {
                setUsername(data.username);
              } else {
                // New user without username - show modal
                setIsUsernameModalOpen(true);
              }

              // Load saved filters if they exist
              if (data.filters) {
                if (data.filters.roadTypes) setSelectedRoadTypes(data.filters.roadTypes);
                if (data.filters.districts) setSelectedDistricts(data.filters.districts);
              }
            } else {
              // New user without doc - create with generated username
              const newUsername = generateUsername();
              await setDoc(userRef, {
                capturedSquares: [],
                email: currentUser.email,
                username: newUsername,
                createdAt: new Date().toISOString()
              });
              setUsername(newUsername);
              setIsUsernameModalOpen(true);
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
        capturedSetRef.current = new Set(localCaptured);
        if (process.env.NODE_ENV === 'development') {
          console.log('[capture] loaded from localStorage', {
            count: localCaptured.length,
            sample: localCaptured.slice(0, 5)
          });
        }
        updateMapCapturedState();

        // Load local filters
        const localFilters = JSON.parse(localStorage.getItem('filters') || 'null');
        if (localFilters) {
          if (localFilters.roadTypes) setSelectedRoadTypes(localFilters.roadTypes);
          if (localFilters.districts) setSelectedDistricts(localFilters.districts);
        }
      }
    });

    return () => unsubscribe();
  }, []); // Run once on mount (no dependency on gridData anymore)

  // Save filters on change
  useEffect(() => {
    const filters = {
      roadTypes: selectedRoadTypes,
      districts: selectedDistricts
    };

    if (user) {
      // Save to Firestore with debounce to avoid too many writes
      const timeoutId = setTimeout(() => {
        const userRef = doc(db, "users", user.uid);
        updateDoc(userRef, { filters }).catch(err => console.error("Error saving filters:", err));
      }, 1000);
      return () => clearTimeout(timeoutId);
    } else {
      // Save to LocalStorage
      localStorage.setItem('filters', JSON.stringify(filters));
    }
  }, [selectedRoadTypes, selectedDistricts, user]);

  const updateMapCapturedState = () => {
    const capturedCount = capturedSetRef.current.size;
    setStats({ captured: 0, totalCaptured: capturedCount });

    if (mapRef.current) {
      mapRef.current.updateCapturedState(Array.from(capturedSetRef.current));
    }
  };

  const requestWakeLock = useCallback(async () => {
    if (!keepScreenOn || !wakeLockSupported) return;
    setWakeLockError(null);

    try {
      const navWithWakeLock = navigator as WakeLockNavigator;
      if (!navWithWakeLock.wakeLock?.request) {
        setWakeLockError('Wake Lock nie jest wspierany w tej przeglądarce');
        return;
      }

      const sentinel = await navWithWakeLock.wakeLock.request('screen');
      wakeLockRef.current = sentinel;
      setWakeLockActive(true);

      sentinel.addEventListener('release', () => {
        setWakeLockActive(false);
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Nie udało się utrzymać ekranu aktywnego';
      console.error('Wake Lock error:', err);
      setWakeLockError(message);
      setWakeLockActive(false);
    }
  }, [keepScreenOn, wakeLockSupported]);

  const releaseWakeLock = useCallback(async () => {
    try {
      if (wakeLockRef.current) {
        await wakeLockRef.current.release?.();
      }
    } catch (err) {
      console.error('Wake Lock release error:', err);
    } finally {
      wakeLockRef.current = null;
      setWakeLockActive(false);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('highAccuracyEnabled', String(highAccuracyEnabled));
  }, [highAccuracyEnabled]);

  useEffect(() => {
    localStorage.setItem('keepScreenOn', String(keepScreenOn));
    if (keepScreenOn && isRecording) {
      requestWakeLock();
    } else if (!keepScreenOn) {
      releaseWakeLock();
    }
  }, [keepScreenOn, isRecording, releaseWakeLock, requestWakeLock]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && keepScreenOn && isRecording) {
        requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [keepScreenOn, isRecording, requestWakeLock]);

  useEffect(() => {
    if (!isMobile) return;
    if (!isStandalone && !pwaDismissed && !showPwaNudge && !installPromptEvent) {
      const timer = setTimeout(() => setShowPwaNudge(true), 2000);
      return () => clearTimeout(timer);
    }
  }, [installPromptEvent, isMobile, isStandalone, pwaDismissed, showPwaNudge]);

  useEffect(() => {
    return () => {
      releaseWakeLock();
    };
  }, [releaseWakeLock]);

  const handleInstallPwa = async () => {
    if (installPromptEvent) {
      await installPromptEvent.prompt();
      const result = await installPromptEvent.userChoice;
      if (result.outcome === 'accepted') {
        toast.success('Dziękujemy! Aplikacja zostanie zainstalowana na ekranie głównym.');
      }
      setInstallPromptEvent(null);
      setShowPwaNudge(false);
      return;
    }

    toast.info('Użyj opcji przeglądarki „Dodaj do ekranu głównego”, aby działać stabilniej w tle.');
    setShowPwaNudge(false);
  };

  const toggleHighAccuracy = () => setHighAccuracyEnabled(prev => !prev);
  const toggleKeepScreenOn = () => setKeepScreenOn(prev => !prev);
  const handleDismissPwaNudge = () => {
    setPwaDismissed(true);
    setShowPwaNudge(false);
  };

  // GPS Recording Functions
  const startRecording = () => {
    if (!navigator.geolocation) {
      toast.error('GPS niedostępny', {
        description: 'Twoja przeglądarka nie wspiera geolokalizacji.',
        duration: 4000,
      });
      return;
    }

    setIsRecording(true);
    setStartTime(Date.now());
    setRecordedPoints([]);
    setRecordingDuration(0);
    setLastFixTimestamp(null);
    setLastFixAccuracy(null);
    setGpsStale(false);
    setBackgroundWarning(false);
    gpsGapNotifiedRef.current = false;
    setQualityStats({
      droppedForAccuracy: 0,
      droppedForSpeed: 0,
      staleGaps: 0
    });

    if (keepScreenOn) {
      requestWakeLock();
    }

    toast.success('Nagrywanie rozpoczęte', {
      description: 'Spacer musi trwać minimum 1 minutę.',
      duration: 3000,
    });
  };

  const stopRecording = async () => {
    setIsRecording(false);
    setGpsStale(false);
    setBackgroundWarning(false);
    if (keepScreenOn || wakeLockActive) {
      releaseWakeLock();
    }

    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    // Validation: minimum 1 minute (approx 30 points at 2s interval, but let's keep 12 as safe lower bound)
    if (recordedPoints.length < 12) {
      toast.error('Spacer zbyt krótki', {
        description: `Nagrano tylko ${recordedPoints.length} punktów. Spacer musi trwać minimum 1 minutę.`,
        duration: 5000,
      });
      setRecordedPoints([]);
      setStartTime(null);
      localStorage.removeItem('activeRecording');
      return;
    }

    // Convert to GeoJSON LineString
    const geojson = {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: recordedPoints.map(p => [p.lon, p.lat])
        },
        properties: {
          name: 'Recorded Activity',
          time: new Date(startTime!).toISOString()
        }
      }]
    };

    // Process like GPX import
    const capturedCount = await processRecordedActivity(geojson);

    // Show success toast
    toast.success('Spacer zakończony!', {
      description: `Zdobyto ${capturedCount} ${capturedCount === 1 ? 'nowy kwadrat' : capturedCount < 5 ? 'nowe kwadraty' : 'nowych kwadratów'}!`,
      duration: 4000,
    });

    // Cleanup
    setRecordedPoints([]);
    setStartTime(null);
    setRecordingDuration(0);
    setLastFixTimestamp(null);
    setLastFixAccuracy(null);
    localStorage.removeItem('activeRecording');
  };

  const processRecordedActivity = useCallback(async (geojson: any): Promise<number> => {
    if (!gridFeaturesRef.current.length || !gridIndexRef.current) return 0;

    let newCapturedCount = 0;
    const newCapturedIds: string[] = [];

    const currentCapturedSet = capturedSetRef.current;

    const BATCH_SIZE = 5;
    const features = geojson.features.filter(
      (f: any) => f.geometry?.type === 'LineString' || f.geometry?.type === 'MultiLineString'
    );

    const processBatch = async (startIndex: number): Promise<void> => {
      const endIndex = Math.min(startIndex + BATCH_SIZE, features.length);

      for (let i = startIndex; i < endIndex; i++) {
        const feature = features[i];
        // Buffer 3 meters to account for GPS inaccuracy
        const bufferedPath = turf.buffer(feature as any, 0.003, { units: 'kilometers' });
        const pathBbox = turf.bbox(bufferedPath as any);

        // Use Flatbush to find candidates efficiently
        const candidateIndices = gridIndexRef.current!.search(
          pathBbox[0], pathBbox[1], pathBbox[2], pathBbox[3]
        );

        for (const idx of candidateIndices) {
          const cell = gridFeaturesRef.current[idx];
          if (currentCapturedSet.has(cell.id)) continue;

          if (turf.booleanIntersects(cell as any, bufferedPath as any)) {
            // cell.properties.captured = true; // No longer needed
            newCapturedIds.push(cell.id);
            currentCapturedSet.add(cell.id);
            newCapturedCount++;
          }
        }
      }

      if (endIndex < features.length) {
        await new Promise(resolve => setTimeout(resolve, 0));
        await processBatch(endIndex);
      }
    };

    await processBatch(0);

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

          // Update map visual state
          if (mapRef.current) {
            mapRef.current.updateCapturedState(Array.from(currentCapturedSet));
          }

        } catch (firestoreError: any) {
          console.error('Firestore error:', firestoreError);
          toast.error('Nie udało się zapisać postępu', {
            description: `${firestoreError.message}. Twój postęp nie został zapisany.`,
            duration: 5000,
          });
          // Revert local optimistic update
          newCapturedIds.forEach(id => currentCapturedSet.delete(id));
          if (mapRef.current) {
            mapRef.current.updateCapturedState(Array.from(currentCapturedSet));
          }
          return 0;
        }
      } else {
        localStorage.setItem('capturedSquares', JSON.stringify(Array.from(currentCapturedSet)));
        updateMapCapturedState();
      }
    }

    return newCapturedCount;
  }, [user]);

  // GPS Tracking Hook
  useEffect(() => {
    if (!isRecording) return;

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const now = Date.now();
        const point: RecordedPoint = {
          lat: position.coords.latitude,
          lon: position.coords.longitude,
          timestamp: now,
          accuracy: position.coords.accuracy
        };

        setLastFixTimestamp(now);
        setLastFixAccuracy(point.accuracy ?? null);
        setGpsStale(false);
        setBackgroundWarning(false);
        gpsGapNotifiedRef.current = false;

        setRecordedPoints(prev => {
          const last = prev[prev.length - 1];
          const qualityCutoff = highAccuracyEnabled ? 45 : 75; // meters
          let dropReason: 'accuracy' | 'speed' | null = null;

          if (point.accuracy !== undefined && point.accuracy > qualityCutoff) {
            dropReason = 'accuracy';
          }

          if (!dropReason && last) {
            const secondsSinceLast = (now - last.timestamp) / 1000;
            if (secondsSinceLast > 0) {
              const distanceKm = turf.distance([last.lon, last.lat], [point.lon, point.lat], { units: 'kilometers' });
              const speedMps = (distanceKm * 1000) / secondsSinceLast;
              if (speedMps > 12) {
                dropReason = 'speed';
              }
            }
          }

          if (dropReason) {
            setQualityStats(prevStats => ({
              ...prevStats,
              droppedForAccuracy: prevStats.droppedForAccuracy + (dropReason === 'accuracy' ? 1 : 0),
              droppedForSpeed: prevStats.droppedForSpeed + (dropReason === 'speed' ? 1 : 0)
            }));
            return prev;
          }

          const updated = [...prev, point];
          localStorage.setItem('activeRecording', JSON.stringify({
            points: updated,
            startTime: startTime ?? now
          }));
          return updated;
        });
      },
      (error) => {
        console.error('GPS error:', error);
        toast.error('Błąd GPS', {
          description: error.message,
          duration: 4000,
        });
      },
      {
        enableHighAccuracy: highAccuracyEnabled,
        timeout: highAccuracyEnabled ? 8000 : 20000,
        maximumAge: 0
      }
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [isRecording, startTime, highAccuracyEnabled]);

  // Update map route when points change
  useEffect(() => {
    if (mapRef.current && isRecording && recordedPoints.length > 0) {
      mapRef.current.updateRecordingRoute(recordedPoints);
    }
  }, [recordedPoints, isRecording]);

  // Detect stale GPS gaps and background throttling
  useEffect(() => {
    if (!isRecording) return;

    const timer = setInterval(() => {
      if (!lastFixTimestamp) return;
      const delta = Date.now() - lastFixTimestamp;
      const stale = delta > 30000;
      const throttled = delta > 45000;
      setGpsStale(stale);
      setBackgroundWarning(throttled);

      if (throttled && !gpsGapNotifiedRef.current) {
        setQualityStats(prev => ({
          ...prev,
          staleGaps: prev.staleGaps + 1
        }));
        toast.warning('GPS zwolnił w tle', {
          description: 'System ograniczył próbkowanie. Włącz utrzymanie ekranu lub wróć do aplikacji.',
          duration: 5000,
        });
        gpsGapNotifiedRef.current = true;
      }
    }, 5000);

    return () => clearInterval(timer);
  }, [isRecording, lastFixTimestamp]);

  // Duration Timer
  useEffect(() => {
    if (!isRecording || !startTime) return;

    const interval = setInterval(() => {
      setRecordingDuration(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [isRecording, startTime]);

  // Recovery on mount
  useEffect(() => {
    const saved = localStorage.getItem('activeRecording');
    if (saved) {
      try {
        const { points, startTime: savedStart } = JSON.parse(saved);
        if (points && points.length > 0) {
          const shouldRecover = confirm(
            `Znaleziono niezakończone nagrywanie z ${new Date(savedStart).toLocaleString()}. Czy chcesz je kontynuować?`
          );

          if (shouldRecover) {
            setRecordedPoints(points);
            setStartTime(savedStart);
            setIsRecording(true);
            if (points.length > 0) {
              const lastPoint = points[points.length - 1];
              setLastFixTimestamp(lastPoint.timestamp);
              setLastFixAccuracy(lastPoint.accuracy ?? null);
            }
            toast.info('Wznowiono nagrywanie', { duration: 3000 });
          } else {
            localStorage.removeItem('activeRecording');
          }
        }
      } catch (e) {
        console.error('Recovery error:', e);
        localStorage.removeItem('activeRecording');
      }
    }
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !gridFeaturesRef.current.length) return;

    setUploading(true);

    try {
      const text = await file.text();
      const parser = new DOMParser();
      const gpxDoc = parser.parseFromString(text, "text/xml");
      const geojson = gpx(gpxDoc);

      let newCapturedCount = 0;
      const newCapturedIds: string[] = [];

      // Determine current captured set
      const currentCapturedSet = capturedSetRef.current;

      // Process features in batches to keep UI responsive
      const BATCH_SIZE = 5; // Process 5 features at a time
      const features = geojson.features.filter(
        (f: any) => f.geometry?.type === 'LineString' || f.geometry?.type === 'MultiLineString'
      );

      const processBatch = async (startIndex: number): Promise<void> => {
        const endIndex = Math.min(startIndex + BATCH_SIZE, features.length);

        for (let i = startIndex; i < endIndex; i++) {
          const feature = features[i];
          // Buffer 3 meters to account for GPS inaccuracy
          const bufferedPath = turf.buffer(feature as any, 0.003, { units: 'kilometers' });
          const pathBbox = turf.bbox(bufferedPath as any);

          // Use Flatbush to find candidates efficiently
          const candidateIndices = gridIndexRef.current!.search(
            pathBbox[0], pathBbox[1], pathBbox[2], pathBbox[3]
          );

          for (const idx of candidateIndices) {
            const cell = gridFeaturesRef.current[idx];
            if (currentCapturedSet.has(cell.id)) continue;

            if (turf.booleanIntersects(cell as any, bufferedPath as any)) {
              newCapturedIds.push(cell.id);
              currentCapturedSet.add(cell.id);
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
            // Revert local optimistic update
            newCapturedIds.forEach(id => currentCapturedSet.delete(id));
            if (mapRef.current) {
              mapRef.current.updateCapturedState(Array.from(currentCapturedSet));
            }
            setUploading(false);
            return;
          }
        } else {
          localStorage.setItem('capturedSquares', JSON.stringify(Array.from(currentCapturedSet)));
          updateMapCapturedState();
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

  const toggleDistrict = (districtName: string) => {
    setSelectedDistricts(prev =>
      prev.includes(districtName)
        ? prev.filter(name => name !== districtName)
        : [...prev, districtName]
    );
  };

  const selectAllDistricts = () => setSelectedDistricts(DISTRICTS.map(d => d.name));
  const deselectAllDistricts = () => setSelectedDistricts([]);

  const handleSaveUsername = async (newUsername: string) => {
    if (!user) return;

    const userRef = doc(db, "users", user.uid);
    await updateDoc(userRef, {
      username: newUsername
    });
    setUsername(newUsername);
    toast.success('Pseudonim zapisany', {
      description: `Twój nowy pseudonim to: ${newUsername}`,
      duration: 3000,
    });
  };

  // Calculate visible grid count based on selected districts
  const visibleGridCount = gridFeaturesRef.current
    ? gridFeaturesRef.current.filter((f: any) =>
      selectedDistricts.length === 0 || selectedDistricts.includes(f.properties.d) // Updated property 'd'
    ).length
    : 0;

  const visibleCapturedCount = gridFeaturesRef.current && stats
    ? gridFeaturesRef.current.filter((f: any) =>
      capturedSetRef.current.has(f.id) &&
      (selectedDistricts.length === 0 || selectedDistricts.includes(f.properties.d)) // Updated property 'd'
    ).length
    : 0;

  const progressPercentage = visibleGridCount > 0
    ? (visibleCapturedCount / visibleGridCount) * 100
    : 0;
  const remaining = visibleGridCount - visibleCapturedCount;
  const lastFixSecondsAgo = lastFixTimestamp ? Math.floor((Date.now() - lastFixTimestamp) / 1000) : null;
  const accuracyDisplay = lastFixAccuracy !== null ? `${Math.round(lastFixAccuracy)} m` : 'brak danych';
  const gpsStatusText = !isRecording
    ? 'Gotowy do nagrania'
    : gpsStale
      ? 'Ograniczone próbkowanie (tło)'
      : lastFixTimestamp
        ? 'GPS aktywny'
        : 'Oczekiwanie na fix...';
  const gpsStatusClass = !isRecording
    ? 'bg-gray-100 text-gray-700'
    : gpsStale
      ? 'bg-amber-100 text-amber-800'
      : lastFixTimestamp
        ? 'bg-emerald-100 text-emerald-700'
        : 'bg-gray-100 text-gray-700';

  const syncStrava = useCallback(async () => {
    if (!user || !gridFeaturesRef.current.length) {
      console.log('Sync skipped: user or gridData not ready');
      return;
    }

    console.log('Starting Strava sync...');
    try {
      const token = await user.getIdToken();
      console.log('Got Firebase token, calling /api/strava/sync...');

      const res = await fetch('/api/strava/sync', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });

      console.log('Sync response status:', res.status);

      if (res.ok) {
        const data = await res.json();
        console.log('Sync data:', data);

        if (data.success && data.newActivities?.features?.length > 0) {
          console.log(`Processing ${data.newActivities.features.length} new activities...`);
          const capturedCount = await processRecordedActivity(data.newActivities);

          const activityCount = data.newActivities.features.length;
          const activityText = activityCount === 1 ? 'aktywność' : activityCount < 5 ? 'aktywności' : 'aktywności';
          const squareText = capturedCount === 1 ? 'nowy kwadrat' : capturedCount < 5 ? 'nowe kwadraty' : 'nowych kwadratów';

          if (capturedCount > 0) {
            toast.success(`Znaleziono ${activityCount} ${activityText} ze Strava!`, {
              description: `Zaimportowano i zdobyto ${capturedCount} ${squareText}.`,
              duration: 5000,
            });
          } else {
            toast.info(`Znaleziono ${activityCount} ${activityText} ze Strava`, {
              description: 'Wszystkie kwadraty z tych tras były już zdobyte.',
              duration: 4000,
            });
          }
        } else {
          console.log('No new activities to sync');
          // Don't show notification for no new activities during auto-sync
        }
      } else {
        const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Sync failed:', res.status, errorData);
        toast.error(`Błąd synchronizacji: ${errorData.error || 'Nieznany błąd'}`);
      }
    } catch (e) {
      console.error('Strava sync error:', e);
      toast.error('Błąd podczas synchronizacji ze Strava');
    }
  }, [processRecordedActivity, user]);

  // Auto-sync Strava when user and grid are ready
  useEffect(() => {
    if (user && gridFeaturesRef.current.length > 0 && !isSyncing) {
      // Small delay to ensure everything is settled
      const timer = setTimeout(() => {
        syncStrava();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isSyncing, syncStrava, totalGridCount, user]); // Run once when user/grid becomes available (totalGridCount changes when grid loads)

  return (
    <main className="flex h-screen flex-col">
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        initialMode={authMode}
      />
      <HelpModal
        isOpen={isHelpModalOpen}
        onClose={() => setIsHelpModalOpen(false)}
      />
      <UsernameModal
        isOpen={isUsernameModalOpen}
        onClose={() => setIsUsernameModalOpen(false)}
        onSave={handleSaveUsername}
        currentUsername={username}
        isFirstTime={!username}
      />
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        user={user}
        username={username}
        onEditUsername={() => {
          setIsSettingsModalOpen(false);
          setIsUsernameModalOpen(true);
        }}
        onSyncStrava={syncStrava}
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
            <div className="h-6 bg-gray-200 rounded-full overflow-hidden w-full relative">
              <div
                className="h-full bg-gradient-to-r from-green-500 to-green-600 transition-all duration-500 ease-out"
                style={{ width: `${progressPercentage}%` }}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xs font-semibold text-gray-700">
                  {progressPercentage.toFixed(1)}%
                </span>
              </div>
            </div>

            {/* Tooltip */}
            {showTooltip && (
              <div className="absolute top-full mt-2 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white px-4 py-3 rounded-lg shadow-lg z-30 whitespace-nowrap">
                <div className="text-xs space-y-1">
                  <div className="flex justify-between gap-4">
                    <span className="text-gray-300">Widocznych kwadratów:</span>
                    <span className="font-semibold">{visibleGridCount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-green-400">Zdobytych:</span>
                    <span className="font-semibold">{visibleCapturedCount.toLocaleString()}</span>
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

          {/* Recording Button */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span tabIndex={0}> {/* Wrapper for disabled button tooltip */}
                  <button
                    onClick={isRecording ? stopRecording : startRecording}
                    disabled={uploading || (!isRecording && locationPermission === 'denied')}
                    className={`px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg font-medium text-xs sm:text-sm flex items-center gap-1 sm:gap-2 transition-colors ${isRecording
                      ? 'bg-red-600 text-white hover:bg-red-700 animate-pulse'
                      : (locationPermission === 'denied'
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-green-600 text-white hover:bg-green-700')
                      }`}
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      {isRecording ? (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      ) : (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      )}
                    </svg>
                    <span className="hidden sm:inline">
                      {isRecording ? (
                        <>
                          {Math.floor(recordingDuration / 60)}:{(recordingDuration % 60).toString().padStart(2, '0')}
                          <span className="text-xs ml-1">({recordedPoints.length})</span>
                        </>
                      ) : (
                        'Rozpocznij spacer'
                      )}
                    </span>
                  </button>
                </span>
              </TooltipTrigger>
              {!isRecording && locationPermission === 'denied' && (
                <TooltipContent>
                  <p>Włącz usługi lokalizacji w przeglądarce, aby rozpocząć spacer.</p>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>

          {/* Import Button - Hidden on mobile, visible only for logged in users */}
          {user && (
            <label className="cursor-pointer hidden sm:block">
              <input
                type="file"
                accept=".gpx"
                onChange={handleFileUpload}
                disabled={uploading || isRecording}
                className="hidden"
              />
              <div className={`px-2 sm:px-4 py-1.5 sm:py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors font-medium text-xs sm:text-sm flex items-center gap-1 sm:gap-2 ${(uploading || isRecording) ? 'opacity-50 cursor-not-allowed' : ''}`}>
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
          )}

          <div className="h-4 sm:h-6 w-px bg-gray-300 hidden sm:block"></div>

          {/* Auth Button / User Menu */}
          {user ? (
            <div className="relative">
              <button
                onClick={() => setShowUserDropdown(!showUserDropdown)}
                className="flex items-center gap-2 px-2 sm:px-3 py-1.5 sm:py-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <div className="w-7 h-7 sm:w-8 sm:h-8 bg-gradient-to-br from-violet-500 to-fuchsia-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                  {username.charAt(0).toUpperCase()}
                </div>
                <div className="hidden lg:block text-left">
                  <div className="text-xs sm:text-sm font-medium text-gray-900">{username}</div>
                  <div className="text-xs text-gray-500">{user.email}</div>
                </div>
                <svg className="w-4 h-4 text-gray-500 hidden sm:block" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Dropdown Menu */}
              {showUserDropdown && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowUserDropdown(false)}
                  />
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-20">
                    <div className="px-4 py-3 border-b border-gray-100">
                      <p className="text-sm font-medium text-gray-900">{username}</p>
                      <p className="text-xs text-gray-500 truncate">{user.email}</p>
                    </div>
                    <button
                      onClick={() => {
                        setShowUserDropdown(false);
                        setIsSettingsModalOpen(true);
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      Ustawienia
                    </button>
                    <button
                      onClick={() => {
                        setShowUserDropdown(false);
                        signOut(auth);
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      Wyloguj się
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <button
              onClick={() => {
                setAuthMode('login');
                setIsAuthModalOpen(true);
              }}
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
        </div>
      </div>

      {/* GPS helper bar (mobile only) */}
      {isMobile && (
        <div className="bg-slate-900 text-white px-3 sm:px-6 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-emerald-600/80">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.1 0-2 .9-2 2m6 0a4 4 0 11-8 0 4 4 0 018 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2v2m0 16v2m10-10h-2M4 12H2m15.364-6.364l-1.414 1.414M8.05 15.95l-1.414 1.414m10.728 0l-1.414-1.414M8.05 8.05L6.636 6.636" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold">Tryb przeglądarki — wskazówki</p>
              <p className="text-xs text-slate-200">
                W tle GPS może zwolnić. Włącz poniższe opcje, aby utrzymać częstsze próbkowanie.
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                <span className={`text-[11px] px-2 py-1 rounded-full font-semibold ${gpsStatusClass}`}>
                  {gpsStatusText}
                </span>
                <span className="text-[11px] px-2 py-1 rounded-full bg-slate-800 text-slate-100">
                  {lastFixSecondsAgo !== null ? `Ostatni fix ${lastFixSecondsAgo}s temu` : 'Czekam na pierwszy punkt'}
                </span>
                <span className="text-[11px] px-2 py-1 rounded-full bg-slate-800 text-slate-100">
                  Dokładność: {accuracyDisplay}
                </span>
                {backgroundWarning && (
                  <span className="text-[11px] px-2 py-1 rounded-full bg-amber-200 text-amber-800 font-semibold">
                    System ogranicza GPS w tle
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={toggleHighAccuracy}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${highAccuracyEnabled
                ? 'bg-emerald-500 text-white border-emerald-400 hover:bg-emerald-600'
                : 'bg-slate-800 text-slate-100 border-slate-700 hover:bg-slate-700'
                }`}
            >
              {highAccuracyEnabled ? 'Dokładne śledzenie: ON' : 'Dokładne śledzenie: OFF'}
            </button>
            <button
              onClick={toggleKeepScreenOn}
              disabled={!wakeLockSupported}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors flex items-center gap-1 ${keepScreenOn && wakeLockSupported
                ? 'bg-amber-500 text-white border-amber-300 hover:bg-amber-600'
                : 'bg-slate-800 text-slate-100 border-slate-700 hover:bg-slate-700'
                } ${!wakeLockSupported ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l7-9h-3l1-3-6 6h3z" />
              </svg>
              {keepScreenOn && wakeLockSupported ? 'Ekran aktywny' : 'Utrzymaj ekran'}
            </button>
            {showPwaNudge && !isStandalone && !pwaDismissed && (
              <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs">
                <button
                  onClick={handleInstallPwa}
                  className="font-semibold text-white hover:text-emerald-200 transition-colors"
                >
                  Dodaj do ekranu głównego
                </button>
                <button
                  onClick={handleDismissPwaNudge}
                  className="text-slate-400 hover:text-white transition-colors"
                  aria-label="Zamknij podpowiedź PWA"
                >
                  ×
                </button>
              </div>
            )}
            {wakeLockError && (
              <span className="text-[11px] text-amber-200 font-medium">
                {wakeLockError}
              </span>
            )}
          </div>
        </div>
      )}

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
          <div className="grid grid-cols-3 gap-3 mb-6">
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

          <div className="flex items-center justify-between mb-3 border-t border-gray-200 pt-4">
            <h2 className="text-sm font-semibold text-gray-700">Dzielnice</h2>
            <div className="flex gap-2">
              <button
                onClick={selectAllDistricts}
                className="text-xs px-2 py-1 text-violet-600 hover:bg-violet-50 rounded"
              >
                Zaznacz wszystkie
              </button>
              <button
                onClick={deselectAllDistricts}
                className="text-xs px-2 py-1 text-gray-600 hover:bg-gray-100 rounded"
              >
                Wyczyść
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {DISTRICTS.map(district => (
              <label
                key={district.id}
                className="flex items-center gap-2 cursor-pointer hover:bg-white p-2 rounded transition-colors"
              >
                <input
                  type="checkbox"
                  checked={selectedDistricts.includes(district.name)}
                  onChange={() => toggleDistrict(district.name)}
                  className="h-4 w-4 text-violet-600 rounded border-gray-300 focus:ring-violet-500"
                />
                <span className="text-sm font-medium text-gray-900">{district.name}</span>
              </label>
            ))}
          </div>

          <div className="flex justify-end mt-4">
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
        {!user && (
          <WelcomePanel onRegister={() => {
            setAuthMode('register');
            setIsAuthModalOpen(true);
          }} />
        )}
        <MapView ref={mapRef} selectedRoadTypes={selectedRoadTypes} selectedDistricts={selectedDistricts} />

        {/* Recording Overlay */}
        {isRecording && (
          <div className="absolute inset-0 pointer-events-none z-10 flex flex-col justify-end pb-6 sm:pb-10 items-center bg-white/5 backdrop-blur-[1px]">
            <div className="pointer-events-auto bg-white/95 backdrop-blur-md p-4 sm:p-6 rounded-2xl shadow-2xl border-2 border-red-100 flex flex-col items-center gap-2 sm:gap-4 w-[90%] max-w-sm mx-auto animate-in slide-in-from-bottom-10 fade-in duration-300">
              <div className="flex items-center gap-2 text-red-600 font-bold animate-pulse text-sm sm:text-base">
                <div className="w-2 h-2 sm:w-3 sm:h-3 bg-red-600 rounded-full"></div>
                NAGRYWANIE SPACERU
              </div>
              <div className="text-3xl sm:text-4xl font-mono font-bold text-gray-900 tracking-wider">
                {Math.floor(recordingDuration / 60)}:{(recordingDuration % 60).toString().padStart(2, '0')}
              </div>
              <div className="text-xs sm:text-sm text-gray-500 font-medium">
                {recordedPoints.length} punktów GPS
              </div>

              {isMobile && (
                <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="bg-slate-50 border border-slate-100 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs sm:text-sm font-semibold text-slate-800">GPS</p>
                      <span className={`text-[11px] px-2 py-1 rounded-full font-semibold ${gpsStatusClass}`}>
                        {gpsStatusText}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 mt-1">
                      Ostatni fix: {lastFixSecondsAgo !== null ? `${lastFixSecondsAgo}s temu` : 'oczekiwanie'} • Dokładność: {accuracyDisplay}
                    </p>
                    {backgroundWarning && (
                      <p className="text-[11px] text-amber-700 mt-1 font-semibold">
                        System może ograniczać próbkowanie w tle.
                      </p>
                    )}
                  </div>
                  <div className="bg-slate-50 border border-slate-100 rounded-lg p-3">
                    <p className="text-xs sm:text-sm font-semibold text-slate-800">Jakość trasy</p>
                    <p className="text-[11px] text-slate-600 mt-1">
                      Odrzucone punkty: {qualityStats.droppedForAccuracy + qualityStats.droppedForSpeed} (dokł.: {qualityStats.droppedForAccuracy}, skoki: {qualityStats.droppedForSpeed})
                    </p>
                    <p className="text-[11px] text-slate-600">
                      Przerwy w tle: {qualityStats.staleGaps}
                    </p>
                  </div>
                </div>
              )}

              {/* Warning */}
              <div className="w-full bg-amber-50 border border-amber-200 rounded-lg p-2 sm:p-3 mt-1">
                <p className="text-xs text-amber-800 text-center leading-relaxed">
                  ⚠️ Najlepsza dokładność: pozostaw aplikację otwartą lub włącz „Utrzymaj ekran”. W tle system spowalnia GPS.
                </p>
                <button
                  onClick={() => setIsHelpModalOpen(true)}
                  className="text-xs text-amber-700 hover:text-amber-900 underline mt-1 w-full text-center font-medium"
                >
                  Import GPX po spacerze →
                </button>
              </div>

              <button
                onClick={stopRecording}
                className="w-full py-3 sm:py-4 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 text-sm sm:text-base mt-2"
              >
                <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
                ZAKOŃCZ SPACER
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
