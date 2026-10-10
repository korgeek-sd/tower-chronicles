import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

test('mail and chat sibling identities stay distinct for guest and signed-in accounts',()=>{
 const source=readFileSync(new URL('../src/main.tsx',import.meta.url),'utf8');
 const tree=ts.createSourceFile('main.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 const keys=new Map<string,string>();
 const visit=(node:ts.Node)=>{
  if(ts.isJsxSelfClosingElement(node)&&['MailDialog','WorldChat'].includes(node.tagName.getText(tree))){
   const key=node.attributes.properties.find(p=>ts.isJsxAttribute(p)&&p.name.getText(tree)==='key');
   assert.ok(key&&ts.isJsxAttribute(key)&&key.initializer&&ts.isJsxExpression(key.initializer)&&key.initializer.expression);
   keys.set(node.tagName.getText(tree),key.initializer.expression.getText(tree));
  }
  ts.forEachChild(node,visit);
 };
 visit(tree);
 for(const userId of [null,'qa-account']){
  const values=[...keys.values()].map(expression=>new Function('onlineSession','return '+expression)(userId?{userId}:null));
  assert.equal(values.length,2);
  assert.equal(new Set(values).size,2,'duplicate sibling keys can strand a native dialog and its backdrop');
 }
});
