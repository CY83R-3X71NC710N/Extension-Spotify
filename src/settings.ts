import { AccessToken } from '@spotify/web-api-ts-sdk';
import { InjectionPosition, InjectionRole, MODULE_NAME } from './constants';

export interface ExtensionSettings {
    clientId: string;
    clientToken: AccessToken | null;
    template: string;
    position: InjectionPosition;
    role: InjectionRole;
    depth: number;
    scan: boolean;
    // Tools
    searchTracks: boolean;
    controlPlayback: boolean;
    getCurrentTrack: boolean;
    getTopTracks: boolean;
    getRecentTracks: boolean;
    getPlaylists: boolean;
    getPlaylistTracks: boolean;
    // Allow additional properties
    [key: string]: unknown;
}

export interface GlobalSettings {
    [MODULE_NAME]: ExtensionSettings;
}

export const defaultSettings: Readonly<ExtensionSettings> = Object.freeze({
    clientId: '',
    clientToken: null,
    template: '[{{user}} is listening to {{song}} by {{artist}} on Spotify]',
    position: InjectionPosition.InChat,
    role: InjectionRole.System,
    depth: 1,
    scan: true,
    searchTracks: true,
    controlPlayback: true,
    getCurrentTrack: true,
    getTopTracks: true,
    getRecentTracks: true,
    getPlaylists: true,
    getPlaylistTracks: true,
});

export function getSettings(): ExtensionSettings {
    const context = SillyTavern.getContext();
    const globalSettings = context.extensionSettings as object as GlobalSettings;

    // Initialize settings if they don't exist
    if (!globalSettings[MODULE_NAME]) {
        globalSettings[MODULE_NAME] = structuredClone(defaultSettings);
    }

    // Ensure all default keys exist (helpful after updates)
    for (const key in defaultSettings) {
        if (globalSettings[MODULE_NAME][key] === undefined) {
            globalSettings[MODULE_NAME][key] = defaultSettings[key];
        }
    }

    return globalSettings[MODULE_NAME];
}
