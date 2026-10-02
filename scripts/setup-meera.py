"""Install optional local Loomaer/Meera speech runtime. Requires Python 3.10+."""
import sys, os, pathlib, subprocess, urllib.request, json, hashlib
if sys.version_info < (3, 10):
    raise SystemExit('Python 3.10+ is required')
base = pathlib.Path(os.environ.get('APPDATA', pathlib.Path.home() / 'AppData/Roaming')) / 'careless-ai' if sys.platform == 'win32' else pathlib.Path.home() / ('Library/Application Support/careless-ai' if sys.platform == 'darwin' else '.config/careless-ai')
env = base / 'piper-env'
subprocess.run([sys.executable, '-m', 'venv', str(env)], check=True)
python = env / ('Scripts/python.exe' if sys.platform == 'win32' else 'bin/python')
subprocess.run([str(python), '-m', 'pip', 'install', 'piper-tts==1.8.0'], check=True)
models = base / 'models'
models.mkdir(parents=True, exist_ok=True)
repo = 'https://huggingface.co/rhasspy/piper-voices'
metadata = json.load(urllib.request.urlopen('https://huggingface.co/api/models/rhasspy/piper-voices/tree/main/ml/ml_IN/meera/medium'))
for name in ['ml_IN-meera-medium.onnx', 'ml_IN-meera-medium.onnx.json', 'MODEL_CARD']:
    target = models / (name if name != 'MODEL_CARD' else 'Meera-MODEL_CARD.md')
    staging = target.with_suffix(target.suffix + '.download')
    urllib.request.urlretrieve(repo + '/resolve/main/ml/ml_IN/meera/medium/' + name, staging)
    record = next(x for x in metadata if x['path'].endswith('/' + name))
    expected = record.get('lfs', {}).get('oid')
    if expected and hashlib.sha256(staging.read_bytes()).hexdigest() != expected:
        staging.unlink()
        raise SystemExit('Voice model checksum mismatch')
    staging.replace(target)
print('Meera installed. Restart Looma and select Soft feminine in Settings.')
