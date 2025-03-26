export {};

// 1. Import when extension is user-scoped
import '../../../../public/global';
// 2. Import when extension is server-scoped
import '../../../../global';

// Add global type declarations here
declare global {
    function ytmusic_setCurrentTrack(): Promise<void>;
}
