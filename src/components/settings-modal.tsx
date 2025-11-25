"use client";

import { useState } from "react";
import { User } from "firebase/auth";

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    user: User | null;
    username: string;
    onEditUsername: () => void;
}

export default function SettingsModal({
    isOpen,
    onClose,
    user,
    username,
    onEditUsername
}: SettingsModalProps) {
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

                    {/* Profile Section */}
                    <div className="space-y-4">
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

                        {/* Stats Section (placeholder for future) */}
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
