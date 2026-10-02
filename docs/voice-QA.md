# Voice conversation checks

| Requirement                                                   | Evidence                                                                             | Status                     |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------ | -------------------------- |
| Bare Hi Looma has an audible greeting                         | Real Whisper + natural audio playback event in wake-smoke                            | Passed                     |
| Spoken question has a voiced answer                           | Native wake-smoke, actual Meera PCM playback                                         | Passed                     |
| Online Malayalam female voice                                 | Sobhana service synthesis + MP3 natural playback                                     | Passed                     |
| Speak while replying: stop old audio and answer next question | Controlled microphone frames, pause event, real Whisper recognition, second playback | Passed                     |
| Ignore brief clicks / noise                                   | InterruptDetector unit test                                                          | Passed                     |
| Stop preserves wake listening; Stop listening mutes           | Voice control parser tests and recorder flow inspection                              | Passed                     |
| Offline remains default and online has a local fallback       | Strict settings tests, provider branch inspection                                    | Passed                     |
| Floating companion has no visible button row                  | Electron smoke button count + saved companion screenshot                             | Passed                     |
| Physical room acoustics and perceived pronunciation           | Requires the user’s microphone and listening feedback                                | Not independently verified |

The interaction test uses a synthetic microphone fixture and controlled near-end audio, not recordings of the user. Audio must start and finish naturally; a synthetic ended event alone is insufficient. Tested interruption includes actual cancellation and a separate response to “Please stretch.”
