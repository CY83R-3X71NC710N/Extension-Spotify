import { AccessToken } from "@spotify/web-api-ts-sdk";
import { InjectionPosition, InjectionRole, MODULE_NAME } from "./constants";

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
    getTopTracks: boolean;
    getPlaylists: boolean;
    // Allow additional properties
    [key: string]: any;
}

export interface GlobalSettings {
    [MODULE_NAME]: ExtensionSettings;
}

export interface TrackViewModel {
    uri: string;
    name: string;
    artist: string;
    album: string;
}

export interface ToolDefinition {
    name: string;
    displayName: string;
    description: string;
    parameters: object;
    action: (...args: any[]) => Promise<any>;
    shouldRegister: () => Promise<boolean>;
}

export interface SearchTracksParameters {
    query: string;
}

export interface ControlPlaybackParameters {
    action: string;
    uri?: string;
}

export interface GetTopTrackParameters {
    timeRange: string;
}

export type TimeRange = 'short_term' | 'medium_term' | 'long_term';
