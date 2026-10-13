# Microsoft Edge Add-ons certification notes

Applies to the current 0.0.12 source. Updated: 2026-10-13. Repository materials only; this update was not uploaded or submitted for review. Build a matching package before submission.

Use the following text in the certification notes field. Supply any cloud test credentials separately in the private submission fields, not in the public store description.

```text
VideoTracker saves and restores video watch progress. Local recording requires no account. Automatic recording is off by default. Cloud sync is optional and uses end-to-end encryption.

Core test path without an account:
1. Install the extension and click the VideoTracker toolbar icon.
2. If there are no records, click "Add sample record". This creates a local example for https://www.youtube.com/watch?v=_P9dU-BT_3c at 10:00 so you can test the list without signing in. Sample data does not test live video detection.
3. Confirm the popup displays the sample record. Click it to open the video URL with the saved timestamp. Restoration depends on the site's player and video availability.
4. Click "View All Records" or the settings icon to open the options page. Test title/episode search, viewing-date filters, opening records, individual deletion and batch deletion. Popup search uses titles.

Manual recording:
1. Open an available video on YouTube, Bilibili, iQIYI or Tencent Video and start playback.
2. Press Ctrl+Shift+V (Command+Shift+V on Mac). If the shortcut is not assigned or conflicts with another extension, assign it in edge://extensions/shortcuts.
3. Reopen the popup and confirm a record with the page title, URL and progress. Manual saving works while automatic recording is off.
4. Click the saved record and check progress restoration in a supported player. A playable video inside a cross-origin iframe can also be used to test the 0.0.11 shortcut fix.

Automatic recording and site controls:
1. Open settings and turn on "Auto Record". Keep the default 30-second threshold.
2. Ensure automatic recording is not disabled for the test site, then play a supported video past the threshold and confirm its record is saved or updated.
3. Open "Site Filters" and add the test site's domain or an HTTP/HTTPS webpage URL to the exclusion list. Its domain and subdomains should stop automatic recording; existing records remain. Manual saving should still work. Remove the exclusion and verify automatic recording resumes when the global switch is on.
4. Turn off global automatic recording to restore the default behavior.

Optional encrypted cloud sync:
1. Sign in with a test account. Registration/sign-in communicates with the authentication service; local recording works without login.
2. Enable cloud sync or use manual sync. On first use, set and confirm a sync encryption password. This differs from the account login password.
3. Sync records from this device. Viewing records, site rules and deletion markers are encrypted locally before upload to the developer-configured Supabase service.
4. In another browser profile or device, sign in to the same account, unlock sync with the same sync encryption password, and sync to verify the records are available.
5. Delete a test record and sync successfully, then sync the other device to verify deletion propagation.
6. Signing out clears session and remembered sync unlock state but preserves local records. Uninstalling does not delete cloud data. Cloud reset replaces the old cloud snapshot using newly encrypted local data; it is not account deletion. Test reset only with disposable test data.

Voluntary feedback without an account:
1. Open "Report a Problem" from the popup feedback icon or options navigation. Confirm the 0/500 text counter, 0/1 image counter and 5 MB limit. Email is optional. Signed-in email is prefilled but editable and removable.
2. Enter disposable reviewer test text. The first submission opens a purpose confirmation. Cancel it and verify that no submission is sent. Agree and submit to receive a short success message; no feedback reference is shown on the page.
3. Images are optional PNG/JPG/WebP, one file up to 5 MB; invalid files are rejected. Text is limited to 500 characters. A failed network request keeps the draft for retry.
4. Feedback text, image and entered email go over HTTPS to the developer-configured Supabase service for the developer to read and handle. Images are private. Feedback is separate from encrypted viewing-record sync, with no automatic attached viewing history, passwords or tokens and no automatic GitHub publication. GitHub Issues remains available as an alternative.

Network and privacy:
Remote thumbnails may load even with cloud sync off. Authentication, sync and confirmed feedback involve the configured service. End-to-end encryption protects synced record contents, not readable feedback or account/connection metadata. The full privacy policy describes processing, retention and deletion requests.
```
