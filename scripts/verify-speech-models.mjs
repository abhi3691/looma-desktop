import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
for(const [name,expected] of [['ggml-small.bin','55356645c2b361a969dfd0ef2c5a50d530afd8d5'],['ggml-tiny.en.bin','c78c86eb1a8faa21b369bcd33207cc90d64ae9df']]){
 const hash=createHash('sha1');for await(const chunk of createReadStream('bundled-models/'+name))hash.update(chunk);
 if(hash.digest('hex')!==expected)throw Error('Speech model checksum mismatch: '+name);
 console.log('Verified '+name);
}
