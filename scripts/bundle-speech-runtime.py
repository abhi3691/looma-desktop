"""Build a standalone macOS whisper.cpp CLI from an explicitly supplied checkout.
Usage: python3 scripts/bundle-speech-runtime.py /path/to/whisper.cpp
Requires CMake and the Xcode command-line compiler.
"""
from pathlib import Path
import subprocess,shutil,sys
if len(sys.argv)!=2:raise SystemExit('Provide the whisper.cpp source checkout path')
source=Path(sys.argv[1]).resolve();build=source/'build-looma'
subprocess.run(['cmake','-S',str(source),'-B',str(build),'-DBUILD_SHARED_LIBS=OFF','-DGGML_NATIVE=OFF','-DGGML_METAL=OFF','-DGGML_BLAS=OFF','-DGGML_OPENMP=OFF','-DWHISPER_BUILD_TESTS=OFF'],check=True)
subprocess.run(['cmake','--build',str(build),'--config','Release','--target','whisper-cli','-j','8'],check=True)
out=Path('bundled-speech-runtime');out.mkdir(exist_ok=True)
shutil.copy2(build/'bin/whisper-cli',out/'whisper-cli')
subprocess.run(['codesign','--force','--sign','-',str(out/'whisper-cli')],check=True)
shutil.copy2(source/'LICENSE',out/'WHISPER-LICENSE')
