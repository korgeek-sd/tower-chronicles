#!/usr/bin/env node
/**
 * Verify that a skin PR changes exactly one cosmetic entry and only adds
 * content-addressed artwork. This runs from the trusted main branch during
 * the serialized merge workflow; never execute PR-provided code here.
 *
 * Usage: node scripts/skin-pr-guard.mjs origin/main origin/skin-candidate
 */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {existsSync,readFileSync} from 'node:fs';
import ts from 'typescript';

const CATALOG='src/game/data/cosmetics.ts';
const PREFIX='public/assets/characters/appearances/';
const run=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
const propertyName=node=>ts.isIdentifier(node)?node.text:ts.isStringLiteral(node)?node.text:null;
const stringValue=node=>node&&ts.isStringLiteral(node)?node.text:null;
const allowedFields=new Set(['id','name','imagePath','description','sourceLabel','tradeable','hideNameWhenLocked','rarity','collectionId','proposedBonus','artStatus']);
function safeValue(node){
 if(ts.isStringLiteral(node)||ts.isNumericLiteral(node))return true;
 if(node.kind===ts.SyntaxKind.TrueKeyword||node.kind===ts.SyntaxKind.FalseKeyword||node.kind===ts.SyntaxKind.NullKeyword)return true;
 if(ts.isPropertyAccessExpression(node))return ts.isIdentifier(node.expression)&&node.expression.text==='APPEARANCE_PROPOSED_PERCENT'&&['C','B','A','SR','SSR'].includes(node.name.text);
 if(ts.isObjectLiteralExpression(node))return node.properties.every(p=>ts.isPropertyAssignment(p)&&!!propertyName(p.name)&&safeValue(p.initializer));
 return false;
}

function readCatalog(content){
 const source=ts.createSourceFile('cosmetics.ts',content,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
 let array=null;
 const visit=node=>{
  if(ts.isVariableDeclaration(node)&&ts.isIdentifier(node.name)&&node.name.text==='APPEARANCES'){
   assert.equal(array,null,'duplicate APPEARANCES declaration');
   array=node.initializer;
  }
  ts.forEachChild(node,visit);
 };
 visit(source);
 assert.ok(array&&ts.isArrayLiteralExpression(array),'APPEARANCES must be a literal array');
 assert.equal(source.parseDiagnostics.length,0,'catalog has syntax errors');
 const entries=new Map();
 for(const element of array.elements){
  if(ts.isIdentifier(element)&&element.text==='starter'){
   assert.ok(!entries.has('default'),'duplicate starter');
   entries.set('default',{text:'starter',fields:new Map()});
   continue;
  }
  assert.ok(ts.isObjectLiteralExpression(element),'skin entries must remain object literals');
  const fields=new Map();
  for(const property of element.properties){
   assert.ok(ts.isPropertyAssignment(property),'only literal properties are allowed');
   const name=propertyName(property.name);
   assert.ok(name&&allowedFields.has(name)&&!fields.has(name),'invalid or duplicate property');
   assert.ok(safeValue(property.initializer),'executable expression in skin catalog: '+name);
   fields.set(name,{raw:property.initializer.getText(source),value:stringValue(property.initializer)});
  }
  const id=fields.get('id')?.value;
  assert.ok(id&&/^[a-z][a-z0-9_]*$/.test(id),'invalid skin ID');
  assert.ok(!entries.has(id),'duplicate skin ID');
  entries.set(id,{text:element.getText(source),fields});
 }
 assert.equal([...entries.keys()][0],'default','starter must remain first');
 const outside=content.slice(0,array.getStart(source))+'<APPEARANCES>'+content.slice(array.end);
 return {entries,outside};
}

export function checkCatalogChange(baseText,headText){
 const base=readCatalog(baseText),head=readCatalog(headText);
 assert.equal(head.outside,base.outside,'code outside the catalog changed');
 for(const id of base.entries.keys())assert.ok(head.entries.has(id),'skin removed or renamed: '+id);
 const updates=[...head.entries].filter(([id,item])=>item.text!==base.entries.get(id)?.text);
 assert.equal(updates.length,1,'each skin PR must update exactly one skin');
 const [id,next]=updates[0];
 assert.notEqual(id,'default','default artwork uses a separate workflow');
 const old=base.entries.get(id);
 if(old){
  const oldFields=old.fields,newFields=next.fields;
  assert.deepEqual([...newFields.keys()],[...oldFields.keys()],'existing skin fields changed');
  for(const [key,entry] of oldFields){
   if(key!=='imagePath')assert.equal(next.fields.get(key)?.raw,entry.raw,'existing skin metadata changed: '+key);
  }
  assert.notEqual(next.fields.get('imagePath')?.value,oldFields.get('imagePath')?.value,'skin image path unchanged');
 }
 const expected='assets/characters/appearances/'+id+'-';
 const imagePath=next.fields.get('imagePath')?.value;
 assert.ok(imagePath?.startsWith(expected),'skin image path does not match ID');
 const match=imagePath.match(new RegExp('^assets/characters/appearances/'+id+'-([a-f0-9]{12})\\.webp$'));
 assert.ok(match,'skin file must use a SHA-256 12-character WebP name');
 const oldIds=[...base.entries.keys()],headOldIds=[...head.entries.keys()].filter(x=>base.entries.has(x));
 assert.deepEqual(headOldIds,oldIds,'existing skin order changed');
 return {id,imagePath,hash:match[1],isNew:!old};
}

function main(){
 const [baseRef,headRef]=process.argv.slice(2);
 assert.ok(baseRef&&headRef,'usage: node scripts/skin-pr-guard.mjs <base-ref> <head-ref>');
 const ancestor=run('merge-base',baseRef,headRef);
 const changes=run('diff','--name-status',ancestor+'..'+headRef).split('\n').filter(Boolean).map(line=>{
  const [status,path]=line.split('\t');
  return {status,path};
 });
 assert.ok(changes.length>0,'empty PR');
 for(const {status,path} of changes){
  assert.ok(status==='A'||status==='M','skin PR must not delete, rename, or copy assets: '+path);
  assert.ok(path===CATALOG||(path.startsWith(PREFIX)&&/^[a-z][a-z0-9_]*-[a-f0-9]{12}\.webp$/.test(path.slice(PREFIX.length))),'unrelated file changed: '+path);
 }
 assert.ok(changes.some(x=>x.path===CATALOG),'skin catalog must be changed');
 const baseline=run('show',ancestor+':'+CATALOG);
 const proposed=run('show',headRef+':'+CATALOG);
 const changed=checkCatalogChange(baseline,proposed);
 const newFile='public/'+changed.imagePath;
 assert.ok(changes.some(x=>x.path===newFile&&x.status==='A'),'PR must add the new hashed artwork');
 assert.ok(changes.filter(x=>x.path!==CATALOG).every(x=>x.path===newFile),'PR must not touch other skin assets');
 assert.ok(existsSync(newFile),'new artwork must be present in the merged worktree: '+newFile);
 const actualHash=createHash('sha256').update(readFileSync(newFile)).digest('hex').slice(0,12);
 assert.equal(actualHash,changed.hash,'artwork filename hash does not match content');
 console.log('Safe skin PR: '+changed.id+' ('+(changed.isNew?'new':'replacement')+') '+changed.imagePath);
}

if(process.argv[1]&&import.meta.url===new URL('file://'+process.argv[1]).href){
 try{main();}catch(error){console.error(error.stack??String(error));process.exitCode=1;}
}
