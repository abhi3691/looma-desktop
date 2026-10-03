import {createHash} from 'node:crypto';
import {mkdir,writeFile,readdir,copyFile,chmod,rm} from 'node:fs/promises';
import {join} from 'node:path';import {tmpdir} from 'node:os';import {execFileSync} from 'node:child_process';
const builds={
 'darwin-arm64':['macos-arm64.tar.gz','1ad3f9eff80edb9dbef4259ad564d1720612ef7eea48fa4afed0e54f5f3d5711'],
 'darwin-x64':['macos-x64.tar.gz','305f0e3a17d2c01eb205cd0a62128357f1ec3b55329cb084d94e5ec0115d7a3b'],
 'win32-x64':['win-cpu-x64.zip','14cf1303ca9ac3abd94816850532f9f9a69ac66fbaca3776fc6f9061c2fac1d1']
};
const build=builds[process.platform+'-'+process.arch];if(!build)throw Error('Unsupported local runtime platform');
const [suffix,sha]=build;const response=await fetch('https://github.com/ggml-org/llama.cpp/releases/download/b11146/llama-b11146-bin-'+suffix);if(!response.ok)throw Error('Runtime download failed');const bytes=Buffer.from(await response.arrayBuffer());if(createHash('sha256').update(bytes).digest('hex')!==sha)throw Error('Runtime checksum mismatch');
const temp=join(tmpdir(),'looma-llama-b11146-'+process.pid);await mkdir(temp,{recursive:true});const archive=join(temp,suffix.endsWith('.zip')?'runtime.zip':'runtime.tar.gz');await writeFile(archive,bytes);const extract=join(temp,'extract');await mkdir(extract);
if(process.platform==='win32')execFileSync('powershell.exe',['-NoProfile','-Command',`Expand-Archive -LiteralPath '${archive.replaceAll("'","''")}' -DestinationPath '${extract.replaceAll("'","''")}'`]);else execFileSync('tar',['-xzf',archive,'-C',extract]);
await rm('bundled-local-runtime',{recursive:true,force:true});await mkdir('bundled-local-runtime');let server=false;
async function scan(dir){for(const entry of await readdir(dir,{withFileTypes:true})){const path=join(dir,entry.name);if(entry.isDirectory())await scan(path);else if(entry.name==='llama-server'||entry.name==='llama-server.exe'||/\.(dylib|dll)$/.test(entry.name)){await copyFile(path,join('bundled-local-runtime',entry.name));if(process.platform!=='win32')await chmod(join('bundled-local-runtime',entry.name),0o755);if(entry.name.startsWith('llama-server'))server=true;}}}
await scan(extract);if(!server)throw Error('Server executable missing');const license=await fetch('https://raw.githubusercontent.com/ggml-org/llama.cpp/7fe450e19/LICENSE');if(!license.ok)throw Error('Runtime licence missing');await writeFile('bundled-local-runtime/LICENSE',await license.text());await rm(temp,{recursive:true,force:true});console.log('Bundled verified llama.cpp b11146 for',process.platform,process.arch);
