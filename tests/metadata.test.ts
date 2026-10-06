import { it, expect } from 'vitest';
import { parseAnnotationCard, parseAnnotation, validateArtwork } from '../src/sources/searchfloor/metadata.js';
import { SearchfloorClient } from '../src/sources/searchfloor/client.js';
it('extracts inline paragraphs without scripts and never uses boilerplate',()=>{
  expect(parseAnnotationCard('<meta name="description" content="boilerplate"><div id="annotation"><p>Перший &amp; другий</p><script>evil</script><p>Кінець</p></div>','1')).toEqual({inline:'Перший & другий\n\nКінець',api:false});
  expect(parseAnnotationCard('<meta name="description" content="boilerplate">','1')).toEqual({api:false});
  expect(parseAnnotationCard('<div id="annotation" data-url="https://evil.example"></div>','1')).toEqual({api:false});
  expect(parseAnnotationCard('<div id="annotation" data-url="/api/annotation/1"></div>','1')).toEqual({api:true});
});
it('decodes only valid UTF8 and distinguishes empty annotation',()=>{
  expect(parseAnnotation(new TextEncoder().encode(' Анонс\n\nДалі '))).toBe('Анонс\n\nДалі');
  expect(parseAnnotation(new TextEncoder().encode(' \n'))).toBeNull();
  expect(()=>parseAnnotation(new Uint8Array([255]))).toThrow();
});
it('oversized inline annotation never breaks the base card',()=>{
  expect(parseAnnotationCard('<div id="annotation">'+'x'.repeat(65537)+'</div>','1')).toEqual({api:false,invalid:true});
});
it('accepts exact caps and cancels overflowing bodies without Content-Length',async()=>{
  let canceled=false;
  const c=new SearchfloorClient({spacingMs:0,fetch:async()=>new Response(new ReadableStream({start(controller){controller.enqueue(new Uint8Array(2*1024*1024+1));},cancel(){canceled=true;} }),{headers:{'content-type':'image/jpeg'}})});
  await expect(c.getCover('1')).rejects.toMatchObject({status:502}); expect(canceled).toBe(true); c.close();
  const exact=new SearchfloorClient({spacingMs:0,fetch:async()=>new Response('x'.repeat(65536),{headers:{'content-type':'text/plain'}})});
  expect((await exact.getAnnotation('1'))?.length).toBe(65536); exact.close();
});
it('optional resources preserve deadlines, shutdown and redirect restrictions',async()=>{
  const c=new SearchfloorClient({spacingMs:0,timeoutMs:10,fetch:async()=>new Response(new ReadableStream({start(controller){controller.enqueue(new Uint8Array([255,216,255]));}}),{headers:{'content-type':'image/jpeg'}})});
  await expect(c.getCover('1')).rejects.toMatchObject({status:503}); c.close();
  await expect(c.getAnnotation('1')).rejects.toMatchObject({status:503});
  const redirected=new SearchfloorClient({spacingMs:0,fetch:async()=>new Response(null,{status:302,headers:{location:'https://evil.example/'}})});
  await expect(redirected.getCover('1')).rejects.toMatchObject({status:502}); redirected.close();
});
it('rejects spoofed image MIME and SVG',()=>{
  expect(validateArtwork(new Uint8Array([255,216,255,224]),'image/jpeg')).toBe('image/jpeg');
  expect(validateArtwork(new Uint8Array([137,80,78,71,13,10,26,10]),'image/png')).toBe('image/png');
  expect(validateArtwork(new TextEncoder().encode('GIF89a'),'image/gif')).toBe('image/gif');
  expect(()=>validateArtwork(new TextEncoder().encode('<html>challenge</html>'),'image/jpeg')).toThrow();
  expect(()=>validateArtwork(new Uint8Array([255,216,255]),'image/png')).toThrow();
  expect(()=>validateArtwork(new TextEncoder().encode('<svg/>'),'image/svg+xml')).toThrow();
});
it('fetches fixed optional paths, recognizes absence and rejects invalid responses',async()=>{
  let mode='annotation'; const paths:string[]=[];
  const client=new SearchfloorClient({spacingMs:0,fetch:async u=>{paths.push(new URL(u).pathname);
    if(mode==='absent')return new Response(null,{status:404});
    if(mode==='denied')return new Response('denied',{status:403});
    if(mode==='cover')return new Response(new Uint8Array([255,216,255,224]),{headers:{'content-type':'image/jpeg'}});
    if(mode==='spoof')return new Response('<html/>',{headers:{'content-type':'image/jpeg'}});
    if(mode==='large')return new Response('x'.repeat(65537),{headers:{'content-type':'text/plain'}});
    return new Response('Анонс',{headers:{'content-type':'text/plain; charset=utf-8'}});
  }});
  expect(await client.getAnnotation('1')).toBe('Анонс'); expect(paths[0]).toBe('/api/annotation/1');
  mode='cover'; expect((await client.getCover('1'))?.mime).toBe('image/jpeg'); expect(paths[1]).toBe('/cover/1');
  mode='absent'; expect(await client.getAnnotation('1')).toBeNull(); expect(await client.getCover('1')).toBeNull();
  mode='denied'; await expect(client.getAnnotation('1')).rejects.toMatchObject({status:503});
  mode='spoof'; await expect(client.getCover('1')).rejects.toMatchObject({status:502});
  mode='large'; await expect(client.getAnnotation('1')).rejects.toMatchObject({status:502});
  const count=paths.length; expect(await client.getCover('bad')).toBeNull(); expect(paths.length).toBe(count);
  client.close();
});
