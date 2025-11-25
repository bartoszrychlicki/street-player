"use client";

import { useState } from "react";
import { generateUsername, validateUsername } from "@/lib/username-generator";

interface UsernameModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (username: string) => Promise<void>;
    currentUsername?: string;
    isFirstTime?: boolean;
}

export default function UsernameModal({
    isOpen,
    onClose,
    onSave,
    currentUsername,
    isFirstTime = false
}: UsernameModalProps) {
    const [username, setUsername] = useState(currentUsername || generateUsername());
    const [error, setError] = useState("");
    const [saving, setSaving] = useState(false);

    if (!isOpen) return null;

    const handleRegenerate = () => {
        setUsername(generateUsername());
        setError("");
    };

    const handleSave = async () => {
        const validation = validateUsername(username);
        if (!validation.valid) {
            setError(validation.error || "Nieprawidłowy pseudonim");
            return;
        }

        setSaving(true);
        setError("");

        try {
            await onSave(username);
            onClose();
        } catch (err: any) {
            setError(err.message || "Nie udało się zapisać pseudonimu");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 relative m-4">
                {!isFirstTime && (
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
                    >
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                )}

                <div className="text-center mb-6">
                    <div className="w-16 h-16 bg-gradient-to-br from-violet-500 to-fuchsia-500 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900">
                        {isFirstTime ? "Wybierz pseudonim" : "Zmień pseudonim"}
                    </h2>
                    <p className="text-sm text-gray-600 mt-2">
                        {isFirstTime
                            ? "Wygenerowaliśmy dla Ciebie losowy pseudonim. Możesz go zaakceptować lub zmienić."
                            : "Twój pseudonim będzie widoczny w rankingach i statystykach."}
                    </p>
                </div>

                {error && (
                    <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">
                        {error}
                    </div>
                )}

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Twój pseudonim
                        </label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => {
                                    setUsername(e.target.value);
                                    setError("");
                                }}
                                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none transition-all"
                                placeholder="np. SzybkiWędrowiec"
                                maxLength={20}
                            />
                            <button
                                onClick={handleRegenerate}
                                className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
                                title="Wygeneruj nowy"
                            >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                            </button>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                            3-20 znaków, tylko litery i cyfry
                        </p>
                    </div>

                    <div className="flex gap-3">
                        {!isFirstTime && (
                            <button
                                onClick={onClose}
                                disabled={saving}
                                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
                            >
                                Anuluj
                            </button>
                        )}
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="flex-1 px-4 py-2 bg-violet-600 text-white rounded-lg font-medium hover:bg-violet-700 transition-colors disabled:opacity-50"
                        >
                            {saving ? "Zapisywanie..." : (isFirstTime ? "Zatwierdź" : "Zapisz")}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
