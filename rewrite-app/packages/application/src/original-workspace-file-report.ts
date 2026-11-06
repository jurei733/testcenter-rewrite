import {DOMParser,type Element} from '@xmldom/xmldom';
import type {WorkspaceFileValidationReport} from '@testcenter-rewrite-app/domain';
import {workspaceFileReplacementIdentity,normalizeWorkspacePlayerResourceId,type WorkspaceCatalogInput} from './workspace-file-catalog.js';
import {originalXmlSchemaPolicy} from './original-xml-schema.js';

/** Source File::report keeps four messages and an aggregate in position five.
 * Reports belong to the authenticated upload response, never the public catalog. */
export function appendWorkspaceFileReport(report:WorkspaceFileValidationReport,level:'error'|'warning'|'info',message:string):void {
  const rows=report[level]??=[];
  if(rows.length===5){const prior=/^(\d+) more (?:error|warning|info)s\.$/.exec(rows[4]!);rows[4]=`${prior?Number(prior[1])+1:2} more ${level}s.`;}
  else rows.push(message);
  report[level]=rows;
}

export function readWorkspaceFileReport(input:WorkspaceCatalogInput,{unused=false,archiveEntries}:{unused?:boolean;archiveEntries?:number}={}):WorkspaceFileValidationReport {
  const report:WorkspaceFileValidationReport={};
  const add=(level:'error'|'warning'|'info',message:string)=>appendWorkspaceFileReport(report,level,message);
  const name=input.fileName.split('/').at(-1)!;
  if(input.fileType==='Resource'&&/\.html$/i.test(name)){
    let document;
    try{document=new DOMParser({onError(){}}).parseFromString(input.sourceText??'','text/html');}catch{}
    const scripts=document?.getElementsByTagName('script');let raw:string|undefined;
    for(let i=0;i<(scripts?.length??0);i++)if(scripts!.item(i)?.getAttribute('type')==='application/ld+json'){raw=scripts!.item(i)?.textContent??'';break;}
    let metadata:Record<string,unknown>|undefined,problem='No Metadata Element';
    if(raw!==undefined){try{const value:unknown=JSON.parse(raw);if(value&&typeof value==='object'&&!Array.isArray(value)){
      metadata=value as Record<string,unknown>;problem=metadata.$schema===undefined?'Could not read metadata: $schema missing':`Wrong metadata-schema: ${String(metadata.$schema)}`;
    }else problem='Could not read metadata: invalid object';}catch{problem='Could not read metadata: invalid JSON';}}
    const current=metadata?.$schema==='https://raw.githubusercontent.com/verona-interfaces/metadata/master/verona-module-metadata.json';
    const context=!current&&metadata?.['@context']==='https://w3id.org/iqb/verona-modules';
    const tags=document?.getElementsByTagName('meta');let legacy:Element|undefined;
    if(!current&&!context)for(let i=0;i<(tags?.length??0);i++){const tag=tags!.item(i);if(tag?.getAttribute('name')==='application-name'&&tag.getAttribute('content')){legacy=tag;break;}}
    if(context)add('warning','Deprecated meta-data-format found!');
    else if(legacy)add('warning','Metadata in meta-tag is deprecated!');
    else if(!current)add('warning',problem);
    const version=current||context?metadata?.version:legacy?.getAttribute('data-version');
    if(typeof version!=='string'||!version||/^0\.0\.0$/.test(version))add('warning','Metadata missing. Version guessed from Filename.');
    const spec=current?metadata?.specVersion:context?metadata?.apiVersion:legacy?.getAttribute('data-api-version');
    if(spec)add('info',`Verona-Version: ${String(spec)}`);
    const identity=workspaceFileReplacementIdentity(input);
    if(identity.moduleId&&identity.version){const recommended=`${identity.moduleId}-${identity.identifier.match(/-(\d+\.\d+)$/)?.[1]??'0.0'}.html`;
      if(name!==recommended)add('warning',`Non-Standard-Filename: \`${recommended}\` expected.`);}
  }
  if(input.fileType==='Resource'&&/\.itcr\.zip$/i.test(name)&&archiveEntries!==undefined)add('info',`Contains ${archiveEntries} files.`);
  if(input.sourceText&&!/<!DOCTYPE\b/i.test(input.sourceText)&&['Unit','Booklet','Testtakers','SysCheck'].includes(input.fileType)){
    let document;
    try{document=new DOMParser({onError(){}}).parseFromString(input.sourceText,'application/xml');}catch{}
    if(input.fileType==='Unit'&&document){
      const definitions=[...Array.from(document.getElementsByTagName('Definition'))];
      for(const element of definitions)if(element.hasAttribute('type'))add('warning','Element `/Unit/Definition/@type` is deprecated.');
      const headers=document.getElementsByTagName('Metadata');
      for(let i=0;i<headers.length;i++)for(let n=0;n<headers.item(i)!.getElementsByTagName('Lastchange').length;n++)add('warning','Element `/Unit/Metadata/Lastchange` is deprecated.');
      const dependencies=document.getElementsByTagName('Dependencies');
      for(let i=0;i<dependencies.length;i++)for(let n=0;n<dependencies.item(i)!.getElementsByTagName('file').length;n++)add('warning','Element `/Unit/Dependencies/file` is deprecated.');
      const variables=document.getElementsByTagName('BaseVariables');let attachments=0;
      for(let i=0;i<variables.length;i++){const rows=variables.item(i)!.getElementsByTagName('Variable');for(let n=0;n<rows.length;n++)if(rows.item(n)?.getAttribute('type')==='attachment')attachments++;}
      if(attachments)add('info',`\`${attachments}\` attachment(s) requested.`);
    }
  }
  if(unused&&['Resource','Unit','Booklet'].includes(input.fileType))add('warning',`${input.fileType} is never used`);
  return report;
}

/** Translate native intake failures with a measured Source equivalent. Existing
 * validation codes/gates remain authoritative; no raw parser or roster data is
 * added to the separate catalog read model. */
export function workspaceFileReportErrors(input:WorkspaceCatalogInput,error:{errorCode:string;message:string;details?:unknown}):string[]{
  const details=error.details as {diagnostics?:Array<{severity:string;code:string;message:string}>;unresolvedReferences?:Array<{reference:string;fileType:string;relationship:string}>}|undefined;
  const diagnostics=details?.diagnostics?.filter(row=>row.severity==='error');
  if(error.errorCode==='source_package_file_name_too_long')return['Filename too long!'];
  if(diagnostics?.some(row=>row.code==='testcenter_xml_schema_reference_missing')){
    const type=input.fileType as keyof typeof originalXmlSchemaPolicy,policy=originalXmlSchemaPolicy[type];
    if(policy)return[`File has no link to XSD-schema. Expected a schema URL like \`https://w3id.org/iqb/spec/${policy.repo}/<version>\` with major version ${policy.min} to ${policy.max}.`];
  }
  if(diagnostics?.some(row=>row.code==='testcenter_xml_root_invalid')&&input.sourceText){
    try{const document=new DOMParser({onError(){}}).parseFromString(input.sourceText,'application/xml');return[`Invalid root-tag: \`${document.documentElement?.nodeName??''}\``];}catch{}
  }
  if(error.errorCode==='workspace_file_dependencies_unresolved'&&details?.unresolvedReferences){
    const missing=details.unresolvedReferences;
    if(input.fileType==='Unit'){
      const resources=missing.filter(row=>row.relationship!=='usesPlayer');
      return resources.length?resources.map(row=>`Resource \`${row.reference}\` not found`):missing.map(row=>`Player not found \`${(normalizeWorkspacePlayerResourceId(row.reference)??row.reference).replace(/[a-z]/g,letter=>letter.toUpperCase())}\`.`);
    }
    if(input.fileType==='Booklet')return missing.map(row=>`Unit \`${row.reference.replace(/[a-z]/g,letter=>letter.toUpperCase())}\` not found`);
    if(input.fileType==='Testtakers'&&input.sourceText){
      const result:string[]=[];
      try{const document=new DOMParser({onError(){}}).parseFromString(input.sourceText,'application/xml'),logins=document.getElementsByTagName('Login');
        for(let i=0;i<logins.length;i++){const login=logins.item(i)!,books=login.getElementsByTagName('Booklet');for(let n=0;n<books.length;n++){
          const id=(books.item(n)?.textContent??'').replace(/\s/g,'').split('#')[0]!;
          if(missing.some(row=>row.reference.toUpperCase()===id.toUpperCase()))result.push(`Booklet \`${id.replace(/[a-z]/g,letter=>letter.toUpperCase())}\` not found for login \`${login.getAttribute('name')??''}\``);
        }}
      }catch{}
      if(result.length)return result;
    }
  }
  return diagnostics?.length?diagnostics.map(row=>row.message):[error.message.replace(/(File of name `)(?:Unit|Booklet|Testtakers|SysCheck|Resource)\//,'$1')];
}
