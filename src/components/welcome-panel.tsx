import React from 'react';

interface WelcomePanelProps {
    onRegister: () => void;
}

export default function WelcomePanel({ onRegister }: WelcomePanelProps) {
    return (
        <div className="absolute top-0 left-0 h-full w-full md:w-[450px] lg:w-1/3 z-10 flex flex-col bg-white/90 backdrop-blur-md border-r border-white/20 shadow-2xl overflow-y-auto">
            {/* Hero Section */}
            <div className="relative p-8 pb-0">
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-violet-600 via-fuchsia-500 to-orange-400"></div>

                <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 mb-2">
                    Odkryj swoje miasto <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-fuchsia-600">na nowo</span>
                </h1>
                <p className="text-lg text-gray-600 font-medium leading-relaxed">
                    Zamień zwykły spacer w wciągającą grę miejską.
                </p>
            </div>

            {/* Main Content */}
            <div className="p-8 space-y-8 flex-1">

                {/* The Idea */}
                <div className="space-y-4">
                    <div className="flex items-start gap-4">
                        <div className="p-3 bg-violet-100 rounded-xl text-violet-600">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 7m0 13V7" />
                            </svg>
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-900 text-lg">Eksploruj zakamarki</h3>
                            <p className="text-gray-600 text-sm mt-1">
                                Idea jest prosta: Twoja dzielnica jest podzielona na kwadraty. Twoim celem jest odwiedzenie ich wszystkich – nawet tych ukrytych uliczek, których nie znasz.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-start gap-4">
                        <div className="p-3 bg-fuchsia-100 rounded-xl text-fuchsia-600">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-900 text-lg">Grywalizacja</h3>
                            <p className="text-gray-600 text-sm mt-1">
                                Śledź swoje postępy, zdobywaj kolejne procenty dzielnicy i rywalizuj z samym sobą. Zobacz, jak mapa zmienia kolor na zielony!
                            </p>
                        </div>
                    </div>
                </div>

                {/* Supported Districts */}
                <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
                        Aktualnie wspierane dzielnice
                    </h4>
                    <div className="flex flex-wrap gap-2">
                        {['Oliwa', 'VII Dwór', 'Strzyża'].map((district) => (
                            <span key={district} className="px-3 py-1 bg-white border border-gray-200 rounded-full text-sm font-medium text-gray-700 shadow-sm">
                                📍 {district}
                            </span>
                        ))}
                    </div>
                    <p className="text-xs text-gray-400 mt-3 italic">
                        Więcej dzielnic już wkrótce...
                    </p>
                </div>

                {/* Pricing */}
                <div className="text-center py-2">
                    <span className="inline-block px-4 py-1 bg-green-100 text-green-700 rounded-full text-sm font-bold tracking-wide">
                        ✨ 100% ZA DARMO
                    </span>
                </div>

            </div>

            {/* Footer / CTA */}
            <div className="p-8 pt-0 mt-auto bg-gradient-to-b from-transparent to-white/50">
                <button
                    onClick={onRegister}
                    className="w-full group relative flex items-center justify-center gap-3 py-4 px-6 bg-gray-900 hover:bg-gray-800 text-white rounded-2xl font-bold text-lg shadow-xl hover:shadow-2xl transition-all transform hover:-translate-y-1 overflow-hidden"
                >
                    <span className="relative z-10">Rozpocznij przygodę</span>
                    <svg className="w-5 h-5 relative z-10 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>

                    {/* Subtle shine effect */}
                    <div className="absolute inset-0 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/10 to-transparent z-0"></div>
                </button>
                <p className="text-center text-xs text-gray-400 mt-4">
                    Nie wymagamy karty kredytowej. Wystarczy chęć do spacerowania.
                </p>
            </div>
        </div>
    );
}
