import {SearchfloorClient} from './searchfloor/client.js';
export function getSource(name:string,searchfloor:SearchfloorClient):SearchfloorClient|null {
 return name==='searchfloor'?searchfloor:null;
}
