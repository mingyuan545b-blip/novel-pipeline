import json
import sys
import asyncio
import os
import edge_tts

async def main():
    param_file = sys.argv[1]
    with open(param_file, 'r', encoding='utf-8') as f:
        params = json.load(f)

    text = params['text']
    voice = params.get('voice', 'zh-CN-YunxiNeural')
    output = params['output']
    rate = params.get('rate', '+0%')
    volume = params.get('volume', '+0%')
    pitch = params.get('pitch', '+0Hz')
    subtitle = params.get('subtitle', '')
    proxy = params.get('proxy', '')

    if proxy:
        os.environ['HTTP_PROXY'] = proxy
        os.environ['HTTPS_PROXY'] = proxy

    communicate = edge_tts.Communicate(text, voice, rate=rate, volume=volume, pitch=pitch)
    if subtitle:
        await communicate.save(output, subtitle)
    else:
        await communicate.save(output)

    result = {'success': True, 'output': output}
    if subtitle:
        result['subtitle'] = subtitle
    result_file = params.get('resultFile', '')
    if result_file:
        with open(result_file, 'w', encoding='utf-8') as f:
            json.dump(result, f, ensure_ascii=False)

if __name__ == "__main__":
    asyncio.run(main())
