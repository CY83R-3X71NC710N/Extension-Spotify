export {};

// Add global type declarations here
declare global {
    var SillyTavern: any;
    function spotify_setCurrentTrack(): Promise<void>;
}
