"""Optional online Sobhana voice client; reply text is sent to Microsoft when selected."""
from pathlib import Path
import os, sys, subprocess, venv
if sys.platform == 'darwin':
    root=Path.home()/'Library/Application Support/careless-ai'
elif sys.platform == 'win32':
    root=Path(os.environ['APPDATA'])/'careless-ai'
else:
    root=Path.home()/'.config/careless-ai'
environment=root/'piper-env'
python=environment/('Scripts/python.exe' if sys.platform=='win32' else 'bin/python')
if not python.exists():
    venv.create(environment,with_pip=True)
subprocess.run([str(python),'-m','pip','install','edge-tts==7.2.8'],check=True)
print('Online voice client ready. Select Sobhana in Careless AI Settings.')
