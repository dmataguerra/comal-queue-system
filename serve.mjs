import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), 'dist');
const types = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml'};
const server = http.createServer(async (req,res) => {
 try {
   const pathname = decodeURIComponent(new URL(req.url,'http://localhost').pathname);
   const target = resolve(root,'.'+(pathname === '/' ? '/index.html' : pathname));
   if(!target.startsWith(root+sep)){res.writeHead(403);res.end();return;}
   const body=await readFile(target);res.writeHead(200,{'Content-Type':types[extname(target)]||'application/octet-stream','Cache-Control':'no-store'});res.end(body);
 } catch {res.writeHead(404);res.end('Not found');}
});
server.listen(4173,'127.0.0.1',()=>console.log('Comal++ mockup: http://127.0.0.1:4173'));
