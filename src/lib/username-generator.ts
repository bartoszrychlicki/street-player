// Generator losowych pseudonimów z polskich słów

const adjectives = [
    'Szybki', 'Wolny', 'Dziki', 'Spokojny', 'Mądry', 'Wesoły', 'Cichy', 'Głośny',
    'Silny', 'Zwinny', 'Odważny', 'Tajemniczy', 'Złoty', 'Srebrny', 'Nocny', 'Dzienny',
    'Górski', 'Morski', 'Leśny', 'Miejski', 'Zimowy', 'Letni', 'Wiosenny', 'Jesienny',
    'Błękitny', 'Zielony', 'Czerwony', 'Biały', 'Czarny', 'Szary', 'Bursztynowy',
    'Skryty', 'Jawny', 'Stary', 'Młody', 'Wielki', 'Mały', 'Długi', 'Krótki',
    'Szeroki', 'Wąski', 'Wysoki', 'Niski', 'Głęboki', 'Płytki', 'Jasny', 'Ciemny'
];

const nouns = [
    'Wędrowiec', 'Odkrywca', 'Podróżnik', 'Spacerowicz', 'Biegacz', 'Turysta',
    'Pielgrzym', 'Włóczęga', 'Nomada', 'Tropiciel', 'Zwiadowca', 'Pionier',
    'Rycerz', 'Wojownik', 'Strażnik', 'Obrońca', 'Łowca', 'Myśliwy',
    'Sokół', 'Orzeł', 'Wilk', 'Lis', 'Niedźwiedź', 'Ryś', 'Jeleń', 'Żubr',
    'Smok', 'Feniks', 'Gryf', 'Mistrz', 'Bohater', 'Legenda', 'Czempion',
    'Wicher', 'Błysk', 'Grom', 'Mróz', 'Płomień', 'Cień', 'Duch', 'Widmo',
    'Skoczek', 'Tancerz', 'Artysta', 'Poeta', 'Marzyciel', 'Wizjoner'
];

/**
 * Generates a random Polish username by combining an adjective and a noun
 * @returns A random username like "SzybkiWędrowiec" or "TajemniczyOrzeł"
 */
export function generateUsername(): string {
    const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    const number = Math.floor(Math.random() * 100); // Optional number suffix

    // 70% chance to add number, 30% without
    if (Math.random() < 0.3) {
        return `${adjective}${noun}`;
    }

    return `${adjective}${noun}${number}`;
}

/**
 * Validates username - must be 3-20 characters, alphanumeric + Polish characters
 */
export function validateUsername(username: string): { valid: boolean; error?: string } {
    if (!username || username.trim().length === 0) {
        return { valid: false, error: 'Pseudonim nie może być pusty' };
    }

    if (username.length < 3) {
        return { valid: false, error: 'Pseudonim musi mieć co najmniej 3 znaki' };
    }

    if (username.length > 20) {
        return { valid: false, error: 'Pseudonim może mieć maksymalnie 20 znaków' };
    }

    // Allow Polish characters, letters, numbers
    const validPattern = /^[a-zA-ZąćęłńóśźżĄĆĘŁŃÓŚŹŻ0-9]+$/;
    if (!validPattern.test(username)) {
        return { valid: false, error: 'Pseudonim może zawierać tylko litery i cyfry' };
    }

    return { valid: true };
}
