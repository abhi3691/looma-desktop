# Looma 0.3 — desktop companion + Open Dots workspace

Looma combines the full MIT-licensed Open Dots Next.js client and FastAPI server with the original Electron puppy, local speech recognition, encrypted MCP connections and activity history. The app and installer use the cream puppy icon. The sidebar has a labelled New chat action and no decorative window-control dots.

## Run and build

Requirements for development: Node.js 22+, Python 3.11+, and the native build tools for your operating system.

```sh
npm ci
npm --prefix workspace/client ci
python3 -m venv workspace/server/.venv
workspace/server/.venv/bin/python -m pip install -r workspace/server/requirements.txt pyinstaller pytest
npm run build:workspace
npm run build
npm start
```

On Windows use `python` and `workspace/server/.venv/Scripts/python.exe`. The packaged app includes Python and the static web client; end users do not need either development runtime. Build on the target OS:

```sh
npm run dist:mac
# On Windows:
npm run dist:win
```

The server builder selects the virtualenv executable for the current OS. Native Windows x64 and Intel Mac installers are built by the release workflows alongside the Apple Silicon Mac installer. Mac builds are ad-hoc signed, not Apple-notarized.

## Using Looma

Opening Looma starts its authenticated loopback workspace and floating puppy. Use the Looma menu → **Companion settings** for Gemini, voice, multiple MCP servers, activity monitoring and privacy. **Open workspace** returns to the Open Dots dashboard. Closing a window hides it; Quit stops the app and server.

Enable hands-free voice in Companion settings and grant macOS microphone permission. Say “Hi Looma,” pause, then ask your question. Recognition uses a configured local multilingual Whisper model. Voice recognition does not use browser SpeechRecognition. Release installers include the recognition models and platform-specific speech runtimes. Existing settings, connections and installed speech models remain in the existing `careless-ai` application data directory.

Gemini Live uses `gemini-3.1-flash-live-preview`, configured with your own key in Companion settings. It currently receives a completed, locally transcribed question and returns native audio; this is not continuous audio streaming. Microphone wake performance still depends on room noise, model and device. Local/mock providers remain available in Companion settings.

Ask task questions normally or use `/tasks`. MCP responses render as Markdown tables. Loom’s currently discovered server supports reading tasks; task creation is not fabricated when no create tool is available. The Plugins page now manages the same encrypted MCP connections as the desktop companion. Loom task questions automatically use list_projects/list_tasks, even when another read tool was previously selected. Optional Composio accounts appear separately; they require a Composio key and completion of each account authorization in your browser. Catalogue previews are never shown as connected accounts. Open Dots file/terminal/connector actions retain their approval and audit mechanisms. Its computer panel requires a separately configured real sandbox; the default fake provider is for development only.

## Privacy and storage

- Gemini receives only the current question. Private task results, prior chat and saved personal memories are not added to Google requests.
- MCP queries go only to your configured server. Google credentials remain in Electron safeStorage; they are not copied to the web renderer or Python server.
- The Python server and private desktop bridge bind only to 127.0.0.1 on random ports. The workspace uses an HttpOnly session cookie; the owner and bridge tokens remain in main-process/server memory.
- Open Dots data is in `careless-ai/open-dots` under the OS application-support folder. Original companion SQLite history remains alongside it. New companion conversations are copied locally into the Looma workspace thread; refocus the workspace to refresh.
- Automatic screenshots remain off. Clipboard monitoring is opt-in. Personalization is explicit local preference recall, not model training.
- The workspace model picker routes to the selected provider. The selection also becomes the puppy’s cloud provider. Custom persona prompts and conversation history remain local under the questions-only privacy choice.

## Verification

```sh
npm run typecheck
npm test
npm run build:workspace
DATA_DIR=/tmp/looma-server-tests workspace/server/.venv/bin/python -m pytest workspace/server/tests -q
npm run test:workspace
LOOMA_SKIP_WORKSPACE=1 npm run test:smoke
```

The workspace smoke test uses an isolated profile and a local mock answer. It verifies session bootstrap, unauthorized API rejection, sandbox isolation and streamed chat through the desktop bridge. It does not prove physical microphone/wake-word performance or external API availability.

## Upstream

Open Dots source is retained under `workspace/client` and `workspace/server`. See `workspace/UPSTREAM.md` for its pinned revision and `workspace/UPSTREAM-LICENSE` for MIT attribution. Looma changes include desktop packaging, privacy-limited model bridge, companion history, cream theme and puppy assets. Original companion implementation notes are under `docs/`.

## AI providers (0.3)

Settings → AI providers supports Google Gemini, OpenAI GPT, xAI Grok, DeepSeek and Anthropic Claude. Add each provider’s own API key, then use Save & connect to verify it and discover models available to the account. Refresh models updates the list. Missing keys leave models visibly disabled. A saved/verified key does not guarantee inference quota or access to every listed model; errors are shown without silently switching providers.

Keys are held in Electron main-process memory and encrypted in `cloud-providers.enc` using OS safeStorage. The existing Google key is reused. The Python server forwards credential changes only over its authenticated loopback bridge and does not store them. Only the current question and a fixed Looma instruction are sent for cloud replies; no conversation history, MCP results or personal memory is uploaded. GPT/xAI use Responses, DeepSeek Chat Completions, Claude Messages, and Gemini its native API/Live connection. Other text models use the existing local speaker; adding a model does not automatically install its realtime voice service.

Provider adapters and failure paths are covered with mocked API tests. Google and Loom have existing credentials; OpenAI, xAI, DeepSeek and Anthropic require user-supplied keys before live inference can be verified. API billing is managed separately by each provider.

Official implementation references: [OpenAI text generation](https://developers.openai.com/api/docs/guides/text), [xAI API](https://docs.x.ai/developers/models), [Gemini models](https://ai.google.dev/api/models), [DeepSeek API](https://api-docs.deepseek.com/).

### Speech included in the macOS installer

Version 0.3.2 includes multilingual Whisper small (English and Malayalam) and the fast English wake-phrase model. No separate recognition-model download is needed after installation. Recognition stays local. The installer is larger because it includes these models. Microphone permission is still required; in the new workspace Settings, choose **Enable voice assistant**. This turns on listening, the wake phrase and spoken replies together. Meera is a separate local speech output runtime; systems without it use the configured available speaker.

For a macOS release, place the official whisper.cpp `ggml-small.bin` and `ggml-tiny.en.bin` in `bundled-models`, run `node scripts/verify-speech-models.mjs`, and run `python3 scripts/bundle-speech-runtime.py /path/to/whisper.cpp` on the target architecture before packaging. The script builds a standalone CPU whisper.cpp runtime without Homebrew library dependencies. These macOS binaries must not be used in a Windows package.

### Clear playful voice (0.3.3)

The Mac bundle includes the online speaker executable. The playful voice uses Malayalam Sobhana or English Ana with a gentle +8 Hz pitch adjustment and a relaxed speaking rate. Neural replies play as one utterance. Online voice errors are reported instead of silently replacing it with a basic robotic voice. Internet access is required for this speaker; reply text is processed by the speech service.

### Additional release installers

Run the Windows installer and Intel Mac installer workflows from GitHub Actions with an existing release tag (for example `v0.3.4`). Each workflow builds its server, speaker and Whisper executable on the target OS, verifies recognition-model checksums, runs typecheck and unit tests, and uploads the installer and SHA-256 checksum to that release. Windows packages target x64; Intel Mac packages target x86_64. Choose the `arm64` DMG for Apple Silicon. These early builds are unsigned on Windows and ad-hoc signed on Mac.

### Real 3D companion development

The pet renderer loads an embedded skeletal GLB with an animation mixer, transparent WebGL canvas and 30 FPS cap. `scripts/build-baby-puppy.py` builds an editable Blender prototype with independent limbs, ears, jaw and tail. This procedural prototype is stylized and **does not match the requested photographic puppy**; it should not be treated as the final approved artwork.

For the requested realism, supply a licensed model with detailed fur/skin materials and facial controls. Retarget its clips in Blender to `Idle`, `Walking`, `Watching`, `Thinking`, `Warning`, `Talking`, `Happy`, `Sleeping`, plus optional `Sit`, `Stretch`, `Spin`, `Cuddle`. Export an embedded GLB and run `node scripts/import-puppy-model.mjs MODEL.glb`. The importer rejects missing rigs, required clips and external resources. Do not distribute a marketplace asset or its editable source without checking its licence. The rejected photographic puppet files are development experiments, not a true 3D model.


## JARVIS Stage 01 foundation

The supplied foundation PDF guides a modular local assistant: model responses, local actions, and room-device control remain separate. Smart room settings now connect to a LAN Home Assistant server. Add spoken aliases for lights, switches, scenes/scripts, climate or media entities, or learned Broadlink remote commands. Home Assistant must already be installed and devices paired; Looma does not discover or provision Broadlink hardware directly.

Room credentials are encrypted using the operating system's secure storage. Named room commands use deterministic local routing and never go to the online model. A successful service call reports dispatch, not verified physical appliance operation. Built-in local actions include app opening, selected-folder filename search, tasks, reminders, and optional daily briefings. Scenes/scripts can provide routines. General autonomous desktop operation and context-triggered room automation are not implemented.

Examples: “turn on desk lamp”, “dim desk lamp to 35 percent”, “turn projector off”, “run movie time”. Save a matching alias and enable room commands first. Use a Home Assistant long-lived token; device listings display friendly names without raw JSON.

The new Blender puppy remains a review candidate in `assets/natural-puppy-friendly`, with 28 bones and 12 actions. Its dense native Blender hair does not export into GLB; the desktop version uses skinned ribbons and baked coat maps. This candidate has not replaced the installed avatar.

### Golden puppy update (0.3.9)

The desktop companion now loads the supplied golden puppy as a skinned 3D model with a repaired surface, higher-detail front texture, portable fur and simple animated states. In the macOS **Looma → Puppy appearance** menu, choose **Animated 3D puppy** or **Original puppy picture**. The latter also provides a fallback when 3D rendering is unavailable.

This asset is an approximation: its seated stepping is not a natural four-legged gait, and the sides and facial deformation still need refinement. Editable source and visual checks are in `assets/user-golden/looma-golden-desktop.blend` and `assets/user-golden/QUALITY-REVIEW.md`.

### Looma 1.0.0

The original cartoon puppy is the default; the 3D character remains optional in the app menu. Interrupt a spoken reply, then say “continue” to resume cached audio at the saved position. Native system voices resume from the last reported word boundary.

Settings → AI providers includes Hugging Face (`HF_TOKEN`, encrypted on this device) and a local llama.cpp connection. Muse Glimmer routes to `meta-models/Muse-Glimmer-30B:together`; provider access and billing still apply. A token supplied through `HF_TOKEN` at launch is imported into encrypted storage and removed from the environment before child processes start. It is never checked into the repository.

Local Muse GGUF requires downloaded weights and a current llama.cpp server on loopback port 8080, with its chat template enabled. Reasoning content is separated from spoken output.
