import { SpotifyApi, AccessToken, Track, Episode } from '@spotify/web-api-ts-sdk';
import { Sha256 } from '@aws-crypto/sha256-browser';
import { InjectionPosition, InjectionRole } from './types';
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

const MODULE_NAME = 'spotify';
const INJECT_ID = 'spotify_inject';

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
}

async function authenticateSpotify(): Promise<void> {
    const settings = getSettings();

    if (!settings.clientId) {
        toastr.error('Please enter your Spotify Client ID in the settings.');
        return;
    }

    const generateRandomString = (length: number) => {
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        const values = crypto.getRandomValues(new Uint8Array(length));
        return values.reduce((acc, x) => acc + possible[x % possible.length], '');
    };
    const base64encode = (input: Uint8Array) => {
        return btoa(String.fromCharCode(...new Uint8Array(input)))
            .replace(/=/g, '')
            .replace(/\+/g, '-')
            .replace(/\//g, '_');
    };
    const sha256 = (message: string) => {
        const encoder = new TextEncoder();
        const data = encoder.encode(message);
        const hash = new Sha256();
        hash.update(data);
        return hash.digest();
    };

    const codeVerifier = generateRandomString(64);
    const hashed = await sha256(codeVerifier);
    const codeChallenge = base64encode(hashed);
    const redirectUri = new URL('/callback', location.origin);
    const params = {
        response_type: 'code',
        client_id: settings.clientId,
        scope: 'user-read-private user-read-currently-playing',
        redirect_uri: redirectUri.toString(),
        code_challenge_method: 'S256',
        code_challenge: codeChallenge,
        state: MODULE_NAME,
    };

    sessionStorage.setItem('spotify_code_verifier', codeVerifier);
    const authUrl = new URL('https://accounts.spotify.com/authorize');
    authUrl.search = new URLSearchParams(params).toString();
    window.location.href = authUrl.toString();
}

function readCode(): string | null {
    const urlParams = new URLSearchParams(window.location.search);
    const cbQuery = urlParams.get('cb-query');
    if (cbQuery) {
        const cbQueryParams = new URLSearchParams(atob(cbQuery));
        const code = cbQueryParams.get('code');
        const state = cbQueryParams.get('state');
        if (state !== MODULE_NAME) {
            return null;
        }
        window.history.replaceState({}, document.title, window.location.pathname);
        return code;
    }
    return null;
}

async function tryGetClientToken(settings: ExtensionSettings): Promise<void> {
    const code = readCode();
    const codeVerifier = sessionStorage.getItem('spotify_code_verifier');
    if (!code || !codeVerifier || !settings.clientId) {
        return;
    }

    const url = 'https://accounts.spotify.com/api/token';
    const redirectUri = new URL('/callback', location.origin);
    const payload = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
            client_id: settings.clientId,
            grant_type: 'authorization_code',
            code,
            redirect_uri: redirectUri.toString(),
            code_verifier: codeVerifier,
        }),
    }

    const body = await fetch(url, payload);
    const response = await body.json();

    settings.clientToken = response;
    sessionStorage.removeItem('spotify_code_verifier');
    saveSettingsDebounced();
}

async function tryReadClientData(settings: ExtensionSettings): Promise<void> {
    if (!settings.clientToken) {
        return;
    }

    const api = SpotifyApi.withAccessToken(settings.clientId, settings.clientToken);
    const user = await api.currentUser.profile();

    if (!user) {
        return;
    }

    const userName = document.getElementById('spotify_user_name') as HTMLSpanElement;
    userName.innerText = user.display_name || user.id;
}

async function setCurrentTrack(): Promise<void> {
    setExtensionPrompt(INJECT_ID, '');

    const settings = getSettings();
    if (!settings.clientToken || !settings.clientId || !settings.template) {
        return;
    }

    const api = SpotifyApi.withAccessToken(settings.clientId, settings.clientToken);
    const currentlyPlaying = await api.player.getCurrentlyPlayingTrack();
    const params = getPromptParams(currentlyPlaying.item);
    const message = substituteParamsExtended(settings.template, params);
    setExtensionPrompt(INJECT_ID, message, settings.position, settings.depth, true, settings.role);
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
                track: track.name,
                artist: track.artists.map(a => a.name)?.join(', '),
                album: track.album.name,
                year: track.album.release_date.split('-')[0],
            };
        };
        case 'show': {
            const episode = value as Episode;
            return {
                song: episode.name,
                track: episode.name,
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
    await tryReadClientData(settings);
    globalThis.spotify_setCurrentTrack = setCurrentTrack;
    saveSettingsDebounced();
})();
