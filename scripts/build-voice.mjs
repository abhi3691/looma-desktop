import {spawnSync} from 'node:child_process';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
const python=join(process.cwd(),'workspace/server',process.platform==='win32'?'.venv/Scripts/python.exe':'.venv/bin/python');
const result=spawnSync(python,['-m','PyInstaller','--noconfirm','--clean','--name','edge-tts','--distpath','voice-runtime/dist','--workpath','voice-runtime/build','--specpath','voice-runtime','--collect-all','edge_tts','voice-runtime/edge-speaker.py'],{stdio:'inherit',env:{...process.env,PYINSTALLER_CONFIG_DIR:join(tmpdir(),'looma-pyinstaller-cache')}});
process.exit(result.status??1);
