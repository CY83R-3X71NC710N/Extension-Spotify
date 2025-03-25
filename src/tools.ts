export const TOOL_PARAMETERS: { [key: string]: Readonly<Record<string, any>> } = {
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
                description: 'The URI of the track to perform the action on. Required for play action.',
            },
        },
        required: ['action'],
    }),
    getTopTracks: Object.freeze({
        $schema: 'http://json-schema.org/draft-04/schema#',
        type: 'object',
        properties: {
            timeRange: {
                type: 'string',
                description: 'The time range for the top tracks. Possible values are: short_term, medium_term, long_term.',
            },
        },
        required: [],
    }),
    getPlaylists: Object.freeze({
        $schema: 'http://json-schema.org/draft-04/schema#',
        type: 'object',
        properties: {},
        required: [],
    }),
};
