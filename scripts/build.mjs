import {cp,mkdir,rm} from 'node:fs/promises';
await rm('dist',{recursive:true,force:true});await mkdir('dist');
for(const file of ['index.html','style.css','app.js','engine.js','favicon.svg','data'])await cp(file,`dist/${file}`,{recursive:true});
console.log('Static site built in dist/');
