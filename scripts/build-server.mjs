import {spawnSync} from 'node:child_process';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
const cwd=join(process.cwd(),'workspace/server');
const python=join(cwd,process.platform==='win32'?'.venv/Scripts/python.exe':'.venv/bin/python');
const result=spawnSync(python,['-m','PyInstaller','--noconfirm','--clean','--name','looma-server','--collect-all','uvicorn','--collect-all','app','desktop.py'],{cwd,stdio:'inherit',env:{...process.env,PYINSTALLER_CONFIG_DIR:join(tmpdir(),'looma-pyinstaller-cache')}});
process.exit(result.status??1);
