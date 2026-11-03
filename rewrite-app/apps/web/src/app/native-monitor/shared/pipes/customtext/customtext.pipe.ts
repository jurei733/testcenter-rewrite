import {CustomtextService} from '../../services/customtext/customtext.service';
export class CustomtextPipe {
 constructor(private cts:CustomtextService){}
 transform(defaultValue:string,key:string,...replacements:Array<string|number>):string {
  let text=this.cts.getCustomText(key)||defaultValue;
  for(const value of replacements){const replacement=String(value);text=text.replace('%s',replacement).replace('%date',new Date(replacement).toLocaleString());}
  return text;
 }
}
