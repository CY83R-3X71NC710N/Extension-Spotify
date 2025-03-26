# YouTube Music Extension for SillyTavern

Provides function tools and information about the currently playing song on YouTube Music in SillyTavern prompts.

## Installation

Requires the latest SillyTavern staging branch.

Install via the extension installer using the following URL:

```txt
https://github.com/SillyTavern/Extension-Spotify
```

## Usage

> **Requires YouTube Music cookies for authentication**

### How to Get Your Cookies

1. Log in to [YouTube Music](https://music.youtube.com/) in your browser
2. Open developer tools (F12 or right-click > Inspect)
3. Go to the Application tab
4. In the sidebar, navigate to Storage > Cookies > https://music.youtube.com
5. Copy the cookie values (you'll need to format them as cookie strings, e.g., "CONSENT=YES+; VISITOR_INFO1_LIVE=somevalue; ...")

### Authentication

1. Paste the cookie string into the "YouTube Music Cookies" field in the extension settings
2. Click "Authenticate"
3. If successful, you'll see your YouTube Music account name displayed

> **Note**: Cookies have an expiration date, and you'll be notified when they're about to expire.

## Configuration

After performing the initial setup, the extension will be able to access your YouTube Music account and provide information about your recently played songs. You can configure the extension, including the injection template, role, position and depth.

### Template macros

Apart from the usual SillyTavern macros, the template field also supports the following additional parameters:

- `{{song}}`: The name of the song
- `{{artist}}`: The name of the artist
- `{{album}}`: The name of the album (if available)

Example:

```txt
{{user}} is listening to {{song}} by {{artist}} from the album {{album}}.
```

### Function tools

The extension provides [function tools](https://docs.sillytavern.app/for-contributors/function-calling/) for YouTube Music API. The following functions are available (can be toggled individually in the extension settings):

1. "Search Songs": Search for songs by name or artist
2. "Search Artists": Search for artists by name
3. "Search Albums": Search for albums
4. "Play Item": Provides a URL to play a song or playlist
5. "Get Current Song": Gets the most recently played song (YouTube Music API limitation)
6. "Get Queue": Information about the queue (limited by YouTube Music API)
7. "Get History": Gets your recently played tracks
8. "Get User Playlists": Gets playlists of the user
9. "Get Playlist Items": Gets a list of tracks from a playlist

> "Search Songs", "Play Item" and "Get Current Song" are enabled by default. The rest are disabled by default.

## YouTube Music API Limitations

The extension uses an unofficial YouTube Music API and may have some limitations compared to the official Spotify API:

- "Current Track" is based on the most recently played song in your history
- Some playback controls are limited to providing URLs (to be opened by the user)
- Some YouTube Music features may require authentication renewal more frequently

## Contributing

To build the extension, run the following command in the root directory of the extension:

```bash
npm install
npm run build
```

**Create an issue** if you have ideas for new function tools.
**Create a pull request** if you want to contribute to the extension.

## License

AGPL-3.0. See [LICENSE](LICENSE) for more details.
