# Microsoft Edge Add-ons certification notes

Use the following text in Partner Center > Submission options > Notes for certification.

```text
VideoTracker is a local-first video watch progress tracker.

Core test path without an account:
1. Install the extension package.
2. Click the VideoTracker toolbar icon.
3. If there are no records, click "Add sample record". This creates a local sample watch record for https://www.youtube.com/watch?v=_P9dU-BT_3c at 10:00 so the reviewer can immediately test the primary UI.
4. Confirm the popup shows the sample record with platform, progress, and action buttons.
5. Click the sample record. The opened video URL includes the saved timestamp. On supported pages, VideoTracker also seeks the video and shows a "Resume from ..." notification.
6. Click "View All Records" or the settings icon. The options page opens in a full tab.
7. In the Records tab, verify search/filter, open record, and delete record.
7. Optional live-video test: open a supported video page such as YouTube, Bilibili, iQIYI, or Tencent Video, watch past the configured threshold, then reopen the popup to confirm the record is saved.

Cloud sync is optional:
1. Local tracking works without login.
2. Login is only required for encrypted cloud sync.
3. When cloud sync is enabled, watch records are encrypted locally before upload.
```
