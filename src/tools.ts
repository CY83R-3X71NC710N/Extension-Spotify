export interface ToolDefinition {
    name: string;
    displayName: string;
    description: string;
    parameters: object;
    action: (...args: never[]) => Promise<unknown>;
    shouldRegister: () => Promise<boolean>;
}

export interface SearchTracksParameters {
    query: string;
}

export interface ControlPlaybackParameters {
    action: string;
    uri?: string;
    contextUri?: string;
}

export interface GetTopTrackParameters {
    timeRange: string;
}

export interface GetPlaylistTracksParameters {
    playlistUri: string;
}

export const TOOL_PARAMETERS: { [key: string]: Readonly<Record<string, unknown>> } = {
    searchTracks: Object.freeze({
        $schema: 'http://json-schema.org/draft-04/schema#',
        type: 'object',
        properties: {
            query: {
                type: 'string',
                description: 'The search query for the track.',
            },
        },
        required: ['query'],
    }),
    controlPlayback: Object.freeze({
        $schema: 'http://json-schema.org/draft-04/schema#',
        type: 'object',
        properties: {
            action: {
                type: 'string',
                description: 'The action to perform on the track. Possible values are: play, pause, resume, next, previous.',
            },
            uri: {
                type: 'string',
                description: '"play" action only. The URI of the track to perform the action on. Optional if playing a playlist or album.',
            },
            contextUri: {
                type: 'string',
                description: '"play" action only. The URI of the album, artist, or playlist to perform the action on. Optional if playing a single track.',
            },
        },
        required: ['action'],
    }),
    getCurrentTrack: Object.freeze({
        $schema: 'http://json-schema.org/draft-04/schema#',
        type: 'object',
        properties: {},
        required: [],
    }),
    getTopTracks: Object.freeze({
        $schema: 'http://json-schema.org/draft-04/schema#',
        type: 'object',
        properties: {
            timeRange: {
                type: 'string',
                description: 'The time range for the top tracks. Possible values are: short_term, medium_term, long_term. Default is short_term.',
            },
        },
        required: [],
    }),
    getRecentTracks: Object.freeze({
        $schema: 'http://json-schema.org/draft-04/schema#',
        type: 'object',
        properties: {},
        required: [],
    }),
    getPlaylists: Object.freeze({
        $schema: 'http://json-schema.org/draft-04/schema#',
        type: 'object',
        properties: {},
        required: [],
    }),
    getPlaylistTracks: Object.freeze({
        $schema: 'http://json-schema.org/draft-04/schema#',
        type: 'object',
        properties: {
            playlistUri: {
                type: 'string',
                description: 'The URI of the playlist to get the tracks from.',
            },
        },
        required: ['playlistUri'],
    }),
};
