import { InjectionPosition, InjectionRole, MODULE_NAME } from './constants';
import { setUserName, importYTMusicCookies, tryGetClientFromCookies } from './auth';
import { syncFunctionTools, YTMusicTool } from './tools';
import { resetInject } from './prompt';
import { YTMusicCookies } from './types';
import html from './settings.html';

const { t, saveSettingsDebounced } = SillyTavern.getContext();

interface ExtensionSettingsBase {
    cookieData: YTMusicCookies | null;
    template: string;
    position: InjectionPosition;
    role: InjectionRole;
    depth: number;
    scan: boolean;
    // Allow additional properties
    [key: string]: unknown;
}

type YTMusicToolSettings = {
    [key in YTMusicTool]: boolean;
};

export type ExtensionSettings = ExtensionSettingsBase & YTMusicToolSettings;

interface GlobalSettings {
    [MODULE_NAME]: ExtensionSettings;
}

const defaultSettings: Readonly<ExtensionSettings> = Object.freeze({
    cookieData: null,
    template: '[{{user}} is listening to {{song}} by {{artist}} on YouTube Music]',
    position: InjectionPosition.InChat,
    role: InjectionRole.System,
    depth: 1,
    scan: true,
    searchSongs: true,
    getCurrentSong: true,
    getQueue: false,
    playItem: true,
    getHistory: false,
    getUserPlaylists: false,
    getPlaylistItems: false,
    searchArtists: false,
    searchAlbums: false,
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

export function addSettingsControls(settings: ExtensionSettings): void {
    const settingsContainer = document.getElementById('ytmusic_container') ?? document.getElementById('extensions_settings2');
    if (!settingsContainer) {
        return;
    }
    const renderer = document.createElement('template');
    renderer.innerHTML = html;
    settingsContainer.appendChild(renderer.content);

    // Setup UI elements
    const elements = {
        cookieInput: document.getElementById('ytmusic_cookie_input') as HTMLTextAreaElement,
        template: document.getElementById('ytmusic_template') as HTMLTextAreaElement,
        role: document.getElementById('ytmusic_role') as HTMLSelectElement,
        position: Array.from(document.getElementsByName('ytmusic_position')) as HTMLInputElement[],
        depth: document.getElementById('ytmusic_depth') as HTMLInputElement,
        scan: document.getElementById('ytmusic_scan') as HTMLInputElement,
        authButton: document.getElementById('ytmusic_auth') as HTMLDivElement,
        logoutButton: document.getElementById('ytmusic_logout') as HTMLDivElement,
        tools: {
            searchSongs: document.getElementById('ytmusic_tool_search_songs') as HTMLInputElement,
            getCurrentSong: document.getElementById('ytmusic_tool_get_current_song') as HTMLInputElement,
            getQueue: document.getElementById('ytmusic_tool_get_queue') as HTMLInputElement,
            playItem: document.getElementById('ytmusic_tool_play_item') as HTMLInputElement,
            getHistory: document.getElementById('ytmusic_tool_get_history') as HTMLInputElement,
            getUserPlaylists: document.getElementById('ytmusic_tool_get_user_playlists') as HTMLInputElement,
            getPlaylistItems: document.getElementById('ytmusic_tool_get_playlist_items') as HTMLInputElement,
            searchArtists: document.getElementById('ytmusic_tool_search_artists') as HTMLInputElement,
            searchAlbums: document.getElementById('ytmusic_tool_search_albums') as HTMLInputElement,
        },
    };

    // Initialize UI with current settings
    elements.cookieInput.value = '';
    elements.template.value = settings.template;
    elements.role.value = settings.role.toString();
    elements.position.forEach((radio) => {
        radio.checked = settings.position === parseInt(radio.value);
    });
    elements.depth.value = settings.depth.toString();
    elements.scan.checked = settings.scan;

    // Initialize tool checkboxes
    elements.tools.searchSongs.checked = settings.searchSongs;
    elements.tools.getCurrentSong.checked = settings.getCurrentSong;
    elements.tools.getQueue.checked = settings.getQueue;
    elements.tools.playItem.checked = settings.playItem;
    elements.tools.getHistory.checked = settings.getHistory;
    elements.tools.getUserPlaylists.checked = settings.getUserPlaylists;
    elements.tools.getPlaylistItems.checked = settings.getPlaylistItems;
    elements.tools.searchArtists.checked = settings.searchArtists;
    elements.tools.searchAlbums.checked = settings.searchAlbums;

    // Define a generic handler for simple input changes
    const handleInputChange = <T extends HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
        element: T,
        settingKey: keyof ExtensionSettings,
        transform?: (value: string | boolean) => number | string | boolean,
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
    handleInputChange(elements.template, 'template', value => value, resetInject);
    handleInputChange(elements.role, 'role', value => parseInt(value as string), resetInject);
    handleInputChange(elements.depth, 'depth', value => parseInt(value as string), resetInject);
    handleInputChange(elements.scan, 'scan', value => value, resetInject);

    // Tool checkbox listeners
    handleInputChange(elements.tools.searchSongs, 'searchSongs', value => value, syncFunctionTools);
    handleInputChange(elements.tools.getCurrentSong, 'getCurrentSong', value => value, syncFunctionTools);
    handleInputChange(elements.tools.getQueue, 'getQueue', value => value, syncFunctionTools);
    handleInputChange(elements.tools.playItem, 'playItem', value => value, syncFunctionTools);
    handleInputChange(elements.tools.getHistory, 'getHistory', value => value, syncFunctionTools);
    handleInputChange(elements.tools.getUserPlaylists, 'getUserPlaylists', value => value, syncFunctionTools);
    handleInputChange(elements.tools.getPlaylistItems, 'getPlaylistItems', value => value, syncFunctionTools);
    handleInputChange(elements.tools.searchArtists, 'searchArtists', value => value, syncFunctionTools);
    handleInputChange(elements.tools.searchAlbums, 'searchAlbums', value => value, syncFunctionTools);

    // Handle radio buttons separately
    elements.position.forEach((radio) => {
        radio.addEventListener('input', (e) => {
            settings.position = parseInt((e.target as HTMLInputElement).value);
            saveSettingsDebounced();
        });
    });

    // Auth buttons
    elements.authButton.addEventListener('click', () => {
        const cookieString = elements.cookieInput.value.trim();
        importYTMusicCookies(cookieString);
    });

    elements.logoutButton.addEventListener('click', () => {
        settings.cookieData = null;
        setUserName(t`[Not logged in]`);
        saveSettingsDebounced();
    });
}
