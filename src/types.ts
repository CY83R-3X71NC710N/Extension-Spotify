export interface TrackViewModel {
    videoId: string;
    name: string;
    artist: string | string[];
    artistId?: string | string[];
    album?: string;
    albumId?: string;
    thumbnailUrl?: string;
    duration?: string;
}

export interface PlaylistViewModel {
    playlistId: string;
    name: string;
    description?: string;
    thumbnailUrl?: string;
}

export interface YTMusicCookies {
    cookie: string;
    expires?: number;
}

export type TimeRange = 'short_term' | 'medium_term' | 'long_term';
