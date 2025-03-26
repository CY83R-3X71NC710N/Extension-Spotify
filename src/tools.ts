import YTMusic from 'ytmusic-api';
import { getSettings } from './settings';
import { initYTMusicClient, checkCookieExpiration } from './auth';
import { TrackViewModel, PlaylistViewModel } from './types';

export type YTMusicTool =
    'searchSongs'
    | 'playItem'
    | 'getCurrentSong'
    | 'getQueue'
    | 'getHistory'
    | 'getUserPlaylists'
    | 'getPlaylistItems'
    | 'searchArtists'
    | 'searchAlbums';

type ToolParametersSchema = Readonly<Record<string, unknown>>;
type ToolCallback = (...args: never[]) => Promise<unknown>;

interface ToolDefinition {
    name: string;
    displayName: string;
    description: string;
    parameters: object;
    action: ToolCallback;
    shouldRegister: () => Promise<boolean>;
}

interface SearchSongsParameters {
    query: string;
}

interface SearchArtistsParameters {
    query: string;
}

interface SearchAlbumsParameters {
    query: string;
}

interface PlayItemParameters {
    videoId?: string;
    playlistId?: string;
}

interface GetPlaylistItemsParameters {
    playlistId: string;
}

const TOOL_PARAMETERS: Record<YTMusicTool, ToolParametersSchema> = {
    searchSongs: Object.freeze({
        $schema: 'http://json-schema.org/draft-04/schema#',
        type: 'object',
        properties: {
            query: {
                type: 'string',
                description: 'The search query for the song.',
            },
        },
        required: ['query'],
    }),
    searchArtists: Object.freeze({
        $schema: 'http://json-schema.org/draft-04/schema#',
        type: 'object',
        properties: {
            query: {
                type: 'string',
                description: 'The search query for the artist.',
            },
        },
        required: ['query'],
    }),
    searchAlbums: Object.freeze({
        $schema: 'http://json-schema.org/draft-04/schema#',
        type: 'object',
        properties: {
            query: {
                type: 'string',
                description: 'The search query for the album.',
            },
        },
        required: ['query'],
    }),
    playItem: Object.freeze({
        $schema: 'http://json-schema.org/draft-04/schema#',
        type: 'object',
        properties: {
            videoId: {
                type: 'string',
                description: 'The video ID of the song to play. Optional if "playlistId" is provided.',
            },
            playlistId: {
                type: 'string',
                description: 'The ID of the playlist to play. Optional if "videoId" is provided.',
            },
        },
        required: [],
    }),
    getCurrentSong: Object.freeze({
        $schema: 'http://json-schema.org/draft-04/schema#',
        type: 'object',
        properties: {},
        required: [],
    }),
    getQueue: Object.freeze({
        $schema: 'http://json-schema.org/draft-04/schema#',
        type: 'object',
        properties: {},
        required: [],
    }),
    getHistory: Object.freeze({
        $schema: 'http://json-schema.org/draft-04/schema#',
        type: 'object',
        properties: {},
        required: [],
    }),
    getUserPlaylists: Object.freeze({
        $schema: 'http://json-schema.org/draft-04/schema#',
        type: 'object',
        properties: {},
        required: [],
    }),
    getPlaylistItems: Object.freeze({
        $schema: 'http://json-schema.org/draft-04/schema#',
        type: 'object',
        properties: {
            playlistId: {
                type: 'string',
                description: 'The ID of the playlist to get the songs from.',
            },
        },
        required: ['playlistId'],
    }),
};

const TOOL_CALLBACKS: Record<YTMusicTool, ToolCallback> = {
    searchSongs: searchSongsCallback,
    searchArtists: searchArtistsCallback,
    searchAlbums: searchAlbumsCallback,
    playItem: playItemCallback,
    getCurrentSong: getCurrentSongCallback,
    getQueue: getQueueCallback,
    getHistory: getHistoryCallback,
    getUserPlaylists: getUserPlaylistsCallback,
    getPlaylistItems: getPlaylistItemsCallback,
};

const TOOL_DEFINITIONS: Record<YTMusicTool, ToolDefinition> = {
    searchSongs: {
        name: 'YTMusicSearchSongs',
        displayName: 'YouTube Music: Search Songs',
        description: 'Search for songs on YouTube Music. Call when you need to find a song by name or artist.',
        parameters: TOOL_PARAMETERS.searchSongs,
        action: TOOL_CALLBACKS.searchSongs,
        shouldRegister: isToolValid,
    },
    searchArtists: {
        name: 'YTMusicSearchArtists',
        displayName: 'YouTube Music: Search Artists',
        description: 'Search for artists on YouTube Music. Call when you need to find artists by name.',
        parameters: TOOL_PARAMETERS.searchArtists,
        action: TOOL_CALLBACKS.searchArtists,
        shouldRegister: isToolValid,
    },
    searchAlbums: {
        name: 'YTMusicSearchAlbums',
        displayName: 'YouTube Music: Search Albums',
        description: 'Search for albums on YouTube Music. Call when you need to find albums by title or artist.',
        parameters: TOOL_PARAMETERS.searchAlbums,
        action: TOOL_CALLBACKS.searchAlbums,
        shouldRegister: isToolValid,
    },
    playItem: {
        name: 'YTMusicPlayItem',
        displayName: 'YouTube Music: Play Item',
        description: 'Play a song or playlist on YouTube Music. Call when the user wants to start playback.',
        parameters: TOOL_PARAMETERS.playItem,
        action: TOOL_CALLBACKS.playItem,
        shouldRegister: isToolValid,
    },
    getCurrentSong: {
        name: 'YTMusicGetCurrentSong',
        displayName: 'YouTube Music: Get Current Song',
        description: 'Gets the current song playing on YouTube Music. Call when you need to display the current song.',
        parameters: TOOL_PARAMETERS.getCurrentSong,
        action: TOOL_CALLBACKS.getCurrentSong,
        shouldRegister: isToolValid,
    },
    getQueue: {
        name: 'YTMusicGetQueue',
        displayName: 'YouTube Music: Get Queue',
        description: 'Gets the current queue of songs on YouTube Music. Call when the user wants to see their queue.',
        parameters: TOOL_PARAMETERS.getQueue,
        action: TOOL_CALLBACKS.getQueue,
        shouldRegister: isToolValid,
    },
    getHistory: {
        name: 'YTMusicGetHistory',
        displayName: 'YouTube Music: Get History',
        description: 'Gets the history of recently played songs. Call when the user wants to see their recently played tracks.',
        parameters: TOOL_PARAMETERS.getHistory,
        action: TOOL_CALLBACKS.getHistory,
        shouldRegister: isToolValid,
    },
    getUserPlaylists: {
        name: 'YTMusicGetUserPlaylists',
        displayName: 'YouTube Music: Get User Playlists',
        description: 'Gets a list of user\'s playlists on YouTube Music.',
        parameters: TOOL_PARAMETERS.getUserPlaylists,
        action: TOOL_CALLBACKS.getUserPlaylists,
        shouldRegister: isToolValid,
    },
    getPlaylistItems: {
        name: 'YTMusicGetPlaylistItems',
        displayName: 'YouTube Music: Get Playlist Items',
        description: 'Gets a list of songs in a playlist on YouTube Music.',
        parameters: TOOL_PARAMETERS.getPlaylistItems,
        action: TOOL_CALLBACKS.getPlaylistItems,
        shouldRegister: isToolValid,
    },
};

function songToViewModel(song: any): TrackViewModel {
    return {
        videoId: song.videoId,
        name: song.title,
        artist: Array.isArray(song.artists) 
            ? song.artists.map((a: any) => a.name) 
            : song.artists?.name || 'Unknown Artist',
        artistId: Array.isArray(song.artists) 
            ? song.artists.map((a: any) => a.id) 
            : song.artists?.id,
        album: song.album?.name,
        albumId: song.album?.id,
        thumbnailUrl: song.thumbnails?.[0]?.url,
        duration: song.duration,
    };
}

function playlistToViewModel(playlist: any): PlaylistViewModel {
    return {
        playlistId: playlist.playlistId,
        name: playlist.title,
        description: playlist.description,
        thumbnailUrl: playlist.thumbnails?.[0]?.url,
    };
}

async function isToolValid(): Promise<boolean> {
    const settings = getSettings();
    return !!settings.cookieData;
}

async function searchSongsCallback({ query }: SearchSongsParameters): Promise<string | TrackViewModel[]> {
    try {
        const settings = getSettings();
        if (!settings.cookieData) {
            return 'User is not authenticated with YouTube Music.';
        }

        checkCookieExpiration(settings);
        const ytMusic = await initYTMusicClient(settings);
        if (!ytMusic) {
            return 'Failed to initialize YouTube Music client.';
        }

        const results = await ytMusic.search(query, 'songs');
        return results.map(songToViewModel);
    } catch (error) {
        console.error('Error searching songs:', error);
        return 'Error searching songs. See console for details.';
    }
}

async function searchArtistsCallback({ query }: SearchArtistsParameters): Promise<string | any[]> {
    try {
        const settings = getSettings();
        if (!settings.cookieData) {
            return 'User is not authenticated with YouTube Music.';
        }

        checkCookieExpiration(settings);
        const ytMusic = await initYTMusicClient(settings);
        if (!ytMusic) {
            return 'Failed to initialize YouTube Music client.';
        }

        const results = await ytMusic.search(query, 'artists');
        return results.map((artist: any) => ({
            artistId: artist.browseId,
            name: artist.artist,
            thumbnailUrl: artist.thumbnails?.[0]?.url,
        }));
    } catch (error) {
        console.error('Error searching artists:', error);
        return 'Error searching artists. See console for details.';
    }
}

async function searchAlbumsCallback({ query }: SearchAlbumsParameters): Promise<string | any[]> {
    try {
        const settings = getSettings();
        if (!settings.cookieData) {
            return 'User is not authenticated with YouTube Music.';
        }

        checkCookieExpiration(settings);
        const ytMusic = await initYTMusicClient(settings);
        if (!ytMusic) {
            return 'Failed to initialize YouTube Music client.';
        }

        const results = await ytMusic.search(query, 'albums');
        return results.map((album: any) => ({
            albumId: album.browseId,
            name: album.title,
            artist: album.artists?.[0]?.name || 'Unknown Artist',
            artistId: album.artists?.[0]?.id,
            thumbnailUrl: album.thumbnails?.[0]?.url,
            year: album.year,
        }));
    } catch (error) {
        console.error('Error searching albums:', error);
        return 'Error searching albums. See console for details.';
    }
}

async function playItemCallback({ videoId, playlistId }: PlayItemParameters): Promise<string> {
    try {
        const settings = getSettings();
        if (!settings.cookieData) {
            return 'User is not authenticated with YouTube Music.';
        }

        if (!videoId && !playlistId) {
            return 'Either videoId or playlistId is required to play music.';
        }

        // Note: ytmusic-api doesn't directly support playback control
        // We'll instead return a URL that the user can open
        
        if (videoId) {
            return `To play this song, open: https://music.youtube.com/watch?v=${videoId}`;
        } else if (playlistId) {
            return `To play this playlist, open: https://music.youtube.com/playlist?list=${playlistId}`;
        }
        
        return 'Unable to generate a playback URL.';
    } catch (error) {
        console.error('Error with play item:', error);
        return 'Error with play item. See console for details.';
    }
}

async function getCurrentSongCallback(): Promise<string | TrackViewModel> {
    try {
        const settings = getSettings();
        if (!settings.cookieData) {
            return 'User is not authenticated with YouTube Music.';
        }

        checkCookieExpiration(settings);
        const ytMusic = await initYTMusicClient(settings);
        if (!ytMusic) {
            return 'Failed to initialize YouTube Music client.';
        }

        // ytmusic-api doesn't have a direct "now playing" method
        // We'll use history to get the most recent song as a workaround
        const history = await ytMusic.getHistory();
        if (!history || history.length === 0) {
            return 'No recent tracks in YouTube Music history.';
        }

        return songToViewModel(history[0]);
    } catch (error) {
        console.error('Error getting current song:', error);
        return 'Error getting current song. See console for details.';
    }
}

async function getQueueCallback(): Promise<string | TrackViewModel[]> {
    try {
        const settings = getSettings();
        if (!settings.cookieData) {
            return 'User is not authenticated with YouTube Music.';
        }

        checkCookieExpiration(settings);
        const ytMusic = await initYTMusicClient(settings);
        if (!ytMusic) {
            return 'Failed to initialize YouTube Music client.';
        }

        // ytmusic-api doesn't have a direct queue access method
        // Returning a message explaining this limitation
        return 'The YouTube Music API does not provide access to the current queue. You can view your queue directly in the YouTube Music app or website.';
    } catch (error) {
        console.error('Error getting queue:', error);
        return 'Error getting queue. See console for details.';
    }
}

async function getHistoryCallback(): Promise<string | TrackViewModel[]> {
    try {
        const settings = getSettings();
        if (!settings.cookieData) {
            return 'User is not authenticated with YouTube Music.';
        }

        checkCookieExpiration(settings);
        const ytMusic = await initYTMusicClient(settings);
        if (!ytMusic) {
            return 'Failed to initialize YouTube Music client.';
        }

        const history = await ytMusic.getHistory();
        return history.map(songToViewModel);
    } catch (error) {
        console.error('Error getting history:', error);
        return 'Error getting history. See console for details.';
    }
}

async function getUserPlaylistsCallback(): Promise<string | PlaylistViewModel[]> {
    try {
        const settings = getSettings();
        if (!settings.cookieData) {
            return 'User is not authenticated with YouTube Music.';
        }

        checkCookieExpiration(settings);
        const ytMusic = await initYTMusicClient(settings);
        if (!ytMusic) {
            return 'Failed to initialize YouTube Music client.';
        }

        const playlists = await ytMusic.getLibraryPlaylists();
        return playlists.map(playlistToViewModel);
    } catch (error) {
        console.error('Error getting playlists:', error);
        return 'Error getting playlists. See console for details.';
    }
}

async function getPlaylistItemsCallback({ playlistId }: GetPlaylistItemsParameters): Promise<string | TrackViewModel[]> {
    try {
        const settings = getSettings();
        if (!settings.cookieData) {
            return 'User is not authenticated with YouTube Music.';
        }

        if (!playlistId) {
            return 'Playlist ID is required.';
        }

        checkCookieExpiration(settings);
        const ytMusic = await initYTMusicClient(settings);
        if (!ytMusic) {
            return 'Failed to initialize YouTube Music client.';
        }

        const playlistItems = await ytMusic.getPlaylist(playlistId);
        if (!playlistItems || !playlistItems.tracks) {
            return 'Playlist not found or empty.';
        }

        return playlistItems.tracks.map(songToViewModel);
    } catch (error) {
        console.error('Error getting playlist items:', error);
        return 'Error getting playlist items. See console for details.';
    }
}

export function syncFunctionTools(): void {
    const context = SillyTavern.getContext();
    const settings = getSettings();
    
    for (const [key, definition] of Object.entries(TOOL_DEFINITIONS)) {
        if (settings[key as YTMusicTool]) {
            context.registerFunctionTool(definition);
        } else {
            context.unregisterFunctionTool(definition.name);
        }
    }
}
