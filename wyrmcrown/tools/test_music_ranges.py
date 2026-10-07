"""Verify byte-range serving required by browser music seeking and streaming."""
import functools
import threading
import urllib.request
import urllib.error
from pathlib import Path
from serve import Handler, Server

root=Path(__file__).resolve().parents[2]
asset=root/'wyrmcrown/audio/music/human_home.mp3'
data=asset.read_bytes()
server=Server(('127.0.0.1',0),functools.partial(Handler,directory=str(root)))
thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
url=f'http://127.0.0.1:{server.server_address[1]}/wyrmcrown/audio/music/human_home.mp3'
try:
    for header,start,end in [('bytes=0-99',0,99),('bytes=100-199',100,199),('bytes=-100',len(data)-100,len(data)-1),('bytes=100-',100,len(data)-1)]:
        with urllib.request.urlopen(urllib.request.Request(url,headers={'Range':header})) as response:
            assert response.status==206
            assert response.headers['Accept-Ranges']=='bytes'
            assert response.headers['Content-Range']==f'bytes {start}-{end}/{len(data)}'
            assert response.read()==data[start:end+1]
    for header in ['bytes=999999999-','bytes=100-50','bytes=-0','bytes=0-1,4-5','invalid']:
        try:urllib.request.urlopen(urllib.request.Request(url,headers={'Range':header}));raise AssertionError(header)
        except urllib.error.HTTPError as error:
            assert error.code==416 and error.headers['Content-Range']==f'bytes */{len(data)}'
    with urllib.request.urlopen(urllib.request.Request(url,method='HEAD')) as response:
        assert response.status==200 and response.headers['Accept-Ranges']=='bytes'
        assert int(response.headers['Content-Length'])==len(data) and response.read()==b''
    with urllib.request.urlopen(urllib.request.Request(url,headers={'Range':'bytes=0-99','If-Range':'outdated'})) as response:
        assert response.status==200 and response.read()==data
    print('PASS music server: exact partial bytes, suffix/open ranges, invalid range rejection, HEAD and If-Range fallback.')
finally:
    server.shutdown();server.server_close();thread.join()
