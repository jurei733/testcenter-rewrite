import {DOMParser} from '@xmldom/xmldom';
import {inspectOriginalHtmlResource} from './original-resource-metadata.js';
import type {WorkspaceFileValidationReport} from '@testcenter-rewrite-app/domain';
import {normalizeWorkspacePlayerResourceId,type WorkspaceCatalogInput} from './workspace-file-catalog.js';
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
    const parsed=inspectOriginalHtmlResource(input.fileName,input.sourceText??'',input.sourceBytes);
    for(const message of parsed.errors)add('error',message);
    for(const message of parsed.warnings)add('warning',message);
    for(const message of parsed.info)add('info',message);
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
