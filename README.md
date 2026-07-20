# Any Language Social

A Chrome extension that translates posts as you browse social media. The first supported site is **X / Twitter**.

## What works

- Translates visible posts and posts added by X's infinite scroll
- Lets you choose from 49 target languages
- Detects the source language from X's post markup
- Prefers Chrome's on-device Translator API when available
- Falls back to the MyMemory translation service in Automatic mode
- Lets you keep or hide the original post
- Supports both `x.com` and `twitter.com`, including dark mode

## Install locally

1. Open `chrome://extensions` in Chrome.
2. Turn on **Developer mode**.
3. Click **Load unpacked**.
4. Select this repository folder.
5. Open or refresh [x.com](https://x.com), then use the extension button to choose a language.

Chrome may download an on-device language model the first time a language pair is used. If a model is unavailable, Automatic mode uses MyMemory. Post text is sent to MyMemory only for that fallback; no account or timeline metadata is sent.

## Project layout

```text
manifest.json       Chrome extension manifest
background.js       Remote translation proxy and cache
content/x.js        X post discovery and translation
content/x.css       Translation presentation on X
popup/              Language and privacy controls
tests/               Browser DOM smoke-test fixture
```

## Current limitations

- MyMemory's free public API is rate-limited and is intended as a zero-setup fallback.
- X can change its page markup; post discovery currently uses its `tweetText` test id.
- Images, video, text embedded inside images, and the post composer are not translated.

## Next platforms

The content-script structure is ready to extend with site-specific adapters for Bluesky, Threads, LinkedIn, Reddit, and Mastodon.
