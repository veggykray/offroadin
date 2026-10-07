"""Local-only game/audition server; larger backlog for many script/audio requests."""
import argparse
import functools
import http.server
import datetime as dt
import json
import threading
import webbrowser
import os
import re
from pathlib import Path

class Server(http.server.ThreadingHTTPServer):
    request_queue_size=128
    daemon_threads=True

class Handler(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*args): pass
    def end_headers(self):
        if getattr(self,'_accept_ranges',False):self.send_header('Accept-Ranges','bytes')
        super().end_headers()
    def send_head(self):
        path=Path(self.translate_path(self.path))
        self._accept_ranges=path.is_file() and path.suffix.lower() in ['.mp3','.wav','.ogg','.flac','.m4a']
        self._range_length=None
        header=self.headers.get('Range')
        if not self._accept_ranges or not header:return super().send_head()
        try:stream=path.open('rb')
        except OSError:self.send_error(404);return None
        stat=os.fstat(stream.fileno());size=stat.st_size
        modified=self.date_time_string(stat.st_mtime)
        if self.headers.get('If-Range') not in [None,modified]:
            stream.close();return super().send_head()
        match=re.fullmatch(r'bytes=(\d*)-(\d*)',header.strip())
        start,end=0,-1
        if match and any(match.groups()):
            first,last=match.groups()
            if first:start=int(first);end=min(int(last) if last else size-1,size-1)
            elif int(last)>0:start=max(0,size-int(last));end=size-1
        if not 0<=start<=end<size:
            stream.close();self.send_response(416)
            self.send_header('Content-Range',f'bytes */{size}');self.send_header('Content-Length','0');self.end_headers();return None
        self._range_length=end-start+1
        self.send_response(206)
        self.send_header('Content-Type',self.guess_type(str(path)))
        self.send_header('Content-Length',str(self._range_length))
        self.send_header('Content-Range',f'bytes {start}-{end}/{size}')
        self.send_header('Last-Modified',modified);self.end_headers()
        stream.seek(start);return stream
    def copyfile(self,source,output):
        remaining=getattr(self,'_range_length',None)
        if remaining is None:return super().copyfile(source,output)
        while remaining:
            block=source.read(min(256*1024,remaining))
            if not block:break
            output.write(block);remaining-=len(block)
    def do_POST(self):
        if self.path!='/audio-review':
            self.send_error(404);return
        expected='http://'+self.headers.get('Host','')
        if self.headers.get('Origin')!=expected:
            self.send_error(403);return
        try:
            size=int(self.headers.get('Content-Length','0'))
            if not 0<size<=32768:raise ValueError('Review is too large')
            body=json.loads(self.rfile.read(size))
            keys={f+'_'+r for f in ['human','elf','ice','undead'] for r in ['wizard','dragon']}
            choices={}
            for key,value in body.get('choices',{}).items():
                if key not in keys or value.get('candidate') not in ['','1','2']:raise ValueError('Invalid candidate')
                choices[key]={'candidate':value.get('candidate',''),'notes':str(value.get('notes',''))[:2000]}
            review={'schema_version':1,'reviewed_at':dt.datetime.now(dt.timezone.utc).isoformat(),'choices':choices,'source':'audition page selections'}
            dest=Path(self.directory)/'wyrmcrown/audio/production/browser-review.json'
            temp=dest.with_suffix('.tmp')
            temp.write_text(json.dumps(review,indent=2)+'\n',encoding='utf-8')
            temp.replace(dest)
            result=json.dumps({'saved':len([c for c in choices.values() if c['candidate']])}).encode()
            self.send_response(200);self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(result)));self.end_headers();self.wfile.write(result)
        except (ValueError,TypeError,KeyError) as error:self.send_error(400,str(error))

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port',type=int,default=8766)
    parser.add_argument('--open',action='store_true',help='Open the game in your default browser')
    args=parser.parse_args()
    root=Path(__file__).resolve().parents[2]
    handler=functools.partial(Handler,directory=str(root))
    server=Server(('127.0.0.1',args.port),handler)
    port=server.server_address[1]
    url=f'http://127.0.0.1:{port}/wyrmcrown/index.html'
    print(f'Dragon Wars: {url}',flush=True)
    print(f'Audio review: http://127.0.0.1:{port}/wyrmcrown/tools/audio-review.html',flush=True)
    if args.open:
        threading.Timer(.3,lambda:webbrowser.open(url)).start()
    try:server.serve_forever()
    except KeyboardInterrupt:pass
    finally:server.server_close()

if __name__=='__main__':main()
