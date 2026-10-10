# Edge Add-ons Store Privacy Form Content (English)

Applies to version 0.0.11. Updated: 2026-10-08. This is local submission copy, based on the extension's behavior and full privacy policy.

## Single Purpose Description

VideoTracker saves and restores video watch progress across websites, with optional end-to-end encrypted sync of viewing records and site rules across devices. Local recording requires no account. Automatic recording is off by default; once enabled, records are saved after the selected viewing threshold. Users can also manually save the current video's progress with a keyboard shortcut.

## Permission Justification

### Storage Justification

The extension uses chrome.storage.local to store viewing records (URLs, titles, playback positions and durations, viewing timestamps and thumbnail URLs), site rules, deletion markers, preferences, login sessions and a sync data key locally. Viewing records are local by default. Registration and sign-in communicate with an authentication service; choosing sync uploads encrypted data. Account login passwords are sent to the authentication service over HTTPS. They are different from the sync encryption password, which is not uploaded.

### activeTab Alignment

After a user clicks the extension or invokes its shortcut, the extension accesses the current page to identify and manually save video information. activeTab provides temporary access following user interaction. Automatic recording separately relies on host access and content scripts.

### Tabs Description

The tabs permission supports reading relevant tab URLs and titles to associate embedded player progress with the correct top-level page and to identify relevant tabs in third-party login windows. The extension also uses tab APIs to open saved records and communicate with content scripts, but creating tabs or sending messages is not itself the reason for requesting the tabs permission.

### Command Justification

The extension registers and queries the manual-save shortcut Ctrl+Shift+V (Command+Shift+V on Mac). Users can save progress before the automatic threshold is reached or while automatic recording is disabled. The shortcut can be changed in the browser's extension shortcut settings.

### Script Justification

Content scripts and chrome.scripting.executeScript detect video elements, on-page playback times and player state in embedded frames. Where needed, packaged player bridge code runs in the MAIN world. Recording also reads related video titles, URLs and thumbnail information. Playback restoration adjusts the position in supported players, and manual selection and resume notifications display interactive elements on the page.

### Identity Justification

The extension uses chrome.identity.getRedirectURL() to generate an extension callback URL and chrome.identity.launchWebAuthFlow() to initiate Google or GitHub authorization chosen by the user. The authentication service processes account and session information; tokens are stored locally to maintain the session. When the user chooses sync, encrypted viewing records are uploaded to the developer-configured Supabase service, not a database hosted in the user's own account. Local recording requires no sign-in. Email/password login does not depend on the identity API.

### Host Permission Justification

The *://*/* host access supports detecting videos and restoring playback across websites. In addition to Bilibili, YouTube, iQIYI and Tencent Video, generic detection supports other compatible HTML5 video websites and embedded player domains that cannot all be listed in advance. Scripts read related video titles, URLs, thumbnail information, playback positions and durations, and restore progress in supported players. Users can disable automatic recording globally or per site. Site rules control recording behavior; they do not revoke browser-granted host access. Viewing records are not a general log of all visited pages.

### Remote Code

No remote code is used. Player detection, recording and playback restoration code is packaged with the extension. Authentication, encrypted sync and thumbnail loading are network data requests.

### Purpose of Data Use

Data is used to save and resume videos, authenticate accounts and optionally sync encrypted records. VideoTracker does not use advertising trackers or analytics, sell data, or use it for unrelated profiling, creditworthiness or lending.

## Data Usage

Match the dashboard fields for personally identifiable information, authentication information, web history and website content to the actual data processed:

- Viewing data: Video URLs, titles, playback positions and durations, viewing timestamps, thumbnail URLs, site rules, deletion markers and preferences.
- Account and authentication data: Email, account identifiers, authentication credentials and session information when users choose to register or sign in. Authentication and OAuth providers process necessary data under their own policies.
- Optional sync: When users enable sync or use manual sync, viewing records, site rules and deletion markers are encrypted on the device before upload to the developer-configured Supabase service. The service stores account metadata, ciphertext, password-protected data keys, salts and encryption parameters. The sync encryption password is not uploaded; a sync data key is remembered locally.
- Connection information: End-to-end encryption does not hide account metadata or ordinary connection information such as IP addresses from service providers. Loading remote video thumbnails may send the IP address and requested image URL to image providers even with sync off.

## Retention and Deletion

Users can disable automatic recording or sync, delete local records and sign out. With sync enabled, record deletions propagate on the next successful sync. Signing out clears local session and sync unlock state while preserving local records. Uninstalling clears extension-local storage but does not automatically delete cloud data.

Cloud reset replaces the previous cloud snapshot and key with a new key and newly encrypted local data, preserving local records. Other devices need the new password to unlock sync. Reset is not account deletion. Forgotten sync passwords cannot decrypt old cloud data. Account metadata remains while the account exists; users can contact the developer to request cloud data or account deletion. Provider backups and logs may have separate retention periods, and immediate removal is not promised.

## Full Policy and Contact

Privacy policy: https://github.com/Ankkaya/video-tracker/blob/master/PRIVACY_POLICY.md

Local policy source: [PRIVACY_POLICY.md](../PRIVACY_POLICY.md). Confirm that the published link matches the local policy before submission.

Developer contact: https://github.com/Ankkaya/video-tracker/issues . Do not post passwords, tokens or private viewing records in public issues. Request a private contact channel when needed.
