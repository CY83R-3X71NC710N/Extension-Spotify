import { SpotifyApi, Track, Episode } from '@spotify/web-api-ts-sdk';
import { sha256, generateRandomString, base64encode } from './util';
import { InjectionPosition, VERIFIER_KEY, INJECT_ID, SPOTIFY_SCOPES } from './constants';
import { ControlPlaybackParameters, GetTopTrackParameters, SearchTracksParameters, TOOL_PARAMETERS, ToolDefinition } from './tools';
import { ExtensionSettings, getSettings } from './settings';
import { TimeRange, TrackViewModel } from './types';

import html from './settings.html';
import './style.css';

const {
    saveSettingsDebounced,
    setExtensionPrompt,
    substituteParamsExtended,
    registerFunctionTool,
    unregisterFunctionTool,
    t,
} = SillyTavern.getContext();

function addSettingsControls(settings: ExtensionSettings): void {
    const settingsContainer = document.getElementById('spotify_container') ?? document.getElementById('extensions_settings2');
    if (!settingsContainer) {
        return;
    }

    const renderer = document.createElement('template');
    renderer.innerHTML = html;

    settingsContainer.appendChild(renderer.content);

    // Setup UI elements
    const elements = {
        clientId: document.getElementById('spotify_client_id') as HTMLInputElement,
        template: document.getElementById('spotify_template') as HTMLTextAreaElement,
        role: document.getElementById('spotify_role') as HTMLSelectElement,
        position: Array.from(document.getElementsByName('spotify_position')) as HTMLInputElement[],
        depth: document.getElementById('spotify_depth') as HTMLInputElement,
        scan: document.getElementById('spotify_scan') as HTMLInputElement,
        authButton: document.getElementById('spotify_auth') as HTMLDivElement,
        logoutButton: document.getElementById('spotify_logout') as HTMLDivElement,
        tools: {
            searchTracks: document.getElementById('spotify_tool_search_tracks') as HTMLInputElement,
            controlPlayback: document.getElementById('spotify_tool_control_playback') as HTMLInputElement,
            getTopTracks: document.getElementById('spotify_tool_get_top_tracks') as HTMLInputElement,
            getPlaylists: document.getElementById('spotify_tool_get_playlists') as HTMLInputElement,
        },
    };

    // Initialize UI with current settings
    elements.clientId.value = settings.clientId;
    elements.template.value = settings.template;
    elements.role.value = settings.role.toString();
    elements.position.forEach((radio) => {
        radio.checked = settings.position === parseInt(radio.value);
    });
    elements.depth.value = settings.depth.toString();
    elements.scan.checked = settings.scan;
    elements.tools.searchTracks.checked = settings.searchTracks;
    elements.tools.controlPlayback.checked = settings.controlPlayback;
    elements.tools.getTopTracks.checked = settings.getTopTracks;
    elements.tools.getPlaylists.checked = settings.getPlaylists;

    // Define a generic handler for simple input changes
    const handleInputChange = <T extends HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
        element: T,
        settingKey: keyof ExtensionSettings,
        transform?: (value: string | boolean) => any,
        callback?: () => void,
    ) => {
        element.addEventListener('input', () => {
            const value = element instanceof HTMLInputElement && element.type === 'checkbox'
                ? element.checked
                : element.value;
            settings[settingKey] = transform ? transform(value) : value;
            if (callback) {
                callback();
            }
            saveSettingsDebounced();
        });
    };

    // Set up event listeners
    handleInputChange(elements.clientId, 'clientId', value => value);
    handleInputChange(elements.template, 'template', value => value, resetInject);
    handleInputChange(elements.role, 'role', value => parseInt(value as string), resetInject);
    handleInputChange(elements.depth, 'depth', value => parseInt(value as string), resetInject);
    handleInputChange(elements.scan, 'scan', value => value, resetInject);
    handleInputChange(elements.tools.searchTracks, 'searchTracks', value => value, syncFunctionTools);
    handleInputChange(elements.tools.controlPlayback, 'controlPlayback', value => value, syncFunctionTools);
    handleInputChange(elements.tools.getTopTracks, 'getTopTracks', value => value, syncFunctionTools);
    handleInputChange(elements.tools.getPlaylists, 'getPlaylists', value => value, syncFunctionTools);

    // Handle radio buttons separately
    elements.position.forEach((radio) => {
        radio.addEventListener('input', (e) => {
            settings.position = parseInt((e.target as HTMLInputElement).value);
            saveSettingsDebounced();
        });
    });

    // Auth buttons
    elements.authButton.addEventListener('click', () => {
        authenticateSpotify();
    });

    elements.logoutButton.addEventListener('click', () => {
        settings.clientToken = null;
        setUserName(t`[Not logged in]`);
        saveSettingsDebounced();
    });
}

function setUserName(name: string): void {
    const userName = document.getElementById('spotify_user_name') as HTMLSpanElement;
    if (userName) {
        userName.innerText = name;
    }
}

async function authenticateSpotify(): Promise<void> {
    const settings = getSettings();

    if (!settings.clientId) {
        toastr.error(t`Please enter your Spotify Client ID in the settings.`);
        return;
    }

    const codeVerifier = generateRandomString(64);
    const hashed = await sha256(codeVerifier);
    const codeChallenge = base64encode(hashed);
    const redirectUri = new URL('/callback/spotify', location.origin);
    const params = {
        response_type: 'code',
        client_id: settings.clientId,
        scope: SPOTIFY_SCOPES.join(' '),
        redirect_uri: redirectUri.toString(),
        code_challenge_method: 'S256',
        code_challenge: codeChallenge,
    };

    sessionStorage.setItem(VERIFIER_KEY, codeVerifier);
    const authUrl = new URL('https://accounts.spotify.com/authorize');
    authUrl.search = new URLSearchParams(params).toString();
    window.location.href = authUrl.toString();
}

function readCode(): string | null {
    const urlParams = new URLSearchParams(window.location.search);
    const source = urlParams.get('source');
    if (source !== 'spotify') {
        return null;
    }
    const query = urlParams.get('query');
    if (query) {
        const params = new URLSearchParams(query);
        const code = params.get('code');
        window.history.replaceState({}, document.title, window.location.pathname);
        return code;
    }
    return null;
}

async function tryGetClientToken(settings: ExtensionSettings): Promise<void> {
    const code = readCode();
    const codeVerifier = sessionStorage.getItem(VERIFIER_KEY);
    if (!code || !codeVerifier || !settings.clientId) {
        return;
    }

    const url = 'https://accounts.spotify.com/api/token';
    const redirectUri = new URL('/callback/spotify', window.location.origin);
    const payload = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
            client_id: settings.clientId,
            grant_type: 'authorization_code',
            redirect_uri: redirectUri.toString(),
            code_verifier: codeVerifier,
            code,
        }),
    };

    try {
        const body = await fetch(url, payload);
        const token = await body.json();

        settings.clientToken = token;
        sessionStorage.removeItem(VERIFIER_KEY);
        saveSettingsDebounced();

        console.log('Spotify token received:', token);
        toastr.success(t`Successfully authenticated with Spotify!`);
    } catch (error) {
        console.error('Error during Spotify authentication:', error);
        toastr.error(t`Spotify authentication failed. Please try again.`);
    }
}

async function tryReadClientData(settings: ExtensionSettings): Promise<void> {
    if (!settings.clientToken || !settings.clientId) {
        setUserName(t`[Not logged in]`);
        return;
    }

    try {
        const api = SpotifyApi.withAccessToken(settings.clientId, settings.clientToken);
        const user = await api.currentUser.profile();
        setUserName(user.display_name || user.id);
    } catch (error) {
        console.error('Error fetching user data:', error);
        settings.clientToken = null;
        setUserName('[Token expired]');
    }
}

async function refreshTokenIfNeeded(settings: ExtensionSettings): Promise<void> {
    if (!settings.clientToken || !settings.clientId) {
        return;
    }

    const tokenExpiration = settings.clientToken.expires;
    const refreshToken = settings.clientToken.refresh_token;
    const currentTime = Date.now();
    const refreshThreshold = 5 * 60 * 1000; // 5 minutes

    if (tokenExpiration && (tokenExpiration - currentTime) < refreshThreshold) {
        const url = 'https://accounts.spotify.com/api/token';
        const payload = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                grant_type: 'refresh_token',
                refresh_token: refreshToken,
                client_id: settings.clientId,
            }),
        };

        try {
            const body = await fetch(url, payload);
            const token = await body.json();
            settings.clientToken = token;
            // When a refresh token is not returned, continue using the existing token.
            if (settings.clientToken && !token.refresh_token) {
                settings.clientToken.refresh_token = refreshToken;
            }
            console.log('Spotify token refreshed:', token);
            saveSettingsDebounced();
        } catch (error) {
            console.error('Error refreshing Spotify token:', error);
        }
    }
}

function resetInject() {
    // Reset the prompt to avoid showing old data
    setExtensionPrompt(INJECT_ID, '', InjectionPosition.None, 0);
}

async function setCurrentTrack(): Promise<void> {
    resetInject();

    const settings = getSettings();
    if (!settings.clientToken || !settings.clientId || !settings.template) {
        return;
    }

    try {
        await refreshTokenIfNeeded(settings);
        const api = SpotifyApi.withAccessToken(settings.clientId, settings.clientToken);
        const currentlyPlaying = await api.player.getCurrentlyPlayingTrack();
        console.log('Currently playing Spotify track:', currentlyPlaying);
        const params = getPromptParams(currentlyPlaying.item);
        const message = substituteParamsExtended(settings.template, params);
        setExtensionPrompt(INJECT_ID, message, settings.position, settings.depth, settings.scan, settings.role);
    } catch (error) {
        console.error('Error fetching currently playing track:', error);
    }
}

function getPromptParams(value: Track | Episode): Record<string, string> {
    if (!value) {
        return {};
    }
    switch (value.type) {
        case 'track': {
            const track = value as Track;
            return {
                song: track.name,
                artist: track.artists.map(a => a.name)?.join(', '),
                album: track.album.name,
                year: track.album.release_date.split('-')[0],
            };
        };
        case 'show': {
            const episode = value as Episode;
            return {
                song: episode.name,
                artist: episode.show.name,
            };
        };
    }
    return {};
}

function trackToViewModel(track: Track): TrackViewModel {
    return {
        uri: track.uri,
        name: track.name,
        artist: track.artists.map(a => a.name)?.join(', '),
        album: track.album.name,
    };
}

export const TOOL_DEFINITIONS: { [key: string]: ToolDefinition } = {
    searchTracks: {
        name: 'SpotifySearchTracks',
        displayName: 'Spotify: Search Tracks',
        description: 'Search for tracks on Spotify. Call when you need to find a URI for a track.',
        parameters: TOOL_PARAMETERS.searchTracks,
        shouldRegister: () => {
            const settings = getSettings();
            return Promise.resolve(!!(settings.clientToken && settings.clientId));
        },
        action: async ({ query }: SearchTracksParameters) => {
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
                return 'Error searching tracks.';
            }
        },
    },
    controlPlayback: {
        name: 'SpotifyControlPlayback',
        displayName: 'Spotify: Control Playback',
        description: 'Control playback on Spotify. Call when the user wants to play, pause, skip or seek a track.',
        parameters: TOOL_PARAMETERS.controlPlayback,
        shouldRegister: () => {
            const settings = getSettings();
            return Promise.resolve(!!(settings.clientToken && settings.clientId));
        },
        action: async ({ action, uri }: ControlPlaybackParameters) => {
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
                        if (!uri) {
                            return 'URI is required for play action.';
                        }
                        if (!activeDevice?.id) {
                            return 'No active device found.';
                        }
                        await api.player.startResumePlayback(activeDevice.id, void 0, [uri]);
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
                return 'Error controlling playback.';
            }
        },
    },
    getTopTracks: {
        name: 'SpotifyGetTopTracks',
        displayName: 'Spotify: Get Top Tracks',
        description: 'Gets a list of user\'s top tracks. Call when the user wants to see their top tracks, play a favorite track, etc.',
        parameters: TOOL_PARAMETERS.getTopTracks,
        shouldRegister: () => {
            const settings = getSettings();
            return Promise.resolve(!!(settings.clientToken && settings.clientId));
        },
        action: async ({ timeRange }: GetTopTrackParameters) => {
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
                return 'Error fetching top tracks.';
            }
        },
    },
    getPlaylists: {
        name: 'SpotifyGetPlaylists',
        displayName: 'Spotify: Get Playlists',
        description: 'Gets a list of user\'s playlists. Call when the user wants to see their playlists.',
        parameters: TOOL_PARAMETERS.getPlaylists,
        shouldRegister: () => {
            const settings = getSettings();
            return Promise.resolve(!!(settings.clientToken && settings.clientId));
        },
        action: async () => {
            try {
                const settings = getSettings();
                if (!settings.clientToken || !settings.clientId) {
                    return 'User is not authenticated with Spotify.';
                }
                await refreshTokenIfNeeded(settings);
                const api = SpotifyApi.withAccessToken(settings.clientId, settings.clientToken);
                const result = await api.currentUser.playlists.playlists();
                const playlists = result.items.map(p => ({ uri: p.uri, name: p.name, description: p.description }));
                return playlists;
            } catch (error) {
                console.error('Error fetching playlists:', error);
                return 'Error fetching playlists.';
            }
        },
    },
};

function syncFunctionTools(): void {
    const settings = getSettings();
    for (const [key, definition] of Object.entries(TOOL_DEFINITIONS)) {
        if (settings[key]) {
            registerFunctionTool(definition);
        } else {
            unregisterFunctionTool(key);
        }
    }
}

(async function () {
    const settings = getSettings();
    addSettingsControls(settings);
    await tryGetClientToken(settings);
    await refreshTokenIfNeeded(settings);
    await tryReadClientData(settings);
    globalThis.spotify_setCurrentTrack = setCurrentTrack;
    syncFunctionTools();
    saveSettingsDebounced();
})();
