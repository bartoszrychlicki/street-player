"use client";

import { useState, useEffect } from "react";
import { User } from "firebase/auth";

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    user: User | null;
    username: string;
    onEditUsername: () => void;
    onSyncStrava?: () => Promise<void>;
}

export default function SettingsModal({
    isOpen,
    onClose,
    user,
    username,
    onEditUsername,
    onSyncStrava
}: SettingsModalProps) {
    const [stravaStatus, setStravaStatus] = useState<{ connected: boolean; athleteId?: string } | null>(null);
    const [loadingStrava, setLoadingStrava] = useState(false);
    const [syncing, setSyncing] = useState(false);

    // Check Strava status when modal opens
    useEffect(() => {
        if (isOpen && user) {
            checkStravaStatus();
        }
    }, [isOpen, user]);

    const checkStravaStatus = async () => {
        if (!user) return;
        try {
            const token = await user.getIdToken();
            const res = await fetch('/api/strava/status', {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setStravaStatus(data);
            }
        } catch (err) {
            console.error('Failed to check Strava status', err);
        }
    };

    const handleConnectStrava = async () => {
        setLoadingStrava(true);
        try {
            const res = await fetch('/api/strava/auth-url');
            const data = await res.json();
            if (data.url) {
                window.location.href = data.url;
            } else {
                console.error('No auth URL returned');
            }
        } catch (err) {
            console.error('Failed to get auth URL', err);
        } finally {
            setLoadingStrava(false);
        }
    };

    const handleSyncStrava = async () => {
        if (!user) return;
        setSyncing(true);
        try {
            if (onSyncStrava) {
                await onSyncStrava();
            } else {
                // Fallback (should not be reached if prop is passed)
                const token = await user.getIdToken();
                await fetch('/api/strava/sync', {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${token}` }
                });
                window.location.reload();
            }
        } catch (err) {
            console.error('Sync failed', err);
            alert('Błąd synchronizacji');
        } finally {
            setSyncing(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md relative">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 z-10"
                >
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>

                <div className="p-6">
                    <h2 className="text-2xl font-bold text-gray-900 mb-6">Ustawienia</h2>

                    <div className="space-y-6">
                        {/* Profile Section */}
                        <div className="bg-gray-50 rounded-lg p-4">
                            <h3 className="text-sm font-semibold text-gray-700 mb-3">Profil</h3>

                            {/* Username */}
                            <div className="flex items-center justify-between py-2">
                                <div>
                                    <p className="text-sm font-medium text-gray-900">Pseudonim</p>
                                    <p className="text-sm text-gray-600">{username}</p>
                                </div>
                                <button
                                    onClick={onEditUsername}
                                    className="px-3 py-1.5 text-sm font-medium text-violet-600 hover:bg-violet-50 rounded-lg transition-colors"
                                >
                                    Zmień
                                </button>
                            </div>

                            {/* Email */}
                            <div className="border-t border-gray-200 pt-3 mt-3">
                                <p className="text-sm font-medium text-gray-900">Email</p>
                                <p className="text-sm text-gray-600">{user?.email}</p>
                            </div>
                        </div>

                        {/* Integrations Section */}
                        <div className="bg-gray-50 rounded-lg p-4">
                            <h3 className="text-sm font-semibold text-gray-700 mb-3">Integracje</h3>

                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    {/* Strava Icon */}
                                    <svg className="w-8 h-8 text-[#FC4C02]" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
                                    </svg>
                                    <div>
                                        <p className="text-sm font-medium text-gray-900">Strava</p>
                                        <p className="text-xs text-gray-500">
                                            {stravaStatus?.connected
                                                ? 'Połączono'
                                                : 'Synchronizuj swoje spacery'}
                                        </p>
                                    </div>
                                </div>

                                {stravaStatus?.connected ? (
                                    <button
                                        onClick={handleSyncStrava}
                                        disabled={syncing}
                                        className="px-3 py-1.5 text-sm font-medium text-white bg-[#FC4C02] hover:bg-[#E34402] rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                                    >
                                        {syncing ? (
                                            <>
                                                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                                </svg>
                                                Sync
                                            </>
                                        ) : (
                                            'Synchronizuj'
                                        )}
                                    </button>
                                ) : (
                                    <button
                                        onClick={handleConnectStrava}
                                        disabled={loadingStrava}
                                        className="px-3 py-1.5 text-sm font-medium text-[#FC4C02] border border-[#FC4C02] hover:bg-orange-50 rounded-lg transition-colors disabled:opacity-50"
                                    >
                                        {loadingStrava ? 'Łączenie...' : 'Połącz'}
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Stats Section */}
                        <div className="bg-gradient-to-br from-violet-50 to-fuchsia-50 rounded-lg p-4 border border-violet-100">
                            <h3 className="text-sm font-semibold text-gray-700 mb-2">Statystyki</h3>
                            <p className="text-xs text-gray-600">
                                Wkrótce: Twoje rankingi, osiągnięcia i porównanie z innymi odkrywcami!
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
