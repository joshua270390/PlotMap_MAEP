import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}});
const cfg=()=>({adminPin:process.env.ADMIN_PIN||"",url:(process.env.SUPABASE_URL||"").replace(/\/+$/,""),key:(process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_KEY||"").trim(),secret:process.env.USER_SESSION_SECRET||"",table:process.env.USER_ACCESS_TABLE||"user_access",twilioSid:process.env.TWILIO_ACCOUNT_SID||"",twilioToken:process.env.TWILIO_AUTH_TOKEN||"",verifySid:process.env.TWILIO_VERIFY_SERVICE_SID||""});
const hashPin=pin=>{const salt=randomBytes(16).toString("hex");return salt+":"+scryptSync(pin,salt,64).toString("hex")};
const makeToken=(mobileNumber,secret)=>{const payload=Buffer.from(JSON.stringify({mobileNumber,exp:Date.now()+8*60*60*1000})).toString("base64url");return payload+"."+createHmac("sha256",secret).update(payload).digest("base64url")};
const readToken=(token,secret)=>{try{const [payload,sig]=String(token||"").split(".");if(!payload||!sig)return null;const expected=createHmac("sha256",secret).update(payload).digest();const actual=Buffer.from(sig,"base64url");if(actual.length!==expected.length||!timingSafeEqual(actual,expected))return null;const data=JSON.parse(Buffer.from(payload,"base64url").toString("utf8"));return data.exp>Date.now()?data:null}catch{return null}};
function normalizeMobile(value){let mobile=String(value||"").trim().replace(/[\s().-]/g,"");if(/^\d{10}$/.test(mobile))mobile="+91"+mobile;else if(/^91\d{10}$/.test(mobile))mobile="+"+mobile;return /^\+[1-9]\d{7,14}$/.test(mobile)?mobile:""}
async function db(c,method,query="",body,prefer="return=representation"){const response=await fetch(c.url+"/rest/v1/"+c.table+(query?"?"+query:""),{method,headers:{apikey:c.key,Authorization:"Bearer "+c.key,Accept:"application/json",...(body!==undefined?{"Content-Type":"application/json",Prefer:prefer}:{})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(10000)});const raw=await response.text();let data=null;try{data=raw?JSON.parse(raw):null}catch{}return response.ok?{ok:true,data}:{ok:false,status:response.status,error:data?.message||"Database request failed"}}
async function twilio(c,endpoint,fields){if(!c.twilioSid||!c.twilioToken||!c.verifySid)return{ok:false,error:"SMS OTP is not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_VERIFY_SERVICE_SID in Netlify."};const response=await fetch("https://verify.twilio.com/v2/Services/"+encodeURIComponent(c.verifySid)+"/"+endpoint,{method:"POST",headers:{Authorization:"Basic "+Buffer.from(c.twilioSid+":"+c.twilioToken).toString("base64"),"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams(fields),signal:AbortSignal.timeout(10000)});const data=await response.json().catch(()=>({}));if(!response.ok){if(response.status===404)return{ok:false,error:"OTP service is not configured correctly. Check the Twilio Verify Service SID."};if(/max send attempts|too many requests|rate limit/i.test(String(data.message||"")))return{ok:false,error:"Too many OTP requests. Please wait a few minutes and try again."};return{ok:false,error:"Could not process OTP. Check the mobile number and try again."}}return{ok:true,data}}
async function findUser(c,mobileNumber){return db(c,"GET",new URLSearchParams({select:"id,mobile_number,created_at,status",mobile_number:"eq."+mobileNumber,limit:"1"}).toString())}
export default async function handler(request){
 if(request.method!=="POST")return json({ok:false,error:"Method not allowed"},405);
 const c=cfg();if(!c.url||!c.key||!c.secret)return json({ok:false,error:"User access is not configured. Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and USER_SESSION_SECRET in Netlify."},500);
 let body;try{body=await request.json()}catch{return json({ok:false,error:"Invalid request."},400)}const action=String(body?.action||"");
 try{
  if(action==="send-code"){
   const mobileNumber=normalizeMobile(body.mobile_number),purpose=String(body.purpose||"");
   if(!mobileNumber)return json({ok:false,error:"Enter a valid mobile number with country code, or a 10-digit Indian mobile number."},422);
   if(!["register","login"].includes(purpose))return json({ok:false,error:"Invalid OTP request."},400);
   const existing=await findUser(c,mobileNumber);if(!existing.ok)return json({ok:false,error:"Could not check the mobile number. Please try again."},502);
   const registered=Array.isArray(existing.data)&&existing.data.length>0;
   if(purpose==="register"&&registered)return json({ok:false,error:"Mobile number already used. Please sign in instead."},409);
   if(purpose==="login"&&!registered)return json({ok:false,error:"This mobile number is not registered. Please create an account first."},404);
   const sent=await twilio(c,"Verifications",{To:mobileNumber,Channel:"sms"});if(!sent.ok)return json({ok:false,error:sent.error},502);
   return json({ok:true,message:"OTP sent."});
  }
  if(action==="verify-code"){
   const mobileNumber=normalizeMobile(body.mobile_number),purpose=String(body.purpose||""),code=String(body.code||"").trim();
   if(!mobileNumber||!/^\d{4,8}$/.test(code)||!["register","login"].includes(purpose))return json({ok:false,error:"Enter the mobile number and valid OTP."},422);
   const verified=await twilio(c,"VerificationCheck",{To:mobileNumber,Code:code});if(!verified.ok)return json({ok:false,error:verified.error},502);
   if(verified.data?.status!=="approved")return json({ok:false,error:"Incorrect or expired OTP. Please try again."},401);
   const existing=await findUser(c,mobileNumber);if(!existing.ok)return json({ok:false,error:"Could not verify the account. Please try again."},502);
   const user=Array.isArray(existing.data)?existing.data[0]:null;
   if(purpose==="register"){
    if(user)return json({ok:false,error:"Mobile number already used. Please sign in instead."},409);
    const inserted=await db(c,"POST","",{mobile_number:mobileNumber,name:mobileNumber,email:mobileNumber.replace(/\D/g,"")+"@phone.maep.invalid",pin_hash:hashPin(randomBytes(32).toString("hex")),status:"approved"});
    if(!inserted.ok){if(inserted.status===409||/duplicate|unique/i.test(inserted.error))return json({ok:false,error:"Mobile number already used. Please sign in instead."},409);console.error("[user-access] User registration failed:",inserted.status,inserted.error);return json({ok:false,error:"Could not create account. Check the user_access table migration and try again."},502)}
    return json({ok:true,status:"approved",message:"Mobile verified. Account created."},201);
   }
   if(!user)return json({ok:false,error:"This mobile number is not registered. Please create an account first."},404);
   if(user.status==="revoked")return json({ok:false,error:"This account is disabled. Contact Admin."},403);
   return json({ok:true,role:"user",name:mobileNumber,token:makeToken(mobileNumber,c.secret)});
  }
  if(action==="verify"){
   const token=readToken(request.headers.get("x-user-session"),c.secret);if(!token)return json({ok:false,error:"User session expired. Please sign in again."},401);
   if(token.mobileNumber){const found=await findUser(c,token.mobileNumber),user=found.ok&&Array.isArray(found.data)?found.data[0]:null;if(!user||user.status==="revoked")return json({ok:false,error:"User access is not available."},403);return json({ok:true,role:"user",name:user.mobile_number})}
   if(token.email){const found=await db(c,"GET",new URLSearchParams({select:"name,status",email:"eq."+token.email,limit:"1"}).toString()),user=found.ok?found.data?.[0]:null;if(user?.status==="approved")return json({ok:true,role:"user",name:user.name})}
   return json({ok:false,error:"User access is not available."},403);
  }
  if(action==="list"||action==="delete"){
   if(!c.adminPin||request.headers.get("x-admin-pin")!==c.adminPin)return json({ok:false,error:"Admin authentication failed."},401);
   if(action==="list"){const result=await db(c,"GET",new URLSearchParams({select:"id,mobile_number,created_at",mobile_number:"not.is.null",order:"created_at.desc",limit:"1000"}).toString());return result.ok?json({ok:true,users:result.data||[]}):json({ok:false,error:"Could not load user accounts."},502)}
   const id=String(body.id||"");if(!/^\d+$/.test(id))return json({ok:false,error:"Invalid user id."},422);
   const removed=await db(c,"DELETE",new URLSearchParams({id:"eq."+id}).toString(),undefined,"return=minimal");return removed.ok?json({ok:true}):json({ok:false,error:"Could not delete user account."},502);
  }
  return json({ok:false,error:"Unknown action."},400);
 }catch(error){console.error("[user-access] Request failed:",error?.message||error);return json({ok:false,error:"User access service failed. Please try again."},500)}
}
