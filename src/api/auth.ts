import {createHash,timingSafeEqual} from 'node:crypto';import type {MiddlewareHandler} from 'hono';
const digest=(v:string)=>createHash('sha256').update(v).digest();
export function privateAuth(username:string,password:string):MiddlewareHandler {
 const expected=digest(username+':'+password);
 return async(c,next)=>{const value=c.req.header('authorization')??'';const match=/^Basic ([A-Za-z0-9+/]+={0,2})$/i.exec(value);let decoded='';if(match){const bytes=Buffer.from(match[1],'base64');decoded=bytes.toString('utf8');if(bytes.toString('base64')!==match[1])decoded='';}
  if(!timingSafeEqual(digest(decoded),expected)){c.header('WWW-Authenticate','Basic realm="OPDS", charset="UTF-8"');return c.text('Authentication required',401)}await next();
 };
}
