Looma 0.3.2 includes Whisper small and tiny.en recognition models in the Mac installer, with a standalone CPU whisper.cpp runtime. Fresh installations can find recognition assets directly in Resources. Recognition stays local; microphone permission remains required.

The new workspace is the only dashboard. The simulated computer panel and old dashboard pages are removed. Settings includes a single Enable voice assistant action and separate controls for microphone, wake phrase and spoken replies. Updating one preference no longer resets omitted preferences to defaults, preventing voice controls from unexpectedly switching off. The puppy distinguishes missing recognition assets from a disabled microphone.

Validation: typecheck, 34 unit tests, new workspace integration checks, model SHA1 checks and installer checks. Physical microphone behavior must be checked after macOS permissions and Keychain access are granted. The bundle uses ad-hoc signing and is not notarized.
