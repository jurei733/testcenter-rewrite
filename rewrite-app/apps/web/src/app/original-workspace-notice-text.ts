export type OriginalWorkspaceNoticeTextPart={text:string;highlight:boolean};

/** Match Original AlertComponent.highlightTicks, while retaining text nodes.
 * A filename or validator message must never become executable markup. */
export function originalWorkspaceNoticeText(value:string):OriginalWorkspaceNoticeTextPart[]{
  const parts:OriginalWorkspaceNoticeTextPart[]=[];
  const pairs=/\u0060([^\u0060]+)\u0060/g;
  let offset=0;
  for(const match of value.matchAll(pairs)){
    if(match.index!>offset)parts.push({text:value.slice(offset,match.index),highlight:false});
    parts.push({text:match[1]!,highlight:true});offset=match.index!+match[0].length;
  }
  if(offset<value.length)parts.push({text:value.slice(offset),highlight:false});
  return parts;
}
