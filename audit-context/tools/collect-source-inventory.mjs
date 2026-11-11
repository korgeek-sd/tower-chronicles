// Offline source inventory only. Does not call APIs or execute application code.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';
const root=fileURLToPath(new URL('../../',import.meta.url));
const evidence=path.join(root,'audit-context/evidence');
const rpc=JSON.parse(fs.readFileSync(path.join(evidence,'rpc-inventory.json'),'utf8'));
const names=new Set(rpc.filter(x=>x.schema==='public').map(x=>x.name));
const files=[];
function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,entry.name);if(entry.isDirectory())walk(p);else if(/\.[cm]?[jt]sx?$/.test(p))files.push(p);}}
walk(path.join(root,'src'));
const references=[],network=[],localInputs=[];
for(const file of files){
 const source=fs.readFileSync(file,'utf8'),relative=path.relative(root,file);
 const tree=ts.createSourceFile(relative,source,ts.ScriptTarget.Latest,true,file.endsWith('tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 const line=node=>tree.getLineAndCharacterOfPosition(node.getStart(tree)).line+1;
 function visit(node){
  if(ts.isStringLiteralLike(node)){
   const exact=names.has(node.text)?node.text:null;
   const endpoint=/\/rpc\/([a-z_0-9]+)/.exec(node.text)?.[1];
   if(exact||endpoint)references.push({file:relative,line:line(node),rpc:exact??endpoint,kind:'literal-reference'});
  }
  if(ts.isCallExpression(node)||ts.isNewExpression(node)){
   const call=node.expression.getText(tree);
   if(/(?:^|\.)(?:fetch|request)$/.test(call)||call==='WebSocket')network.push({file:relative,line:line(node),call,target:node.arguments?.[0]?.getText(tree)??''});
   if(/localStorage|sessionStorage|FileReader|importSave|loadGame|parseSave|deserialize/.test(call))localInputs.push({file:relative,line:line(node),call});
  }
  ts.forEachChild(node,visit);
 }
 visit(tree);
}
const result={baseline:process.argv[2]??'unspecified',method:'TypeScript AST literals and call sites; dynamic RPCs may lack a literal reference, and a literal does not prove runtime reachability.',sourceFiles:files.length,references,network,localInputs};
fs.writeFileSync(path.join(evidence,'source-inventory.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({sourceFiles:files.length,rpcLiteralNames:new Set(references.map(x=>x.rpc)).size,networkCallsites:network.length,localInputCallsites:localInputs.length}));
