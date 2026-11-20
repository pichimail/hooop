import crypto from 'node:crypto';
export const safeEqual=(a,b)=>{const x=Buffer.from(String(a)),y=Buffer.from(String(b));return x.length===y.length&&crypto.timingSafeEqual(x,y)};
export function createAuth({pin=String(crypto.randomInt(100000,1000000)),now=()=>Date.now()}={}){
  if(!/^\d{6,12}$/.test(pin))throw Error('HOOOP_LOCAL_PIN must be 6–12 digits');
  const tokens=new Map(),attempts=new Map();
  return{pin,issue(ip,input){
    const rec=attempts.get(ip)||{count:0,since:now()};if(now()-rec.since>10*60_000){rec.count=0;rec.since=now()}
    if(rec.count>=5)throw Object.assign(Error('Too many attempts; try again in ten minutes.'),{status:429});
    if(!safeEqual(input,pin)){rec.count++;attempts.set(ip,rec);throw Object.assign(Error('Invalid pairing code'),{status:401})}
    attempts.delete(ip);const token=crypto.randomBytes(32).toString('base64url');tokens.set(crypto.createHash('sha256').update(token).digest('hex'),now()+8*60*60_000);return {token,expires_in:28800};
  },verify(token){if(!token)return false;const key=crypto.createHash('sha256').update(token).digest('hex'),exp=tokens.get(key);if(!exp)return false;if(now()>exp){tokens.delete(key);return false}return true;},revoke(token){tokens.delete(crypto.createHash('sha256').update(token).digest('hex'))},active(){return tokens.size}};
}
