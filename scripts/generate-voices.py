"""Regenerate bundled synthetic Indian-language dialogue; HTTPS checks stay enabled."""
import asyncio,os,json,hashlib,pathlib,subprocess
import edge_tts
import edge_tts.communicate as module
if os.environ.get('SSL_CERT_FILE'):
    module._SSL_CTX.load_verify_locations(os.environ['SSL_CERT_FILE'])
voices={'mr-IN':'mr-IN-ManoharNeural','hi-IN':'hi-IN-SwaraNeural','en-IN':'en-IN-PrabhatNeural'}
lines=json.loads(subprocess.check_output(['node','--input-type=module','-e',"import {lines} from './src/dialogue.js';console.log(JSON.stringify(lines))"],text=True))
async def main():
    output=pathlib.Path('public/audio');output.mkdir(exist_ok=True);manifest={'synthetic':True,'provider':'Microsoft Edge neural speech','clips':[]}
    for locale,texts in lines.items():
        for index,text in enumerate(texts):
            file=f'{locale}-{index}.mp3';target=output/file
            await edge_tts.Communicate(text,voice=voices[locale],rate='-5%',proxy=os.environ.get('HTTPS_PROXY')).save(str(target)+'.tmp')
            if pathlib.Path(str(target)+'.tmp').stat().st_size<1000:raise RuntimeError('Empty voice clip')
            pathlib.Path(str(target)+'.tmp').replace(target)
            manifest['clips'].append({'file':file,'locale':locale,'voice':voices[locale],'text':text,'sha256':hashlib.sha256(target.read_bytes()).hexdigest()})
            print('Generated',file)
    (output/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
asyncio.run(main())
