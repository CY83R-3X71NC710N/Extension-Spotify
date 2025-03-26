export enum InjectionPosition {
    None = -1,
    AfterPrompt = 0,
    InChat = 1,
    BeforePrompt = 2,
}

export enum InjectionRole {
    System = 0,
    User = 1,
    Assistant = 2,
}

export const MODULE_NAME = 'ytmusic';
export const INJECT_ID = 'ytmusic_inject';
export const COOKIE_KEY = 'ytmusic_cookie';
