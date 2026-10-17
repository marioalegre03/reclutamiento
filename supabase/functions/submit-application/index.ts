import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
const origin = 'https://reclutamiento.estacionkusmedios.com';
const cors = {'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin','Cache-Control':'no-store'};
const json=(v:unknown,status=200)=>new Response(JSON.stringify(v),{status,headers:{...cors,'Content-Type':'application/json'}});
const roles=['Locución','Reportería / noticias','Moderación','Producción','Redes sociales','Otro'];
const emisoras=['Estacionkusfm','KusFM Joven','Runa FM','Radio Aventura MX','RunaRadio Irapuato'];
Deno.serve(async(req)=>{
 if(req.headers.get('origin')!==origin)return json({error:'Origen no permitido.'},403);
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(req.method!=='POST')return json({error:'Método no permitido.'},405);
 try {
 const raw=await req.text(); if(raw.length>6500)return json({error:'Solicitud demasiado larga.'},413);
 const b=JSON.parse(raw);if(b.empresa)return json({ok:true});
 if(b.consent!==true)return json({error:'Acepta el aviso de privacidad.'},400);
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(b.id||''))return json({error:'Recarga el formulario.'},400);
 const data:Record<string,string>={};const limits:Record<string,number>={nombre:80,email:120,telefono:20,puesto:40,emisora:40,ciudad:60,experiencia:600,mensaje:600};
 for(const [k,n] of Object.entries(limits)){if(typeof b[k]!=='string'||b[k].length>n||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(b[k]))return json({error:'Revisa los campos del formulario.'},400);data[k]=b[k].trim();}
 if(data.nombre.length<2||!/^\S+@[^\s@]+\.[^\s@]{2,}$/.test(data.email)||!roles.includes(data.puesto)||!emisoras.includes(data.emisora))return json({error:'Revisa nombre, correo, emisora y área.'},400);
 const ip=req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||'unknown';
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(Deno.env.get('RECRUITMENT_IP_SALT')+ip));const hash=Array.from(new Uint8Array(digest)).map(v=>v.toString(16).padStart(2,'0')).join('');
 const sb=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
 const {data:reserved,error}=await sb.rpc('reserve_recruitment',{p_id:b.id,p_ip:hash,p_data:data});
 if(error)return json({error:'No se pudo guardar. Intenta más tarde.'},503);
 if(reserved==='limited')return json({error:'Límite de solicitudes alcanzado. Intenta en una hora.'},429);
 if(reserved==='duplicate')return json({ok:true,duplicate:true});
 if(reserved==='retry'){const {data:old}=await sb.from('recruitment_applications').select('nombre,email,telefono,puesto,emisora,ciudad,experiencia,mensaje').eq('id',b.id).single();if(old)Object.assign(data,old);}
 const body=['Nueva solicitud de reclutamiento','ID: '+b.id,...Object.entries(data).map(([k,v])=>k+': '+(v||'(sin indicar)')),'Consentimiento de contacto registrado.'].join('\n\n');
 const r=await fetch('https://api.brevo.com/v3/smtp/email',{signal:AbortSignal.timeout(15000),method:'POST',headers:{'api-key':Deno.env.get('BREVO_API_KEY')!,'Content-Type':'application/json'},body:JSON.stringify({sender:{name:'Reclutamiento Estación Kusmedios',email:'hola@estacionkusmedios.com'},to:[{email:'hola@estacionkusmedios.com'}],subject:'[Reclutamiento] '+data.puesto+' - '+data.nombre,textContent:body,headers:{'idempotencyKey':b.id}})}).catch(()=>new Response('{}',{status:503}));
 const result=await r.json().catch(()=>({}));
 await sb.from('recruitment_applications').update({email_status:r.ok?'sent':'failed',email_message_id:r.ok?result.messageId:null}).eq('id',b.id);
 if(!r.ok)return json({error:'Tu solicitud se guardó, pero el aviso por correo falló. Pulsa Enviar otra vez para reintentar.'},503);
 return json({ok:true});
 }catch{return json({error:'Solicitud no válida. Revisa el formulario.'},400);}
});
