import {cp,mkdir,rm,readFile,writeFile} from 'node:fs/promises';

// GitHub repository administration may be separate from source-write access.
// Build correct canonical URLs before and after a repository rename.
const repository=process.env.GITHUB_REPOSITORY||'erigrus/linxikon';
if(!/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(repository))throw new Error('Invalid GITHUB_REPOSITORY');
const [owner,name]=repository.split('/');
const rootSite=name.toLowerCase()===`${owner.toLowerCase()}.github.io`;
const siteUrl=`https://${owner.toLowerCase()}.github.io/${rootSite?'':name+'/'}`;
const repositoryUrl=`https://github.com/${repository}`;
await rm('dist',{recursive:true,force:true});await mkdir('dist');
for(const file of ['index.html','style.css','app.js','storage.js','word-graph.js','graph-physics.js','engine.js','favicon.svg','data'])await cp(file,`dist/${file}`,{recursive:true});
for(const file of ['index.html','app.js']){
  const path=`dist/${file}`;
  const content=(await readFile(path,'utf8')).replaceAll('__SEMANTIO_SITE_URL__',siteUrl).replaceAll('__SEMANTIO_REPOSITORY_URL__',repositoryUrl);
  await writeFile(path,content);
}
console.log(`Semantio built in dist/ for ${siteUrl}`);
