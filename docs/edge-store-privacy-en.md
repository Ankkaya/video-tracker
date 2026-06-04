# Edge Add-ons Store Privacy Form Content (English)

## Single Purpose Description

VideoTracker is a video watch progress tracking tool that automatically saves and restores your viewing position across video websites. The extension periodically monitors video playback status on the page through a heartbeat mechanism, and once viewing exceeds a configurable threshold, it automatically records the playback position. The next time you open the same page, you can quickly resume from where you left off. Users can also manually save progress via a keyboard shortcut, and optionally enable Supabase cloud sync to synchronize records across multiple devices.

## Permission Justification

### Storage Justification

The extension uses chrome.storage.local to store the following data: (1) Video watch records (URL, title, playback progress, timestamps); (2) User preferences (auto-record toggle, viewing threshold, theme settings); (3) Custom site list; (4) Cloud sync configuration and authentication tokens. All data is stored locally and is not uploaded to any server (unless the user explicitly enables the cloud sync feature).

### activeTab Alignment

When users click the extension icon or use the keyboard shortcut to manually save current video progress, the extension needs to access the active tab's information (URL, title) to create an accurate watch record. The activeTab permission is only activated upon user-initiated interactions and does not continuously access tabs in the background.

### Tabs Description

The tabs permission is used for: (1) Detecting video playback state changes when users switch tabs, ensuring the heartbeat mechanism only runs during active video playback; (2) Retrieving tab URL and title information to correctly attribute records to the top-level page when videos are played within iframes; (3) Communicating with content scripts via chrome.tabs.sendMessage to notify successful auto-saves.

### Command Justification

The extension registers a keyboard shortcut Ctrl+Shift+V (Cmd+Shift+V on Mac) to allow users to manually save the current video progress. This is a core feature of the extension, complementing the auto-record functionality, enabling users to proactively save progress before the automatic threshold is reached.

### Script Justification

The extension injects content scripts into web pages to detect HTML5 video elements and read their currentTime and duration properties to capture playback progress. Additionally, it uses chrome.scripting.executeScript to inject a bridge script in the MAIN world, which accesses player objects protected by Shadow DOM or iframes (such as embedded players on Bilibili, YouTube, and other sites). The scripts do not modify page content — they only read playback state.

### Identity Proof

The extension uses the chrome.identity API to implement OAuth third-party login functionality. Specifically, it uses chrome.identity.getRedirectURL() to generate the Supabase OAuth callback URL, and chrome.identity.launchWebAuthFlow() to initiate Google and GitHub authorization login flows. After login, the extension stores the access token in local chrome.storage.local storage for syncing watch records to the user's Supabase database. This feature is entirely optional — users can fully use local recording functionality without logging in, and email/password login does not depend on this permission.

### Host Permission Justification

The extension uses the *://*/* host permission to support any video website. The core value of the extension is cross-site video progress tracking, and users may watch videos on websites of any domain. Built-in adapters cover Bilibili, YouTube, iQiyi, and Tencent Video, while also supporting user-defined custom sites. The content scripts and MAIN world bridge scripts only read video element playback state and do not read, modify, or transmit any other page content.

### Remote Code

No, I am not using remote code.

### Legitimacy (Optional)

VideoTracker is a privacy-friendly, local-first tool. All data is stored locally on the user's device. It does not collect any personal information, does not track user behavior, and does not use analytics services. The cloud sync feature uses the user's own Supabase account, and the developer has no access to user data. The extension code is fully open source (https://github.com/Ankkaya/video-tracker) and subject to community review.
