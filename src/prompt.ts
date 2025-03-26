import YTMusic from 'ytmusic-api';
import { INJECT_ID, InjectionPosition } from './constants';
import { getSettings } from './settings';
import { initYTMusicClient, checkCookieExpiration } from './auth';

const { setExtensionPrompt, substituteParamsExtended } = SillyTavern.getContext();

export function resetInject() {
    // Reset the prompt to avoid showing old data
    setExtensionPrompt(INJECT_ID, '', InjectionPosition.None, 0);
}

export async function setCurrentTrack(): Promise<void> {
    resetInject();
    const settings = getSettings();
    if (!settings.cookieData || !settings.template || settings.position === InjectionPosition.None) {
        return;
    }

    try {
        checkCookieExpiration(settings);
        const ytMusic = await initYTMusicClient(settings);
        if (!ytMusic) {
            return;
        }

        // Get the currently playing track
        // Note: YTMusic API doesn't have a direct "get currently playing" method
        // We'll use the history to get the most recent track as a workaround
        const history = await ytMusic.getHistory();
        if (!history || history.length === 0) {
            console.log('No recent tracks in YouTube Music history');
            return;
        }

        // Get the most recent track from history
        const currentTrack = history[0];
        console.log('Most recent YouTube Music track:', currentTrack);

        // Extract track details for the prompt
        const params = {
            song: currentTrack.title,
            artist: Array.isArray(currentTrack.artists) 
                ? currentTrack.artists.map((a: any) => a.name).join(', ') 
                : currentTrack.artists?.name || 'Unknown Artist',
            album: currentTrack.album?.name || '',
            // YouTube Music doesn't have release years directly available in the API
        };

        const message = substituteParamsExtended(settings.template, params);
        setExtensionPrompt(INJECT_ID, message, settings.position, settings.depth, settings.scan, settings.role);
    } catch (error) {
        console.error('Error fetching currently playing track from YouTube Music:', error);
    }
}
