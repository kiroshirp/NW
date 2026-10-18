import fs from 'node:fs';
import path from 'node:path';
import ts from '../../apps/web/node_modules/typescript/lib/typescript.js';
const dictionary = JSON.parse(fs.readFileSync(new URL('./es-ES.json', import.meta.url), 'utf8'));
const uiKeys = new Set(['label','title','subtitle','description','placeholder','tooltip','content','message','aria-label','alt','emptyMessage','loadingText','text']);
let total = 0;
function translateFile(file) {
 const source=fs.readFileSync(file,'utf8');
 const ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 const edits=[];
 function visit(n) {
  if(ts.isJsxText(n)) {
   const value=n.getText(ast); const key=value.replace(/\s+/g,' ').trim();
   if(dictionary[key]) edits.push([n.getStart(ast),n.end,value.replace(/\S[\s\S]*\S|\S/,dictionary[key])]);
  } else if(ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) {
   const p=n.parent;
   const isAttribute=ts.isJsxAttribute(p)&&uiKeys.has(p.name.getText(ast));
   const isProperty=ts.isPropertyAssignment(p)&&uiKeys.has(p.name.getText(ast).replace(/["']/g,''));
   let expression=n.parent;
   while(expression && (ts.isConditionalExpression(expression)||ts.isBinaryExpression(expression)||ts.isParenthesizedExpression(expression))) expression=expression.parent;
   const isVisibleExpression=expression&&ts.isJsxExpression(expression)&&(!ts.isJsxAttribute(expression.parent)||uiKeys.has(expression.parent.name.getText(ast)));
   if((isAttribute||isProperty||isVisibleExpression)&&dictionary[n.text]) edits.push([n.getStart(ast),n.end,JSON.stringify(dictionary[n.text])]);
  }
  ts.forEachChild(n,visit);
 }
 visit(ast);
 if(edits.length){let out=source;for(const [a,b,text] of edits.sort((a,b)=>b[0]-a[0]))out=out.slice(0,a)+text+out.slice(b);fs.writeFileSync(file,out);total+=edits.length;}
}
function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())walk(file);else if(/\.tsx$/.test(file)&&!file.includes('.test.'))translateFile(file);}}
walk('apps/web/src');walk('packages/ui/src');
console.log(`Applied ${total} Spanish UI translations.`);
