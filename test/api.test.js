/* Run: npm test — starts the app on a temp folder and checks the API, security rules, Excel export and SMTP alerts. */
const fs=require('fs'),os=require('os'),path=require('path'),net=require('net');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'isai-'));process.env.DATA_DIR=tmp;process.env.ADMIN_INITIAL_PASSWORD='insit1947@2026';
const smtpLog=[];let authStep=0;
const smtp=net.createServer(s=>{let d=false,buf='';s.write('220 mock\r\n');s.on('data',c=>{buf+=c;let m;while((m=buf.match(/^.*\r\n/))){const l=m[0];buf=buf.slice(l.length);
 if(d){if(l==='.\r\n'){d=false;s.write('250 ok\r\n')}else smtpLog.push(l)}
 else if(/^EHLO/.test(l))s.write('250 hi\r\n');else if(/^AUTH/.test(l)){authStep=0;s.write('334 VXNlcm5hbWU6\r\n')}
 else if(/^(MAIL|RCPT)/.test(l))s.write('250 ok\r\n');else if(/^DATA/.test(l)){d=true;s.write('354 go\r\n')}else if(/^QUIT/.test(l)){s.write('221 bye\r\n');s.end()}
 else if(/^[A-Za-z0-9+\/=]+\r\n$/.test(l)){authStep++;s.write(authStep===1?'334 UGFzc3dvcmQ6\r\n':'235 ok\r\n')}}})});
smtp.listen(0,()=>{process.env.SMTP_HOST='127.0.0.1';process.env.SMTP_PORT=smtp.address().port;process.env.SMTP_SECURE='false';process.env.SMTP_USER='bot@test';process.env.SMTP_PASS='x';process.env.DRIVE_DIR=path.join(tmp,'drive');
 const {server}=require('../server.js');server.listen(0,async()=>{const B='http://127.0.0.1:'+server.address().port;let pass=0,fail=0;
 const ok=(n,c)=>{c?pass++:fail++;console.log((c?'PASS ':'FAIL ')+n)};
 const call=async(a,d,t,h)=>{const r=await fetch(B+'/api/'+a,{method:'POST',headers:Object.assign({'Content-Type':'application/json'},t?{Authorization:'Bearer '+t}:{},h||{}),body:JSON.stringify(d||{})});let j={};try{j=await r.json()}catch(e){}return Array.isArray(j)?Object.assign(j,{s:r.status}):{s:r.status,...j}};
 const code=fs.readFileSync(path.join(tmp,'SECURITY-CODE.txt'),'utf8').split('\n')[2];ok('16-char mixed security code',code.length===16&&/[A-Z]/.test(code)&&/[a-z]/.test(code)&&/\d/.test(code)&&/[^A-Za-z0-9]/.test(code));
 const S={name:'Aarav',surname:'Sharma',dept:'Engineering',dob:'2002-05-14',address:'Via Roma 1',phone:'+39 3331234567'};
 ok('enrol ok',(await call('enroll',S)).ok);ok('enrol duplicate phone updates',(await call('enroll',{...S,dept:'Law'})).updated);
 ok('enrol invalid rejected',(await call('enroll',{...S,phone:'abc'})).s===400);ok('honeypot ignored',(await call('enroll',{...S,phone:'+39 000000000',hp:'x'})).ok);
 ok('students needs login',(await call('students')).s===401);ok('forged token rejected',(await call('students',{},'a.b.c')).s===401);
 ok('wrong password',(await call('login',{u:'admin',p:'nope'})).s===401);
 const L=await call('login',{u:'admin',p:'insit1947@2026',dev:'{"ua":"TestBrowser","platform":"X"}'});ok('admin login',!!L.t);
 const st=await call('students',{},L.t);ok('admin sees 1 student, edited dept',st.length===1&&st[0].dept==='Law');
 await new Promise(r=>setTimeout(r,2000));const xl=path.join(tmp,'drive','Indian-Student-Association-Italy-Padova-Student-Records.xlsx');ok('Excel file written to sync folder',fs.existsSync(xl)&&fs.readFileSync(xl).slice(0,2).toString()==='PK');ok('JSON backup written',fs.existsSync(path.join(tmp,'drive','Backup-latest.json')));
 const mailed=Buffer.from(smtpLog.join('').replace(/\r\n/g,''),'base64').toString();ok('login alert e-mailed via SMTP',/Login alert|TestBrowser/.test(mailed)||smtpLog.length>0);
 const logT=fs.readFileSync(path.join(tmp,'mail-outbox.log'),'utf8');ok('mail log: alert recorded, code never logged',/Login alert: admin \| SENT/.test(logT)&&!logT.includes(code));
 ok('add user',(await call('addUser',{u:'helper1',p:'Helper-pass-1'},L.t)).ok);await call('addUser',{u:'helper2',p:'Helper-pass-2'},L.t);ok('3rd user refused',(await call('addUser',{u:'helper3',p:'Helper-pass-3'},L.t)).s===400);
 const H=await call('login',{u:'helper1',p:'Helper-pass-1'});ok('user can view students',(await call('students',{},H.t)).length===1);ok('user cannot sync (403)',(await call('sync',{},H.t)).s===403);
 ok('pwd needs correct code',(await call('pwd',{pw:'BrandNew-Pass-9',code:'WRONGWRONG123456'},L.t)).s===403);ok('pwd with code works',(await call('pwd',{pw:'BrandNew-Pass-9',code},L.t)).ok);
 ok('old session invalid after pwd change',(await call('students',{},L.t)).s===401);ok('old password fails',(await call('login',{u:'admin',p:'insit1947@2026'})).s===401);const L2=await call('login',{u:'admin',p:'BrandNew-Pass-9'});ok('new password works',!!L2.t);
 const x=await fetch(B+'/api/xlsx',{method:'POST',headers:{Authorization:'Bearer '+L2.t}});ok('Excel download',x.status===200&&(await x.arrayBuffer()).byteLength>500);
 for(let i=0;i<5;i++)await call('login',{u:'helper2',p:'bad'+i});ok('lockout after 5 fails',(await call('login',{u:'helper2',p:'Helper-pass-2'})).s===429);
 ok('cross-origin blocked',(await call('enroll',S,null,{Origin:'https://evil.com'})).s===403);ok('unknown action 404',(await call('nope')).s===404);
 const r=await fetch(B+'/admin');ok('security headers',/script-src 'self'/.test(r.headers.get('content-security-policy'))&&r.headers.get('x-frame-options')==='DENY');ok('/home clean URL',(await fetch(B+'/home')).status===200);ok('path traversal blocked',(await fetch(B+'/..%2f..%2fserver.js')).status===404);ok('404 page',(await fetch(B+'/zzz')).status===404);
 console.log(`\n${pass} passed, ${fail} failed`);server.close();smtp.close();process.exit(fail?1:0)})});
