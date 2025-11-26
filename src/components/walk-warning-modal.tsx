"use client";

import { useState } from "react";

interface WalkWarningModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (dontShowAgain: boolean) => void;
}

export default function WalkWarningModal({ isOpen, onClose, onConfirm }: WalkWarningModalProps) {
    const [dontShowAgain, setDontShowAgain] = useState(false);

    if (!isOpen) return null;

    const handleConfirm = () => {
        onConfirm(dontShowAgain);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
                <div className="p-5 sm:p-6">
                    {/* Icon and Title */}
                    <div className="flex items-start gap-3 mb-4">
                        <div className="p-2 bg-amber-100 rounded-lg text-amber-600 flex-shrink-0">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">
                                Funkcja demonstracyjna
                            </h2>
                            <p className="text-sm text-gray-600 mt-1">
                                Przed rozpoczęciem przeczytaj poniższe informacje
                            </p>
                        </div>
                    </div>

                    {/* Warning Content */}
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
                        <p className="text-sm text-gray-700 leading-relaxed mb-3">
                            Nagrywanie spaceru w przeglądarce służy <strong>głównie demonstracji</strong> i ma ograniczenia:
                        </p>
                        <ul className="space-y-2 text-sm text-gray-700">
                            <li className="flex gap-2">
                                <span className="text-amber-600 flex-shrink-0">•</span>
                                <span>Niedokładne śledzenie GPS</span>
                            </li>
                            <li className="flex gap-2">
                                <span className="text-amber-600 flex-shrink-0">•</span>
                                <span>Wymaga aktywnej przeglądarki (nie można zablokować ekranu)</span>
                            </li>
                            <li className="flex gap-2">
                                <span className="text-amber-600 flex-shrink-0">•</span>
                                <span>Szybsze zużycie baterii</span>
                            </li>
                        </ul>
                    </div>

                    {/* Recommendation */}
                    <div className="bg-violet-50 border border-violet-200 rounded-lg p-4 mb-4">
                        <p className="text-sm font-semibold text-gray-900 mb-2">
                            ✅ Zalecamy używanie:
                        </p>
                        <p className="text-sm text-gray-700 mb-3">
                            <strong>Strava</strong>, <strong>Komoot</strong> lub innej aplikacji GPS z eksportem GPX
                        </p>
                        <a
                            href="https://www.strava.com"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-sm text-violet-600 hover:text-violet-700 font-medium"
                        >
                            <span>Zobacz tutorial jak eksportować GPX</span>
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                        </a>
                        <p className="text-xs text-gray-500 mt-2">
                            💡 Integracja z aplikacjami GPS w trakcie rozwoju
                        </p>
                    </div>

                    {/* Checkbox */}
                    <label className="flex items-start gap-2 mb-5 cursor-pointer group">
                        <input
                            type="checkbox"
                            checked={dontShowAgain}
                            onChange={(e) => setDontShowAgain(e.target.checked)}
                            className="mt-0.5 w-4 h-4 text-violet-600 border-gray-300 rounded focus:ring-violet-500 cursor-pointer"
                        />
                        <span className="text-sm text-gray-700 group-hover:text-gray-900">
                            Nie pokazuj tego ponownie
                        </span>
                    </label>

                    {/* Actions */}
                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                        >
                            Anuluj
                        </button>
                        <button
                            onClick={handleConfirm}
                            className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
                        >
                            Rozumiem, rozpocznij
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
