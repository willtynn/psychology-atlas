/* Public loader. The password and decrypted content remain in this page's memory. */
(()=>{'use strict';
const $=s=>document.querySelector(s),base=new URL(document.body.dataset.root,location.href),encoder=new TextEncoder();
const frame=$('#book-frame');let bundle=null,downloads=[],busy=false;
const bytes=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
function route(){let path=location.pathname.slice(base.pathname.length);return !path||path.endsWith('/')?path+'index.html':path}
function release(){downloads.forEach(url=>URL.revokeObjectURL(url));downloads=[]}
function fileUrl(name){const data=bundle.files[name];if(!data)throw Error('Missing protected file');const url=URL.createObjectURL(new Blob([data],{type:name.endsWith('.json')?'application/json;charset=utf-8':'application/xml;charset=utf-8'}));downloads.push(url);return url}
function go(url,push=true){const target=new URL(url,location.href);if(target.origin!==base.origin||!target.pathname.startsWith(base.pathname))return false;let name=target.pathname.slice(base.pathname.length);if(!name||name.endsWith('/'))name+='index.html';if(!bundle.files[name]||!name.endsWith('.html'))return false;if(push)history.pushState(null,'',target.pathname+target.search+target.hash);show(name,target.hash);return true}
function show(name,hash=''){
 release();const folder=name.includes('/')?name.slice(0,name.lastIndexOf('/')+1):'';
 const doc=new DOMParser().parseFromString(bundle.files[name],'text/html');
 const baseTag=doc.createElement('base');baseTag.href=new URL(name,base).href;doc.head.prepend(baseTag);
 doc.querySelectorAll('a[download]').forEach(a=>{const file=folder+a.getAttribute('href');a.href=fileUrl(file);a.download=file.split('/').pop()});
 frame.onload=()=>{
  if(!bundle)return;const win=frame.contentWindow,inside=frame.contentDocument;
  document.title=inside.title+' · 已解锁';
  inside.addEventListener('click',e=>{const a=e.target.closest('a[href]');if(!a||a.hasAttribute('download')||a.target==='_blank'||a.getAttribute('href').startsWith('#')||a.href.startsWith('blob:'))return;if(new URL(a.href).origin===base.origin){e.preventDefault();e.stopImmediatePropagation();go(a.href)}},true);
  inside.addEventListener('change',e=>{if(e.target.id==='book-switch'){e.stopImmediatePropagation();go(new URL(e.target.value,baseTag.href).href)}},true);
  if(hash.startsWith('#pdf=')){const a=inside.createElement('a');a.href=hash;inside.body.append(a);a.click();a.remove()}
 };
 frame.srcdoc='<!doctype html>'+doc.documentElement.outerHTML;
}
function lock(){bundle=null;release();frame.onload=null;frame.removeAttribute('srcdoc');frame.src='about:blank';$('#password').value='';$('#password').type='password';$('#show-password').textContent='显示';$('#show-password').setAttribute('aria-pressed','false');$('#show-password').setAttribute('aria-label','显示密码');$('#reader').hidden=true;$('#gate').hidden=false;$('#message').textContent='';document.title='心理学教材 · 密码解锁';$('#password').focus()}
$('#show-password').onclick=()=>{const visible=$('#password').type==='password';$('#password').type=visible?'text':'password';$('#show-password').textContent=visible?'隐藏':'显示';$('#show-password').setAttribute('aria-label',visible?'隐藏密码':'显示密码');$('#show-password').setAttribute('aria-pressed',String(visible))};
$('#unlock-form').onsubmit=async e=>{
 e.preventDefault();if(busy)return;busy=true;$('#submit').disabled=true;$('#message').textContent='正在解锁…';
 try{
  if(!crypto.subtle)throw Error('unsupported');
  const response=await fetch(new URL('vault.json',base),{cache:'no-store',credentials:'omit'});if(!response.ok)throw Error('network');const vault=await response.json();
  if(vault.version!==1||vault.iterations!==600000)throw Error('format');
  const material=await crypto.subtle.importKey('raw',encoder.encode($('#password').value),'PBKDF2',false,['deriveKey']);
  const key=await crypto.subtle.deriveKey({name:'PBKDF2',salt:bytes(vault.salt),iterations:vault.iterations,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['decrypt']);
  const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes(vault.iv),additionalData:encoder.encode('psychology-atlas-v1'),tagLength:128},key,bytes(vault.ciphertext));
  bundle=JSON.parse(new TextDecoder().decode(plain));$('#password').value='';$('#message').textContent='';$('#gate').hidden=true;$('#reader').hidden=false;
  const name=route();if(bundle.files[name]&&name.endsWith('.html'))show(name,location.hash);else go(new URL('index.html',base));
 }catch(error){bundle=null;release();frame.removeAttribute('srcdoc');frame.src='about:blank';$('#reader').hidden=true;$('#gate').hidden=false;$('#message').textContent=error.name==='OperationError'?'密码不正确，或加密文件已损坏，请重试。':error.message==='unsupported'?'当前浏览器不支持解密，请使用新版浏览器并通过 HTTPS 访问。':'暂时无法读取加密内容，请刷新页面后重试。';$('#password').select()}
 finally{busy=false;$('#submit').disabled=false}
};
$('#lock').onclick=lock;window.addEventListener('popstate',()=>{if(bundle)go(location.href,false)});
window.addEventListener('pagehide',lock);window.addEventListener('pageshow',e=>{if(e.persisted)lock()});
})();
