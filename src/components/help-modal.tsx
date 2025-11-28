"use client";

interface HelpModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function HelpModal({ isOpen, onClose }: HelpModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto relative">
                <button
                    onClick={onClose}
                    className="sticky top-4 float-right mr-4 text-gray-400 hover:text-gray-600 z-10"
                >
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>

                <div className="p-6 sm:p-8">
                    <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
                        Jak zarejestrować spacer?
                    </h2>
                    <p className="text-gray-600 mb-6">
                        Masz dwie opcje: nagrywanie w przeglądarce lub import GPX ze Stravy/innej aplikacji.
                    </p>

                    {/* Option 1: Browser Recording */}
                    <div className="mb-8 bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-xl p-5">
                        <div className="flex items-start gap-3 mb-3">
                            <div className="p-2 bg-green-600 rounded-lg text-white">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                </svg>
                            </div>
                            <div>
                                <h3 className="font-bold text-lg text-gray-900">Opcja 1: Nagrywanie w przeglądarce</h3>
                                <p className="text-sm text-gray-600 mt-1">Najprostsze, ale pamiętaj o ograniczeniach w tle</p>
                            </div>
                        </div>

                        <ol className="space-y-2 text-sm text-gray-700 ml-2">
                            <li className="flex gap-2">
                                <span className="font-bold text-green-600 min-w-[20px]">1.</span>
                                <span>Włącz przełącznik <strong>Dokładne śledzenie</strong> w górnym pasku</span>
                            </li>
                            <li className="flex gap-2">
                                <span className="font-bold text-green-600 min-w-[20px]">2.</span>
                                <span>Jeśli dostępne, kliknij <strong>Utrzymaj ekran</strong> (zapobiega usypianiu i poprawia częstotliwość GPS)</span>
                            </li>
                            <li className="flex gap-2">
                                <span className="font-bold text-green-600 min-w-[20px]">3.</span>
                                <span><strong className="text-red-600">WAŻNE:</strong> Trzymaj aplikację otwartą; w tle próbkowanie może zwolnić</span>
                            </li>
                            <li className="flex gap-2">
                                <span className="font-bold text-green-600 min-w-[20px]">4.</span>
                                <span>Po zakończeniu kliknij Zakończ spacer</span>
                            </li>
                        </ol>

                        <div className="mt-4 bg-white/60 border border-green-300 rounded-lg p-3">
                            <p className="text-xs text-gray-700">
                                <strong>💡 Wskazówka:</strong> Dodaj aplikację do ekranu głównego (PWA) na Androidzie dla bardziej stabilnej pracy w tle. Długie spacery? Rozważ import GPX (poniżej).
                            </p>
                        </div>
                    </div>

                    {/* Option 2: Strava Import */}
                    <div className="bg-gradient-to-br from-violet-50 to-purple-50 border border-violet-200 rounded-xl p-5">
                        <div className="flex items-start gap-3 mb-3">
                            <div className="p-2 bg-violet-600 rounded-lg text-white">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                </svg>
                            </div>
                            <div>
                                <h3 className="font-bold text-lg text-gray-900">Opcja 2: Import GPX ze Stravy</h3>
                                <p className="text-sm text-gray-600 mt-1">Zalecane dla dłuższych spacerów</p>
                            </div>
                        </div>

                        <ol className="space-y-3 text-sm text-gray-700 ml-2">
                            <li className="flex gap-2">
                                <span className="font-bold text-violet-600 min-w-[20px]">1.</span>
                                <div>
                                    <strong>Nagraj aktywność w Stravie</strong>
                                    <p className="text-xs text-gray-500 mt-1">Otwórz aplikację Strava na telefonie i nagraj spacer/bieg jako zwykle</p>
                                </div>
                            </li>
                            <li className="flex gap-2">
                                <span className="font-bold text-violet-600 min-w-[20px]">2.</span>
                                <div>
                                    <strong>Eksportuj GPX</strong>
                                    <ul className="text-xs text-gray-600 mt-1 ml-4 space-y-1">
                                        <li>• Otwórz <a href="https://www.strava.com" target="_blank" rel="noopener noreferrer" className="text-violet-600 hover:underline">strava.com</a> na komputerze</li>
                                        <li>• Przejdź do swojej aktywności</li>
                                        <li>• Kliknij ikonę <strong>klucza</strong> (⚙️) w lewym menu</li>
                                        <li>• Wybierz <strong>Export GPX</strong></li>
                                        <li>• Zapisz plik na dysku</li>
                                    </ul>
                                </div>
                            </li>
                            <li className="flex gap-2">
                                <span className="font-bold text-violet-600 min-w-[20px]">3.</span>
                                <div>
                                    <strong>Importuj do Street Player</strong>
                                    <p className="text-xs text-gray-500 mt-1">Zaloguj się w Street Player i kliknij Importuj GPX w górnym menu</p>
                                </div>
                            </li>
                        </ol>

                        <div className="mt-4 bg-white/60 border border-violet-300 rounded-lg p-3">
                            <p className="text-xs text-gray-700">
                                <strong>✅ Zalety:</strong> Możesz używać telefonu normalnie, dłuższa żywotność baterii, lepsza dokładność GPS
                            </p>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="mt-6 pt-6 border-t border-gray-200">
                        <p className="text-xs text-gray-500 text-center">
                            Inne aplikacje GPS (Garmin, Komoot, itp.) również pozwalają eksportować GPX
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
