import { SpotifyApi, AccessToken, Track, Episode } from '@spotify/web-api-ts-sdk';
import { sha256, generateRandomString, base64encode } from './util';
import { InjectionPosition, InjectionRole, VERIFIER_KEY, MODULE_NAME, INJECT_ID } from './constants';
import html from './settings.html';

const {
    extensionSettings,
    saveSettingsDebounced,
    setExtensionPrompt,
    substituteParamsExtended,
} = globalThis.SillyTavern.getContext();

interface ExtensionSettings {
    clientId: string;
    clientToken: AccessToken | null;
    template: string;
    position: InjectionPosition;
    role: InjectionRole;
    depth: number;
    [key: string]: any; // Allow additional properties
}

// Define default settings
const defaultSettings: Readonly<ExtensionSettings> = Object.freeze({
    clientId: '',
    clientToken: null,
    template: '[{{user}} is listening to {{song}} by {{artist}} on Spotify]',
    position: InjectionPosition.InChat,
    role: InjectionRole.System,
    depth: 1,
});

// Define a function to get or initialize settings
function getSettings(): ExtensionSettings {
    // Initialize settings if they don't exist
    if (!extensionSettings[MODULE_NAME]) {
        extensionSettings[MODULE_NAME] = structuredClone(defaultSettings);
    }

    // Ensure all default keys exist (helpful after updates)
    for (const key in defaultSettings) {
        if (extensionSettings[MODULE_NAME][key] === undefined) {
            extensionSettings[MODULE_NAME][key] = defaultSettings[key];
        }
    }

    return extensionSettings[MODULE_NAME];
}

function addSettingsControls(settings: ExtensionSettings): void {
    const settingsContainer = document.getElementById('spotify_container') ?? document.getElementById('extensions_settings2');
    if (!settingsContainer) {
        return;
    }

    const renderer = document.createElement('template');
    renderer.innerHTML = html;

    settingsContainer.appendChild(renderer.content);

    const clientId = document.getElementById('spotify_client_id') as HTMLInputElement;
    const template = document.getElementById('spotify_template') as HTMLTextAreaElement;
    const role = document.getElementById('spotify_role') as HTMLSelectElement;
    const position = Array.from(document.getElementsByName('spotify_position')) as HTMLInputElement[];
    const depth = document.getElementById('spotify_depth') as HTMLInputElement;

    clientId.value = settings.clientId;
    template.value = settings.template;
    role.value = settings.role.toString();
    position.forEach((radio) => {
        radio.checked = settings.position === parseInt(radio.value);
    });
    depth.value = settings.depth.toString();

    clientId.addEventListener('input', () => {
        settings.clientId = clientId.value;
        saveSettingsDebounced();
    });
    template.addEventListener('input', () => {
        settings.template = template.value;
        saveSettingsDebounced();
    });
    role.addEventListener('input', () => {
        settings.role = parseInt(role.value);
        saveSettingsDebounced();
    });
    position.forEach((radio) => {
        radio.addEventListener('change', (e) => {
            settings.position = parseInt((e.target as HTMLInputElement).value);
            saveSettingsDebounced();
        });
    });
    depth.addEventListener('input', () => {
        settings.depth = parseInt(depth.value);
        saveSettingsDebounced();
    });

    const authButton = document.getElementById('spotify_auth');
    authButton?.addEventListener('click', () => {
        authenticateSpotify();
    });

    const logoutButton = document.getElementById('spotify_logout');
    logoutButton?.addEventListener('click', () => {
        settings.clientToken = null;
        setUserName('[Not logged in]');
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
        toastr.error('Please enter your Spotify Client ID in the settings.');
        return;
    }

    const codeVerifier = generateRandomString(64);
    const hashed = await sha256(codeVerifier);
    const codeChallenge = base64encode(hashed);
    const redirectUri = new URL('/callback/spotify', location.origin);
    const params = {
        response_type: 'code',
        client_id: settings.clientId,
        scope: 'user-read-private user-read-currently-playing',
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
    }

    try {
        const body = await fetch(url, payload);
        const token = await body.json();

        settings.clientToken = token;
        sessionStorage.removeItem(VERIFIER_KEY);
        saveSettingsDebounced();

        console.log('Spotify token received:', token);
        toastr.success('Successfully authenticated with Spotify!');
    } catch (error) {
        console.error('Error during Spotify authentication:', error);
        toastr.error('Spotify authentication failed. Please try again.');
    }
}

async function tryReadClientData(settings: ExtensionSettings): Promise<void> {
    if (!settings.clientToken || !settings.clientId) {
        setUserName('[Not logged in]');
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

async function setCurrentTrack(): Promise<void> {
    // Reset the prompt to avoid showing old data
    setExtensionPrompt(INJECT_ID, '');

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
        setExtensionPrompt(INJECT_ID, message, settings.position, settings.depth, true, settings.role);
    } catch (error) {
        console.error('Error fetching currently playing track:', error);
    }
}

function getPromptParams(value: Track | Episode) {
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

(async function () {
    const settings = getSettings();
    addSettingsControls(settings);
    await tryGetClientToken(settings);
    await refreshTokenIfNeeded(settings);
    await tryReadClientData(settings);
    globalThis.spotify_setCurrentTrack = setCurrentTrack;
    saveSettingsDebounced();
})();
