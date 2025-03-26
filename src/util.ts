/**
 * Utility functions for YouTube Music extension
 */

export function generateRandomString(length: number): string {
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const values = crypto.getRandomValues(new Uint8Array(length));
    return Array.from(values)
        .map(x => possible[x % possible.length])
        .join('');
}

/**
 * Formats a video URL or ID into a standard YouTube Music videoId format
 * @param input Video URL or ID
 * @returns Normalized videoId or null if invalid
 */
export function normalizeVideoId(input: string): string | null {
    if (!input) return null;
    
    // If it's already a valid video ID (typically 11 characters)
    if (/^[A-Za-z0-9_-]{11}$/.test(input)) {
        return input;
    }
    
    // Extract from YouTube/YouTube Music URLs
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|music\.youtube\.com\/watch\?v=)([A-Za-z0-9_-]{11})/,
        /(?:youtube\.com|music\.youtube\.com)\/.*[?&]v=([A-Za-z0-9_-]{11})/
    ];
    
    for (const pattern of patterns) {
        const match = input.match(pattern);
        if (match && match[1]) {
            return match[1];
        }
    }
    
    return null;
}

/**
 * Formats a playlist URL or ID into a standard YouTube Music playlistId format
 * @param input Playlist URL or ID
 * @returns Normalized playlistId or null if invalid
 */
export function normalizePlaylistId(input: string): string | null {
    if (!input) return null;
    
    // If it's already a valid playlist ID
    if (/^[A-Za-z0-9_-]{34}$/.test(input) || /^PL[A-Za-z0-9_-]{32}$/.test(input) || /^RD[A-Za-z0-9_-]{32}$/.test(input) || /^OL[A-Za-z0-9_-]{32}$/.test(input)) {
        return input;
    }
    
    // Extract from YouTube/YouTube Music playlist URLs
    const playlistPattern = /(?:youtube\.com|music\.youtube\.com)\/.*[?&]list=([A-Za-z0-9_-]{34}|PL[A-Za-z0-9_-]{32}|RD[A-Za-z0-9_-]{32}|OL[A-Za-z0-9_-]{32})/;
    const match = input.match(playlistPattern);
    
    if (match && match[1]) {
        return match[1];
    }
    
    return null;
}

// Common configuration for JSON parsing with more relaxed rules
export const laxJsonConfig = {
    transformResponse: [(data: string) => {
        try {
            return JSON.parse(data);
        } catch (e) {
            // Some YouTube Music API responses might be malformed JSON
            // Try to clean it up and parse
            const cleaned = data
                .replace(/,\s*}/g, '}')
                .replace(/,\s*]/g, ']');
            return JSON.parse(cleaned);
        }
    }]
};
