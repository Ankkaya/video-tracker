# Privacy Policy for VideoTracker

**Last Updated:** June 3, 2026

## Overview

VideoTracker is a browser extension that helps you track and resume your video watching progress across websites. We are committed to protecting your privacy.

## Data Collection

**We do NOT collect any personal data.**

VideoTracker does not:
- Collect personally identifiable information (PII)
- Track your browsing history
- Monitor your online activity
- Use analytics or tracking services
- Send data to external servers

## Data Storage

All data is stored **locally** on your device using the browser's built-in storage API. This includes:

- Video watch progress (timestamps, video URLs)
- User preferences and settings
- Sync configuration (if you enable optional cloud sync)

This data never leaves your device unless you explicitly enable the optional Supabase cloud sync feature.

## Permissions Usage

| Permission | Purpose |
|------------|---------|
| `storage` | Save video watch progress locally |
| `activeTab` | Detect the current video page |
| `tabs` | Track video playback across tabs |
| `scripting` | Inject content scripts to detect video elements |
| `host_permissions: *://*/*` | Support video sites across all domains |

## Third-Party Services

**Optional Cloud Sync:**
If you choose to enable cloud synchronization, your data will be stored in your own Supabase account. We do not have access to your Supabase credentials or data.

## Data Security

- All data is stored locally on your device
- No data is transmitted to our servers
- Cloud sync (if enabled) uses your own secure Supabase account

## Children's Privacy

VideoTracker does not knowingly collect any personal information from children under 13.

## Changes to This Policy

We may update this privacy policy from time to time. Any changes will be reflected in the "Last Updated" date above.

## Contact Us

If you have any questions about this privacy policy, please open an issue on our GitHub repository:

[https://github.com/Ankkaya/video-tracker](https://github.com/Ankkaya/video-tracker)

---

**Summary:** VideoTracker is a privacy-friendly extension that stores all data locally on your device. We do not collect, transmit, or share any of your personal data.