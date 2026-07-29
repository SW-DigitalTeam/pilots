# Runtime assets (served from `public/`, cached offline after first load)

These are not committed (they are large/binary and, for voice, must be recorded
by a real person). Place them here before deploying a pilot:

- `mediapipe/pose_landmarker_lite.task` — the pose model.
- `mediapipe/wasm/` — the MediaPipe tasks-vision wasm bundle.
- `audio/<cue-id>.(webm|m4a|ogg)` — the recorded cue bank, one file per cue id.
  See [`docs/VOICE_SCRIPT.md`](../../../docs/VOICE_SCRIPT.md) for ids, durations
  and timing marks. Until these exist, the engine plays a synthetic placeholder
  voice so timing can be tuned.
- `assets/icon-192.png`, `assets/icon-512.png` — PWA icons.

The service worker (`sw.js`) cache-first-caches everything under `mediapipe/`,
`audio/` and `assets/`, so once loaded the game runs fully offline.
