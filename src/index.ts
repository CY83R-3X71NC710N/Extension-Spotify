import { tryGetClientFromCookies, checkCookieExpiration } from './auth';
import { getSettings, addSettingsControls } from './settings';
import { syncFunctionTools } from './tools';
import { setCurrentTrack } from './prompt';
import './style.css';

(async function main() {
    const context = SillyTavern.getContext();
    const settings = getSettings();
    addSettingsControls(settings);
    
    await tryGetClientFromCookies(settings);
    checkCookieExpiration(settings);
    
    globalThis.ytmusic_setCurrentTrack = setCurrentTrack;
    syncFunctionTools();
    context.saveSettingsDebounced();
})();
