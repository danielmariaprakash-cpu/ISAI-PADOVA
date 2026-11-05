'use strict';
/* Indian Student Association Italy – Padova — complete web application. Zero dependencies. Run: node server.js */
const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto'),zlib=require('zlib'),net=require('net'),tls=require('tls');
const ROOT=__dirname,PUB=path.join(ROOT,'public');
try{fs.readFileSync(path.join(ROOT,'.env'),'utf8').split(/\r?\n/).forEach(l=>{const m=l.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);if(m&&m[2]&&!(m[1] in process.env))process.env[m[1]]=m[2].replace(/^["']|["']$/g,'')})}catch(e){}
const E=process.env,PORT=+E.PORT||3000,OWNER=E.OWNER_EMAIL||'isai.padova@gmail.com',DATA=path.resolve(E.DATA_DIR||path.join(ROOT,'data')),DRIVE=path.resolve(E.DRIVE_DIR||path.join(DATA,'drive-sync'));
const XNAME='Indian-Student-Association-Italy-Padova-Student-Records.xlsx',FULL='Indian Student Association Italy - Padova';
fs.mkdirSync(DATA,{recursive:true});
/* ---------- database (JSON file, atomic writes) ---------- */
const DBF=path.join(DATA,'db.json');let db={students:[],users:[],log:[],config:{}};
try{db=JSON.parse(fs.readFileSync(DBF,'utf8'))}catch(e){}
const save=()=>{const t=DBF+'.tmp';fs.writeFileSync(t,JSON.stringify(db));fs.renameSync(t,DBF)};
const now=()=>new Date().toLocaleString('sv-SE',{timeZone:'Europe/Rome'});
let SECRET;const SK=path.join(DATA,'secret.key');try{SECRET=fs.readFileSync(SK,'utf8')}catch(e){SECRET=crypto.randomBytes(48).toString('base64url');fs.writeFileSync(SK,SECRET,{mode:0o600})}
/* ---------- crypto helpers ---------- */
const hashPw=(pw,salt)=>crypto.scryptSync(String(pw),salt,32).toString('base64');
const mkHash=pw=>{const s=crypto.randomBytes(16).toString('hex');return[s,hashPw(pw,s)]};
const eq=(a,b)=>{const x=Buffer.from(String(a)),y=Buffer.from(String(b));return x.length===y.length&&crypto.timingSafeEqual(x,y)};
const b64=s=>Buffer.from(s).toString('base64url'),mac=s=>crypto.createHmac('sha256',SECRET).update(s).digest('base64url');
const sign=p=>{const x=b64('{"alg":"HS256"}')+'.'+b64(JSON.stringify(p));return x+'.'+mac(x)};
function verify(t){const[a,b,s]=String(t).split('.');if(!s||!eq(mac(a+'.'+b),s))throw 0;const p=JSON.parse(Buffer.from(b,'base64url'));if(p.exp<Date.now()/1000)throw 0;return p}
function genCode(){const S=['ABCDEFGHJKLMNPQRSTUVWXYZ','abcdefghijkmnopqrstuvwxyz','23456789','!@#$%^&*-_+=?'],all=S.join(''),o=[];for(let i=0;i<16;i++){const set=i<4?S[i]:all;o.push(set[crypto.randomInt(set.length)])}for(let i=15;i>0;i--){const j=crypto.randomInt(i+1);[o[i],o[j]]=[o[j],o[i]]}return o.join('')}
function newCode(){const c=genCode(),[s,h]=mkHash(c);db.config.codeSalt=s;db.config.codeHash=h;save();fs.writeFileSync(path.join(DATA,'SECURITY-CODE.txt'),'16-character security code (needed to change the admin password):\n\n'+c+'\n\nMove this to a safe place and DELETE this file.\n',{mode:0o600});
 console.log('\n  ★ SECURITY CODE: '+c+'  (also saved in data/SECURITY-CODE.txt — keep it safe, then delete the file)\n');mail('Your 16-character security code','Universal security code (required to change the admin password):\n\n'+c+'\n\nKeep it private.').catch(()=>{});return c}
/* ---------- e-mail alerts (Gmail SMTP app-password, optional; always logged to data/mail-outbox.log) ---------- */
async function sendSmtp(subject,text){const host=E.SMTP_HOST||'smtp.gmail.com',port=+E.SMTP_PORT||465,secure=E.SMTP_SECURE!=='false',user=E.SMTP_USER,pass=E.SMTP_PASS;
 const sock=await new Promise((ok,no)=>{const s=secure?tls.connect({host,port,servername:host},()=>ok(s)):net.connect({host,port},()=>ok(s));s.once('error',no);s.setTimeout(20000,()=>{s.destroy();no(new Error('SMTP timeout'))})});
 const q=[],ws=[];let buf='';sock.on('data',d=>{buf+=d;let m;while((m=buf.match(/^(?:\d{3}-.*\r\n)*\d{3} .*\r\n/))){buf=buf.slice(m[0].length);ws.length?ws.shift()(m[0]):q.push(m[0])}});
 const read=()=>q.length?Promise.resolve(q.shift()):new Promise(r=>ws.push(r)),cmd=async(c,ok)=>{if(c!==null)sock.write(c+'\r\n');const r=await read();if(!r.startsWith(ok))throw new Error('SMTP: '+r.trim());};
 const body=Buffer.from(text).toString('base64').replace(/(.{76})/g,'$1\r\n'),msg=['From: '+FULL+' <'+user+'>','To: '+OWNER,'Subject: =?UTF-8?B?'+Buffer.from('['+FULL+'] '+subject).toString('base64')+'?=','MIME-Version: 1.0','Content-Type: text/plain; charset=UTF-8','Content-Transfer-Encoding: base64','',body].join('\r\n');
 try{await cmd(null,'220');await cmd('EHLO localhost','250');await cmd('AUTH LOGIN','334');await cmd(Buffer.from(user).toString('base64'),'334');await cmd(Buffer.from(pass).toString('base64'),'235');await cmd('MAIL FROM:<'+user+'>','250');await cmd('RCPT TO:<'+OWNER+'>','250');await cmd('DATA','354');await cmd(msg+'\r\n.','250');await cmd('QUIT','221')}finally{sock.destroy()}}
async function mail(subject,text){let st='logged only (SMTP not configured)';if(E.SMTP_USER&&E.SMTP_PASS){try{await sendSmtp(subject,text);st='SENT to '+OWNER}catch(e){st='FAILED: '+e.message}}
 fs.appendFileSync(path.join(DATA,'mail-outbox.log'),'=== '+now()+' | '+subject+' | '+st+'\n'+(/security code/i.test(subject)?'(body hidden)':text)+'\n\n')}
/* ---------- minimal .xlsx writer (no dependencies) ---------- */
const CRC=(()=>{const t=[];for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0}return b=>{let c=0xFFFFFFFF;for(const x of b)c=t[(c^x)&255]^(c>>>8);return(c^0xFFFFFFFF)>>>0}})();
function zip(files){const parts=[],cd=[];let off=0;for(const[name,data]of files){const n=Buffer.from(name),d=Buffer.from(data),c=CRC(d),h=Buffer.alloc(30);h.writeUInt32LE(0x04034b50,0);h.writeUInt16LE(20,4);h.writeUInt32LE(c,14);h.writeUInt32LE(d.length,18);h.writeUInt32LE(d.length,22);h.writeUInt16LE(n.length,26);parts.push(h,n,d);
 const e=Buffer.alloc(46);e.writeUInt32LE(0x02014b50,0);e.writeUInt16LE(20,4);e.writeUInt16LE(20,6);e.writeUInt32LE(c,16);e.writeUInt32LE(d.length,20);e.writeUInt32LE(d.length,24);e.writeUInt16LE(n.length,28);e.writeUInt32LE(off,42);cd.push(e,n);off+=30+n.length+d.length}
 const cds=Buffer.concat(cd),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(files.length,8);end.writeUInt16LE(files.length,10);end.writeUInt32LE(cds.length,12);end.writeUInt32LE(off,16);return Buffer.concat([...parts,cds,end])}
const X=s=>String(s??'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])),col=i=>String.fromCharCode(65+i);
function xlsx(){const hd=['Created','Name','Surname','Department','Date of birth','Address','Phone','Email'],rs=[hd].concat(db.students.map(s=>[s.created,s.name,s.surname,s.dept,s.dob,s.address,s.phone,s.email]));
 const sheet='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols><col min="1" max="8" width="22" customWidth="1"/></cols><sheetData>'+rs.map((r,i)=>'<row r="'+(i+1)+'">'+r.map((v,j)=>'<c r="'+col(j)+(i+1)+'" t="inlineStr"><is><t>'+X(v)+'</t></is></c>').join('')+'</row>').join('')+'</sheetData></worksheet>';
 return zip([['[Content_Types].xml','<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>'],
 ['_rels/.rels','<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
 ['xl/workbook.xml','<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Students" sheetId="1" r:id="rId1"/></sheets></workbook>'],
 ['xl/_rels/workbook.xml.rels','<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>'],['xl/worksheets/sheet1.xml',sheet]])}
/* ---------- Drive-folder sync: Excel + JSON backup (point DRIVE_DIR at a Google Drive for desktop folder to sync to Drive) ---------- */
const snapshot=()=>JSON.stringify({exported:now(),students:db.students,log:db.log.slice(-500),users:db.users.map(u=>({u:u.u,role:u.role}))},null,1);
function sync(){fs.mkdirSync(DRIVE,{recursive:true});fs.writeFileSync(path.join(DRIVE,XNAME),xlsx());const s=snapshot();fs.writeFileSync(path.join(DRIVE,'Backup-latest.json'),s);
 const day='Backup-'+new Date().toISOString().slice(0,10)+'.json';fs.writeFileSync(path.join(DRIVE,day),s);fs.readdirSync(DRIVE).filter(f=>/^Backup-\d{4}-\d\d-\d\d\.json$/.test(f)).sort().slice(0,-14).forEach(f=>fs.unlinkSync(path.join(DRIVE,f)));
 db.config.lastSync=now();save()}
let st;const later=()=>{clearTimeout(st);st=setTimeout(()=>{try{sync()}catch(e){console.error('sync',e.message)}},1200)};
function status(){let files=[];try{files=fs.readdirSync(DRIVE).map(f=>({name:f,kb:Math.max(1,Math.round(fs.statSync(path.join(DRIVE,f)).size/1024))}))}catch(e){}return{students:db.students.length,lastSync:db.config.lastSync||'',folder:DRIVE,drive:!!E.DRIVE_DIR,files}}
/* ---------- security helpers ---------- */
const ipOf=req=>E.TRUST_PROXY==='1'?(String(req.headers['x-forwarded-for']||'').split(',')[0].trim()||req.socket.remoteAddress):req.socket.remoteAddress;
class Err extends Error{constructor(s,m){super(m);this.status=s}}
const mem=new Map();function hitRate(k,max,ms){const n=Date.now(),a=(mem.get(k)||[]).filter(t=>n-t<ms);if(a.length>=max)throw new Err(429,'Too many attempts. Please try later.');a.push(n);mem.set(k,a)}
const fails=new Map(),isLocked=(k,max)=>{const f=fails.get(k);return f&&f.until>Date.now()&&f.c>=max},bump=(k)=>{const f=fails.get(k),n=Date.now(),c=(f&&f.until>n?f.c:0)+1;fails.set(k,{c,until:n+900000});return c},clearF=k=>fails.delete(k);
const addLog=(ev,user,req,dev)=>{db.log.push([now(),ev,user||'',req?ipOf(req):'',String(dev||'').slice(0,300)]);if(db.log.length>2000)db.log.splice(0,500);save()};
const str=(v,n)=>String(v==null?'':v).replace(/[\u0000-\u001f]/g,' ').trim().slice(0,n);
function clean(d){const r={name:str(d.name,60),surname:str(d.surname,60),dept:str(d.dept,80),dob:str(d.dob,10),address:str(d.address,200),phone:str(d.phone,20),email:str(d.email,80)};
 if(!r.name||!r.surname||!r.dept||!r.dob||!r.address||!r.phone)throw new Err(400,'Please fill all required fields.');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(r.dob)||r.dob>new Date().toISOString().slice(0,10))throw new Err(400,'Invalid date of birth.');
 if(!/^\+?[0-9 ()-]{7,20}$/.test(r.phone))throw new Err(400,'Invalid phone number.');
 if(r.email&&!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(r.email))throw new Err(400,'Invalid email.');return r}
function auth(req,admin){const t=(req.headers.authorization||'').replace(/^Bearer /,'');let p;try{p=verify(t)}catch(e){throw new Err(401,'Session expired. Please log in again.')}
 const u=db.users.find(x=>x.u===p.u);if(!u||u.hash.slice(0,12)!==p.v)throw new Err(401,'Session expired. Please log in again.');if(admin&&u.role!=='admin')throw new Err(403,'Admin only.');return u}
/* ---------- API ---------- */
const H={
 enroll(req,d){if(d.hp)return{ok:true};hitRate('e'+ipOf(req),5,600000);hitRate('eall',60,600000);const r=clean(d),i=db.students.findIndex(s=>s.phone===r.phone);
  if(i>=0){Object.assign(db.students[i],r);save();later();return{ok:true,updated:true}}db.students.push(Object.assign({id:crypto.randomUUID(),created:now()},r));save();later();return{ok:true}},
 login(req,d){const u=str(d.u,40).toLowerCase(),ku='u:'+u,ki='i:'+ipOf(req),dev=str(d.dev,400),ip=ipOf(req);
  if(isLocked(ku,5)||isLocked(ki,10)){mail('Login locked','Too many wrong passwords. User "'+u+'" at '+now()+'\nIP: '+ip).catch(()=>{});throw new Err(429,'Too many attempts. Locked for 15 minutes.')}
  const r=db.users.find(x=>x.u.toLowerCase()===u),ok=r?eq(hashPw(String(d.p||''),r.salt),r.hash):(hashPw('x','y'),false);
  if(!ok){const n=bump(ku);bump(ki);addLog('FAILED_LOGIN',u,req,dev);if(n>=3)mail('FAILED LOGIN ATTEMPTS: '+u,n+' failed attempts at '+now()+'\nIP: '+ip+'\nDevice: '+dev).catch(()=>{});throw new Err(401,'Wrong username or password.')}
  clearF(ku);addLog('LOGIN',r.u,req,dev);let x={};try{x=JSON.parse(dev)}catch(e){}
  mail('Login alert: '+r.u,'Someone logged in to the admin panel.\n\nUser: '+r.u+' ('+r.role+')\nTime: '+now()+' (Rome)\nIP: '+ip+'\nBrowser: '+(x.ua||req.headers['user-agent']||'?')+'\nPlatform: '+(x.platform||'?')+'\nScreen: '+(x.screen||'?')+'\nLanguage / timezone: '+(x.lang||'?')+' / '+(x.tz||'?')+'\n\nNot you? Run "node server.js --new-code" and change the admin password.').catch(()=>{});
  return{t:sign({u:r.u,v:r.hash.slice(0,12),exp:Math.floor(Date.now()/1000)+21600}),u:r.u,role:r.role}},
 students(req){auth(req);return db.students},
 update(req,d){auth(req,1);const s=db.students.find(x=>x.id===d.id);if(!s)throw new Err(404,'Not found.');Object.assign(s,clean(d));addLog('STUDENT_EDITED',d.id,req);later();return{ok:true}},
 del(req,d){auth(req,1);const i=db.students.findIndex(x=>x.id===d.id);if(i<0)throw new Err(404,'Not found.');db.students.splice(i,1);addLog('STUDENT_DELETED',d.id,req);later();return{ok:true}},
 log(req){auth(req,1);return db.log.slice(-100).reverse()},
 status(req){auth(req,1);return status()},
 sync(req){const m=auth(req,1);sync();addLog('MANUAL_SYNC',m.u,req);return status()},
 pwd(req,d){const me=auth(req,1),k='code:'+me.u;if(isLocked(k,5))throw new Err(429,'Too many wrong codes. Try in 15 minutes.');const pw=String(d.pw||'');
  if(pw.length<10||pw.length>100)throw new Err(400,'New password must be 10–100 characters.');
  if(!eq(hashPw(String(d.code||'').trim(),db.config.codeSalt||'x'),db.config.codeHash||'y')){bump(k);addLog('BAD_CODE',me.u,req);mail('Wrong security code','A password change for "'+me.u+'" was attempted with a wrong security code at '+now()+'\nIP: '+ipOf(req)).catch(()=>{});throw new Err(403,'Security code is wrong.')}
  clearF(k);const[s,h]=mkHash(pw);me.salt=s;me.hash=h;addLog('PASSWORD_CHANGED',me.u,req);mail('Password changed: '+me.u,'Changed at '+now()+'\nIP: '+ipOf(req)).catch(()=>{});return{ok:true}},
 users(req){auth(req,1);return db.users.map(x=>({u:x.u,role:x.role}))},
 addUser(req,d){auth(req,1);const u=str(d.u,40),pw=String(d.p||'');if(!/^[A-Za-z0-9._-]{3,40}$/.test(u))throw new Err(400,'Username: 3–40 letters/numbers.');if(pw.length<10||pw.length>100)throw new Err(400,'Password must be 10–100 characters.');
  if(db.users.some(x=>x.u.toLowerCase()===u.toLowerCase()))throw new Err(400,'Username exists.');if(db.users.filter(x=>x.role==='user').length>=2)throw new Err(400,'Maximum 2 extra users.');
  const[s,h]=mkHash(pw);db.users.push({u,role:'user',salt:s,hash:h,created:now()});addLog('USER_ADDED',u,req);mail('User added: '+u,'At '+now()).catch(()=>{});return{ok:true}},
 rmUser(req,d){auth(req,1);const i=db.users.findIndex(x=>x.u===d.u&&x.role==='user');if(i<0)throw new Err(404,'Not found.');db.users.splice(i,1);addLog('USER_REMOVED',d.u,req);return{ok:true}}};
const readBody=req=>new Promise((ok,no)=>{let b='',n=0;req.on('data',c=>{n+=c.length;if(n>8192){no(new Err(413,'Too large'));req.destroy()}else b+=c});req.on('end',()=>{try{ok(b?JSON.parse(b):{})}catch(e){no(new Err(400,'Bad JSON'))}});req.on('error',no)});
async function api(req,res,name){if(req.method!=='POST')throw new Err(405,'Method not allowed');const o=req.headers.origin;if(o&&new URL(o).host!==req.headers.host)throw new Err(403,'Forbidden');
 if(name==='xlsx'||name==='backup'){auth(req,1);const x=name==='xlsx',b=x?xlsx():Buffer.from(snapshot());res.writeHead(200,{'Content-Type':x?'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':'application/json','Content-Disposition':'attachment; filename="'+(x?XNAME:'backup.json')+'"','Cache-Control':'no-store'});return res.end(b)}
 const f=Object.prototype.hasOwnProperty.call(H,name)&&H[name];if(!f)throw new Err(404,'Not found');const d=await readBody(req);const out=await f(req,d);res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(out))}
/* ---------- static files + security headers ---------- */
const MT={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.jpg':'image/jpeg','.png':'image/png','.txt':'text/plain','.svg':'image/svg+xml','.ico':'image/x-icon'};
const SEC={'Content-Security-Policy':"default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",'X-Frame-Options':'DENY','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','Permissions-Policy':'camera=(), microphone=(), geolocation=(), payment=()','Cross-Origin-Opener-Policy':'same-origin'};
function serve(req,res){const u=decodeURIComponent(new URL(req.url,'http://x').pathname);let f=u==='/'?'/index':u;if(!path.extname(f))f+='.html';const p=path.resolve(PUB,'.'+f);
 if(!p.startsWith(PUB+path.sep)||!fs.existsSync(p)||!fs.statSync(p).isFile()){res.writeHead(404,{'Content-Type':MT['.html']});return res.end(fs.readFileSync(path.join(PUB,'404.html')))}
 const ext=path.extname(p),h={'Content-Type':MT[ext]||'application/octet-stream','Cache-Control':ext==='.html'?'no-cache':'public, max-age=300'};if(u==='/admin'||u==='/admin.html')h['X-Robots-Tag']='noindex, nofollow';res.writeHead(200,h);res.end(fs.readFileSync(p))}
const server=http.createServer(async(req,res)=>{for(const k in SEC)res.setHeader(k,SEC[k]);if(req.socket.encrypted||req.headers['x-forwarded-proto']==='https')res.setHeader('Strict-Transport-Security','max-age=63072000; includeSubDomains');
 try{const m=req.url.match(/^\/api\/([A-Za-z]+)(?:\?.*)?$/);if(m)await api(req,res,m[1]);else if(req.method==='GET'||req.method==='HEAD')serve(req,res);else throw new Err(405,'Method not allowed')}
 catch(e){if(!e.status)console.error(e);if(!res.headersSent){res.writeHead(e.status||500,{'Content-Type':'application/json'});res.end(JSON.stringify({error:e.status?e.message:'Server error. Please try again.'}))}}});
/* ---------- start-up ---------- */
if(process.argv.includes('--new-code')){newCode();process.exit(0)}
if(!db.users.length){const[s,h]=mkHash(E.ADMIN_INITIAL_PASSWORD||'insit1947@2026');db.users.push({u:'admin',role:'admin',salt:s,hash:h,created:now()});save()}
if(!db.config.codeHash)newCode();
try{sync()}catch(e){console.error('sync',e.message)}setInterval(()=>{try{sync()}catch(e){}},864e5).unref();
if(require.main===module)server.listen(PORT,E.HOST||'0.0.0.0',()=>console.log('\n  ✔ '+FULL+'\n  Open: http://localhost:'+PORT+'\n  Admin: http://localhost:'+PORT+'/admin   (user: admin)\n  Data: '+DATA+'\n  Excel + backup folder: '+DRIVE+'\n'));
module.exports={server,db};
