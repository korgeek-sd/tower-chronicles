#!/usr/bin/env node
/**
 * Reapply one validated appearance change from a stale skin PR to current main.
 * Refuses conflicts on the same appearance ID, preserves all other entries.
 * Run from the trusted main checkout, never from untrusted PR code.
 */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
import ts from 'typescript';
import {checkCatalogChange} from './skin-pr-guard.mjs';

const CATALOG='src/game/data/cosmetics.ts';
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();

function parseCatalog(content){
 const src=ts.createSourceFile(CATALOG,content,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
 let array;
 const walk=node=>{
  if(ts.isVariableDeclaration(node)&&ts.isIdentifier(node.name)&&node.name.text==='APPEARANCES')array=node.initializer;
  ts.forEachChild(node,walk);
 };
 walk(src);
 assert.ok(array&&ts.isArrayLiteralExpression(array),'expected APPEARANCES array');
 const entries=new Map();
 for(const node of array.elements){
  if(ts.isIdentifier(node)&&node.text==='starter'){entries.set('default',{text:'starter',node});continue;}
  assert.ok(ts.isObjectLiteralExpression(node),'only object entries allowed');
  const idProp=node.properties.find(p=>ts.isPropertyAssignment(p)&&
   ((ts.isIdentifier(p.name)&&p.name.text==='id')||(ts.isStringLiteral(p.name)&&p.name.text==='id')));
  assert.ok(idProp&&ts.isPropertyAssignment(idProp)&&ts.isStringLiteral(idProp.initializer),'entry ID missing');
  const id=idProp.initializer.text;
  assert.ok(!entries.has(id),'duplicate entry: '+id);
  entries.set(id,{text:node.getText(src),node});
 }
 return {src,array,entries};
}

export function reconcileSkinCatalog(baseText,currentText,proposalText){
 const {id}=checkCatalogChange(baseText,proposalText);
 const base=parseCatalog(baseText),current=parseCatalog(currentText),proposed=parseCatalog(proposalText);
 const baseline=base.entries.get(id),existing=current.entries.get(id),incoming=proposed.entries.get(id);
 assert.ok(incoming,'proposal entry missing');
 let result;
 if(baseline){
  assert.ok(existing,'target was removed from main');
  assert.ok(existing.text===baseline.text||existing.text===incoming.text,
   'same skin ID was independently modified; human decision required: '+id);
  if(existing.text===incoming.text)return currentText;
  result=currentText.slice(0,existing.node.getStart(current.src))+incoming.text+
   currentText.slice(existing.node.end);
 }else{
  if(existing){
   assert.equal(existing.text,incoming.text,'new skin ID already exists with different data: '+id);
   return currentText;
  }
  const insertAt=current.array.end-1;
  const prefix=currentText.slice(0,insertAt);
  const separator=prefix.trimEnd().endsWith(',')?'\n':',\n';
  result=prefix+separator+incoming.text+'\n'+currentText.slice(insertAt);
 }
 const merged=parseCatalog(result);
 for(const [oldId,item] of current.entries){
  assert.ok(merged.entries.has(oldId),'lost existing skin: '+oldId);
  if(oldId!==id)assert.equal(merged.entries.get(oldId).text,item.text,'altered another skin: '+oldId);
 }
 assert.equal(merged.entries.get(id)?.text,incoming.text,'target entry was not applied');
 return result;
}

function main(){
 const [baseRef,headRef,outPath]=process.argv.slice(2);
 assert.ok(baseRef&&headRef&&outPath,'usage: reconcile-skin-catalog.mjs <main-ref> <pr-ref> <output-file>');
 const ancestor=git('merge-base',baseRef,headRef);
 const base=git('show',ancestor+':'+CATALOG);
 const main=git('show',baseRef+':'+CATALOG);
 const pr=git('show',headRef+':'+CATALOG);
 const merged=reconcileSkinCatalog(base,main,pr);
 writeFileSync(outPath,merged);
 console.log('Reconciled one disjoint skin into current main: '+outPath);
}
if(process.argv[1]&&import.meta.url===new URL('file://'+process.argv[1]).href){
 try{main();}catch(error){console.error(error.stack??String(error));process.exitCode=1;}
}
