import { SpotifyApi, Track, SimplifiedPlaylist } from '@spotify/web-api-ts-sdk';
import { getSettings } from './settings';
import { refreshTokenIfNeeded } from './auth';
import { TrackViewModel, PlaylistViewModel, TimeRange } from './types';

type SpotifyTool = 'searchTracks' | 'controlPlayback' | 'getCurrentTrack' | 'getTopTracks' | 'getRecentTracks' | 'getPlaylists' | 'getPlaylistTracks';
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

interface SearchTracksParameters {
    query: string;
}

interface ControlPlaybackParameters {
    action: string;
    uri?: string;
    contextUri?: string;
}

interface GetTopTrackParameters {
    timeRange: string;
}

interface GetPlaylistTracksParameters {
    playlistUri: string;
}

const TOOL_PARAMETERS: Record<SpotifyTool, ToolParametersSchema> = {
    searchTracks: Object.freeze({
        $schema: 'http://json-schema.org/draft-04/schema#',
        type: 'object',
        properties: {
            query: {
                type: 'string',
                description: 'The search query for the track.',
            },
        },
        required: ['query'],
    }),
    controlPlayback: Object.freeze({
        $schema: 'http://json-schema.org/draft-04/schema#',
        type: 'object',
        properties: {
            action: {
                type: 'string',
                description: 'The action to perform on the track. Possible values are: play, pause, resume, next, previous.',
            },
            uri: {
                type: 'string',
                description: '"play" action only. The URI of the track to perform the action on. Optional if playing a playlist or album.',
            },
            contextUri: {
                type: 'string',
                description: '"play" action only. The URI of the album, artist, or playlist to perform the action on. Optional if playing a single track.',
            },
        },
        required: ['action'],
    }),
    getCurrentTrack: Object.freeze({
        $schema: 'http://json-schema.org/draft-04/schema#',
        type: 'object',
        properties: {},
        required: [],
    }),
    getTopTracks: Object.freeze({
        $schema: 'http://json-schema.org/draft-04/schema#',
        type: 'object',
        properties: {
            timeRange: {
                type: 'string',
                description: 'The time range for the top tracks. Possible values are: short_term, medium_term, long_term. Default is short_term.',
            },
        },
        required: [],
    }),
    getRecentTracks: Object.freeze({
        $schema: 'http://json-schema.org/draft-04/schema#',
        type: 'object',
        properties: {},
        required: [],
    }),
    getPlaylists: Object.freeze({
        $schema: 'http://json-schema.org/draft-04/schema#',
        type: 'object',
        properties: {},
        required: [],
    }),
    getPlaylistTracks: Object.freeze({
        $schema: 'http://json-schema.org/draft-04/schema#',
        type: 'object',
        properties: {
            playlistUri: {
                type: 'string',
                description: 'The URI of the playlist to get the tracks from.',
            },
        },
        required: ['playlistUri'],
    }),
};

const TOOL_CALLBACKS: Record<SpotifyTool, ToolCallback> = {
    searchTracks: searchTracksCallback,
    controlPlayback: controlPlaybackCallback,
    getCurrentTrack: getCurrentTrackCallback,
    getTopTracks: getTopTracksCallback,
    getRecentTracks: getRecentTracksCallback,
    getPlaylists: getPlaylistsCallback,
    getPlaylistTracks: getPlaylistTracksCallback,
};

const TOOL_DEFINITIONS: Record<SpotifyTool, ToolDefinition> = {
    searchTracks: {
        name: 'SpotifySearchTracks',
        displayName: 'Spotify: Search Tracks',
        description: 'Search for tracks on Spotify. Call when you need to find a URI for a track.',
        parameters: TOOL_PARAMETERS.searchTracks,
        action: TOOL_CALLBACKS.searchTracks,
        shouldRegister: isToolValid,
    },
    controlPlayback: {
        name: 'SpotifyControlPlayback',
        displayName: 'Spotify: Control Playback',
        description: 'Control playback on Spotify. Call when the user wants to play, pause, skip or seek a track.',
        parameters: TOOL_PARAMETERS.controlPlayback,
        action: TOOL_CALLBACKS.controlPlayback,
        shouldRegister: isToolValid,
    },
    getCurrentTrack: {
        name: 'SpotifyGetCurrentTrack',
        displayName: 'Spotify: Get Current Track',
        description: 'Gets the current track playing on Spotify. Call when you need to display the current track.',
        parameters: TOOL_PARAMETERS.getCurrentTrack,
        action: TOOL_CALLBACKS.getCurrentTrack,
        shouldRegister: isToolValid,
    },
    getTopTracks: {
        name: 'SpotifyGetTopTracks',
        displayName: 'Spotify: Get Top Tracks',
        description: 'Gets a list of user\'s top tracks. Call when the user wants to see their top tracks, play a favorite track, asks for recommendations, etc.',
        parameters: TOOL_PARAMETERS.getTopTracks,
        action: TOOL_CALLBACKS.getTopTracks,
        shouldRegister: isToolValid,
    },
    getRecentTracks: {
        name: 'SpotifyGetRecentTracks',
        displayName: 'Spotify: Get Recent Tracks',
        description: 'Gets a list of user\'s recently played tracks. Call when the user wants to see their recent tracks.',
        parameters: TOOL_PARAMETERS.getRecentTracks,
        action: TOOL_CALLBACKS.getRecentTracks,
        shouldRegister: isToolValid,
    },
    getPlaylists: {
        name: 'SpotifyGetPlaylists',
        displayName: 'Spotify: Get Playlists',
        description: 'Gets a list of user\'s playlists. Call when the user wants to see their playlists.',
        parameters: TOOL_PARAMETERS.getPlaylists,
        action: TOOL_CALLBACKS.getPlaylists,
        shouldRegister: isToolValid,
    },
    getPlaylistTracks: {
        name: 'SpotifyGetPlaylistTracks',
        displayName: 'Spotify: Get Playlist Tracks',
        description: 'Gets a list of tracks in a playlist. Call when you need to see the tracks in a playlist.',
        parameters: TOOL_PARAMETERS.getPlaylistTracks,
        action: TOOL_CALLBACKS.getPlaylistTracks,
        shouldRegister: isToolValid,
    },
};

function trackToViewModel(track: Track): TrackViewModel {
    return {
        uri: track.uri,
        name: track.name,
        artist: track.artists.length === 1 ? track.artists[0].name : track.artists.map(a => a.name),
        artist_uri: track.artists.length === 1 ? track.artists[0].uri : track.artists.map(a => a.uri),
        album: track.album.name,
        album_uri: track.album.uri,
        release_date: track.album.release_date,
        genres: track.album.genres,
    };
}

function playlistToViewModel(playlist: SimplifiedPlaylist): PlaylistViewModel {
    return {
        uri: playlist.uri,
        name: playlist.name,
        description: playlist.description,
    };
}

async function isToolValid(): Promise<boolean> {
    const settings = getSettings();
    return !!(settings.clientToken && settings.clientId);
}

async function searchTracksCallback({ query }: SearchTracksParameters): Promise<string | TrackViewModel[]> {
    try {
        const settings = getSettings();
        if (!settings.clientToken || !settings.clientId) {
            return 'User is not authenticated with Spotify.';
        }
        await refreshTokenIfNeeded(settings);
        const api = SpotifyApi.withAccessToken(settings.clientId, settings.clientToken);
        const result = await api.search(query, ['track']);
        const tracks = result.tracks.items.map(trackToViewModel);
        return tracks;
    } catch (error) {
        console.error('Error searching tracks:', error);
        return 'Error searching tracks. See console for details.';
    }
}

async function controlPlaybackCallback({ action, uri, contextUri }: ControlPlaybackParameters): Promise<string> {
    try {
        const settings = getSettings();
        if (!settings.clientToken || !settings.clientId) {
            return 'User is not authenticated with Spotify.';
        }
        await refreshTokenIfNeeded(settings);
        const api = SpotifyApi.withAccessToken(settings.clientId, settings.clientToken);
        const device = await api.player.getAvailableDevices();
        const activeDevice = device.devices.find(d => d.is_active);
        switch (action) {
            case 'play': {
                if (!uri && !contextUri) {
                    return 'URI or context URI is required for play action.';
                }
                if (!activeDevice?.id) {
                    return 'No active device found.';
                }
                const uris = uri ? [uri] : void 0;
                await api.player.startResumePlayback(activeDevice.id, contextUri, uris);
                return 'Playing track: ' + uri;
            }
            case 'pause': {
                if (!activeDevice?.id) {
                    return 'No active device found.';
                }
                await api.player.pausePlayback(activeDevice.id);
                return 'Paused playback on device: ' + activeDevice?.name;
            }
            case 'resume': {
                if (!activeDevice?.id) {
                    return 'No active device found.';
                }
                await api.player.startResumePlayback(activeDevice.id);
                return 'Resumed playback on device: ' + activeDevice?.name;
            }
            case 'next': {
                if (!activeDevice?.id) {
                    return 'No active device found.';
                }
                await api.player.skipToNext(activeDevice.id);
                return 'Skipped to next track on device: ' + activeDevice?.name;
            }
            case 'previous': {
                if (!activeDevice?.id) {
                    return 'No active device found.';
                }
                await api.player.skipToPrevious(activeDevice.id);
                return 'Skipped to previous track on device: ' + activeDevice?.name;
            }
            default:
                return 'Unknown action: ' + action;
        }
    } catch (error) {
        console.error('Error controlling playback:', error);
        return 'Error controlling playback. See console for details.';
    }
}

async function getCurrentTrackCallback(): Promise<string | TrackViewModel> {
    try {
        const settings = getSettings();
        if (!settings.clientToken || !settings.clientId) {
            return 'User is not authenticated with Spotify.';
        }
        await refreshTokenIfNeeded(settings);
        const api = SpotifyApi.withAccessToken(settings.clientId, settings.clientToken);
        const currentlyPlaying = await api.player.getCurrentlyPlayingTrack();
        const track = currentlyPlaying.item.type === 'track' ? currentlyPlaying.item as Track : null;
        if (!track) {
            return 'No track currently playing.';
        }
        return trackToViewModel(track);
    }
    catch (error) {
        console.error('Error fetching current track:', error);
        return 'Error fetching current track. See console for details.';
    }
}

async function getTopTracksCallback({ timeRange }: GetTopTrackParameters): Promise<string | TrackViewModel[]> {
    try {
        const settings = getSettings();
        if (!settings.clientToken || !settings.clientId) {
            return 'User is not authenticated with Spotify.';
        }
        await refreshTokenIfNeeded(settings);
        const api = SpotifyApi.withAccessToken(settings.clientId, settings.clientToken);
        if (!['short_term', 'medium_term', 'long_term'].includes(timeRange)) {
            timeRange = 'short_term';
        }
        const result = await api.currentUser.topItems('tracks', timeRange as TimeRange);
        const topTracks = result.items.map(trackToViewModel);
        return topTracks;
    } catch (error) {
        console.error('Error fetching top tracks:', error);
        return 'Error fetching top tracks. See console for details.';
    }
}

async function getRecentTracksCallback(): Promise<string | TrackViewModel[]> {
    try {
        const settings = getSettings();
        if (!settings.clientToken || !settings.clientId) {
            return 'User is not authenticated with Spotify.';
        }
        await refreshTokenIfNeeded(settings);
        const api = SpotifyApi.withAccessToken(settings.clientId, settings.clientToken);
        const result = await api.player.getRecentlyPlayedTracks();
        const tracks = result.items.map(i => trackToViewModel(i.track));
        return tracks;
    }
    catch (error) {
        console.error('Error fetching recent tracks:', error);
        return 'Error fetching recent tracks. See console for details.';
    }
}

async function getPlaylistsCallback(): Promise<string | PlaylistViewModel[]> {
    try {
        const settings = getSettings();
        if (!settings.clientToken || !settings.clientId) {
            return 'User is not authenticated with Spotify.';
        }
        await refreshTokenIfNeeded(settings);
        const api = SpotifyApi.withAccessToken(settings.clientId, settings.clientToken);
        const result = await api.currentUser.playlists.playlists();
        const playlists = result.items.map(playlistToViewModel);
        return playlists;
    } catch (error) {
        console.error('Error fetching playlists:', error);
        return 'Error fetching playlists. See console for details.';
    }
}

async function getPlaylistTracksCallback({ playlistUri }: GetPlaylistTracksParameters) {
    try {
        const settings = getSettings();
        if (!settings.clientToken || !settings.clientId) {
            return 'User is not authenticated with Spotify.';
        }
        await refreshTokenIfNeeded(settings);
        const api = SpotifyApi.withAccessToken(settings.clientId, settings.clientToken);
        const result = await api.playlists.getPlaylistItems(playlistUri);
        const tracks = result.items.map(i => trackToViewModel(i.track));
        return tracks;
    } catch (error) {
        console.error('Error fetching playlist tracks:', error);
        return 'Error fetching playlist tracks. See console for details.';
    }
}

export function syncFunctionTools(): void {
    const context = SillyTavern.getContext();
    const settings = getSettings();
    for (const [key, definition] of Object.entries(TOOL_DEFINITIONS)) {
        if (settings[key]) {
            context.registerFunctionTool(definition);
        } else {
            context.unregisterFunctionTool(key);
        }
    }
}
