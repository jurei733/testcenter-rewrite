import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";

const moduleUrl = code => `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;
const angular = moduleUrl(`
  export const Component = () => target => target, Input = () => () => {};
  export const inject = token => globalThis.__originalAdminLoginHost[token.name];
  export const signal = initial => { let value = initial; const read = () => value;
    read.set = next => { value = next; }; return read; };
`);
const forms = moduleUrl(`
  export const ReactiveFormsModule = {};
  export const Validators = { required: value => value !== '', minLength: length => value => value.length >= length };
  export class FormControl {
    constructor(value, options) { this.value = value; this.validators = options.validators; }
    setValue(value) { this.value = value; }
    get invalid() { return this.validators.some(validate => !validate(this.value)); }
  }
  export class FormGroup {
    constructor(controls) { this.controls = controls; }
    get invalid() { return Object.values(this.controls).some(control => control.invalid); }
    getRawValue() { return Object.fromEntries(Object.entries(this.controls).map(([key,control]) => [key,control.value])); }
    reset(values) { for(const [key,value] of Object.entries(values)) this.controls[key].setValue(value); }
  }
`);
const ui = moduleUrl(`export const MatButton = {}, MatCardModule = {}, MatFormField = {}, MatLabel = {}, MatInput = {}, RouterLink = {};
  export class OpsViewFacade {} export class RewriteAppApiService {} export class OriginalEntrySurfaceStylesComponent {}`);
const file = new URL("../apps/web/src/app/original-admin-login.component.ts", import.meta.url);
const code = ts.transpileModule(readFileSync(file,"utf8"), { compilerOptions: {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, experimentalDecorators: true
} }).outputText.replace('"@angular/core"',JSON.stringify(angular)).replace('"@angular/forms"',JSON.stringify(forms))
  .replace(/"(?:@angular\/material\/[^"\n]+|@angular\/router|\.\/ops-view.facade|\.\/rewrite-app-api.service|\.\/original-entry-surface-styles.component)"/gu,JSON.stringify(ui));
const { OriginalAdminLoginComponent } = await import(moduleUrl(code));
const deferred = () => { let resolve,reject; const promise = new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject}; };
const withLogin = async action => {
  const previous = globalThis.__originalAdminLoginHost;
  const view = { ops:{adminUsername:"",adminPassword:""},proofOfWorkBusy:false };
  globalThis.__originalAdminLoginHost = { OpsViewFacade:view, RewriteAppApiService:{isApiError:e=>typeof e?.error==="string"} };
  const component = new OriginalAdminLoginComponent();
  const fill = (name="owned.admin",pw="owned-private-password") => component.form.reset({name,pw});
  try { await action({component,view,fill}); }
  finally { component.ngOnDestroy(); if(previous===undefined)delete globalThis.__originalAdminLoginHost;else globalThis.__originalAdminLoginHost=previous; }
};

test("Original administrator gate requires the actual three-character form and a password",async()=>{
  await withLogin(async({component,fill,view})=>{
    let calls=0;component.authenticate=async()=>{calls++;};
    fill("ab");await component.submit();fill("owned.admin","");await component.submit();
    fill();view.proofOfWorkBusy=true;await component.submit();assert.equal(calls,0);
    view.proofOfWorkBusy=false;await component.submit();assert.equal(calls,1);
    assert.equal(component.form.controls.pw.value,"");assert.equal(view.ops.adminPassword,"");
    assert.equal(view.ops.adminUsername,"owned.admin");
  });
});
test("a pending login cannot duplicate its authorized callback or change its Caps Lock feedback",async()=>{
  await withLogin(async({component,fill,view})=>{
    const pending=deferred();let calls=0;component.authenticate=()=>{calls++;return pending.promise;};fill();
    const first=component.submit();await component.submit();
    component.passwordKeyUp({getModifierState:()=>true});assert.equal(component.problem(),"");
    assert.equal(component.busy(),true);assert.equal(calls,1);assert.equal(view.ops.adminPassword,"owned-private-password");
    pending.resolve();await first;assert.equal(component.busy(),false);assert.equal(view.ops.adminPassword,"");
  });
});
test("semantic credential/access/rate errors use Source copy, not the Rewrite HTTP status",async()=>{
  await withLogin(async({component,fill,view})=>{
    for(const[error,statusCode,code,copy]of[
      ["admin_credentials_invalid",401,400,"Anmeldedaten sind nicht gültig. Bitte noch einmal versuchen!"],
      ["admin_username_required",400,400,"Anmeldedaten sind nicht gültig. Bitte noch einmal versuchen!"],
      ["admin_access_not_started",403,401,"Anmeldung abgelehnt. Anmeldedaten sind noch nicht freigeben."],
      ["admin_access_expired",410,410,"Anmeldedaten sind abgelaufen"],
      ["admin_login_rate_limited",429,429,"Zu viele Fehlversuche! Probieren Sie es zu einem späteren Zeitpunkt noch einmal."]
    ]){
      fill();component.authenticate=async()=>{throw{error,statusCode,message:"Do not expose private server data"};};await component.submit();
      assert.equal(component.problemCode(),code);assert.equal(component.problem(),copy);
      assert.equal(component.warning(),false);assert.deepEqual(component.form.getRawValue(),{name:"",pw:""});assert.equal(view.ops.adminPassword,"");
    }
  });
});
test("unknown/network failures are sanitized and never leave the password in either controller",async()=>{
  await withLogin(async({component,fill,view})=>{
    fill();component.authenticate=async()=>{throw Error("server secret: owned-private-password");};await component.submit();
    assert.equal(component.problem(),"Problem bei der Anmeldung.");assert.equal(component.problemCode(),0);
    assert.equal(view.ops.adminPassword,"");assert.equal(component.form.controls.pw.value,"");
  });
});
test("Caps Lock warnings reset on normal and legacy key events",async()=>{
  await withLogin(async({component})=>{
    component.passwordKeyUp({getModifierState:()=>true});assert.equal(component.problem(),"Feststelltaste ist aktiviert!");assert.equal(component.warning(),true);
    component.passwordKeyUp({getModifierState:()=>false});assert.equal(component.problem(),"");assert.equal(component.warning(),false);
    component.passwordKeyUp({});assert.equal(component.problem(),"");
  });
});
test("a destroyed login clears its secret immediately and cannot erase a replacement login on late failure",async()=>{
  await withLogin(async({component,fill,view})=>{
    const pending=deferred();component.authenticate=()=>pending.promise;fill();const first=component.submit();
    component.ngOnDestroy();assert.equal(component.form.controls.pw.value,"");assert.equal(view.ops.adminPassword,"");
    view.ops.adminPassword="replacement-secret";pending.reject({error:"admin_credentials_invalid"});await first;
    assert.equal(component.problem(),"");assert.equal(view.ops.adminPassword,"replacement-secret");
    await component.submit();assert.equal(component.busy(),false);
  });
});

// Execute the actual wrapper methods without importing their unrelated list,
// export and asset-editor dependencies into this focused controller test.
const readMethod = (file, className, methodName) => {
  const source = ts.createSourceFile(file, readFileSync(new URL(`../apps/web/src/app/${file}.ts`,import.meta.url),"utf8"), ts.ScriptTarget.ES2022,true);
  const declaration = source.statements.find(node => ts.isClassDeclaration(node) && node.name?.text===className);
  const method = declaration?.members.find(node => ts.isMethodDeclaration(node) && node.name.getText(source)===methodName);
  assert.ok(method,`Actual ${className}.${methodName} must exist.`);return method.getText(source);
};
const facadeModule = ts.transpileModule(`
  export class ActualSignInWrapper { ${readMethod("ops-view.facade","OpsViewFacade","signInFromOriginalInterface")} }
  export class ActualActionWrapper { ${readMethod("rewrite-app-view-state.service","RewriteAppViewStateService","runActionAsync")} }
`,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const { ActualSignInWrapper, ActualActionWrapper } = await import(moduleUrl(facadeModule));

test("the actual Original facade preserves structured auth failures without reading protected assets",async()=>{
  const wrapper=new ActualSignInWrapper(), action=new ActualActionWrapper();let versions=0,batches=0,assets=0;
  const uiState={renderVersion:{update(){versions++;}}};wrapper.uiState=uiState;action.uiState=uiState;
  wrapper.viewState=action;wrapper.clearAdminBatches=()=>{batches++;};wrapper.loadApplicationAssetsIfAllowed=async()=>{assets++;};
  const failure={error:"admin_username_required",statusCode:400};wrapper.opsService={signInAdmin:async()=>{throw failure;}};
  await assert.rejects(wrapper.signInFromOriginalInterface(),error=>error===failure);
  assert.equal(batches,1);assert.equal(assets,0);assert.equal(versions,1);
});
test("the actual Original facade retains acknowledged authorization when the following asset read fails",async()=>{
  const wrapper=new ActualSignInWrapper(), action=new ActualActionWrapper();let signedIn=false,versions=0,assets=0;
  const uiState={renderVersion:{update(){versions++;}}};wrapper.uiState=uiState;action.uiState=uiState;
  wrapper.viewState=action;wrapper.clearAdminBatches=()=>{};
  wrapper.opsService={signInAdmin:async()=>{signedIn=true;}};
  wrapper.loadApplicationAssetsIfAllowed=async()=>{assert.equal(signedIn,true);assets++;throw Error("Owned post-auth read failure");};
  await wrapper.signInFromOriginalInterface();assert.equal(signedIn,true);assert.equal(assets,1);assert.equal(versions,2);
});
