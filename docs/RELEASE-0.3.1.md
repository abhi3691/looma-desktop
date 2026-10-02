# Looma 0.3.1

- The floating puppy and app artwork no longer have the two front legs highlighted by the user.
- Double-clicking the puppy and reopening an already running app brings forward the Open Dots workspace. Companion settings remain available from the app menu; the original dashboard is a fallback when the workspace is unavailable.
- Wake listening keeps the microphone open through idle silence, bounds idle audio to a short pre-roll, and avoids teaching the noise detector to reject opening speech. It still waits for a 2.2-second pause to finish a spoken sentence.
- The listener prevents overlapping microphone starts, cancels late microphone grants after stopping, detects stalled or ended capture, and bounds speech playback waits. Explicit microphone-off remains respected.
- Desktop sign-in offers Open my workspace without exposing the owner token. Recovery is restricted to the trusted workspace main frame; intentional sign-out remains signed out until the user reconnects. Failed API actions are not automatically replayed.

Validation includes TypeScript, Node tests, production client build, isolated authenticated workspace recovery and hostile-window rejection, synthetic wake audio through real local Whisper and Meera, interruption followed by a response, and recovery after stopping the capture track. These synthetic checks do not establish physical-room recognition or perceived Malayalam pronunciation quality.

Questions-only cloud consent remains unchanged: task results, conversation history and local preferences are not sent to cloud models. This Apple Silicon installer uses ad-hoc signing and is not Apple-notarized.
