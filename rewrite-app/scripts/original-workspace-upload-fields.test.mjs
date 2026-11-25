import assert from 'node:assert/strict';
import test from 'node:test';
import {handleOriginalWorkspaceHttp} from '../apps/api/dist/apps/api/src/original-workspace-http.js';

const scope = {tenantId:'tenant',workspaceId:'workspace',tenantKey:'owned',workspaceKey:'files'};
async function submit(parts) {
  const form = new FormData();
  for (const [field,name,content] of parts) {
    if (content === undefined) form.append(field,name);
    else form.append(field,new Blob([content]),name);
  }
  const request = new Request('http://127.0.0.1/workspace/1/file',{method:'POST',body:form});
  const payload = Buffer.from(await request.arrayBuffer());
  const uploads = [];
  let reply;
  const handled = await handleOriginalWorkspaceHttp({
    request: {headers:{authtoken:'owned','content-type':request.headers.get('content-type')},method:request.method},
    pathname:'/workspace/1/file',
    services:{
      originalWorkspaceAdministration:{
        resolve:async()=>scope,
        authorizeWrite:async()=>({...scope,authority:{token:'owned'}}),
        acquireFileMutation:async()=>({id:'owned-mutation',release:async()=>{}})
      },
      contentIntake:{
        async uploadOriginalWorkspaceFiles({files}) {
          uploads.push(...files.map(({fileName,bytes})=>[fileName,Buffer.from(bytes).toString()]));
          return {report:{},containsErrors:false};
        }
      }
    },
    readUpload:async()=>payload,
    propagateError:()=>false,
    header(){},
    raw(status,body){reply={status,body};}
  });
  assert.equal(handled,true);
  assert.equal(reply.status,201,reply.body);
  return uploads;
}

test('Original workspace multipart keeps the most recent scalar or array field shape',async()=>{
  assert.deepEqual(await submit([
    ['fileforvo[]','discarded.txt','Old array'],
    ['fileforvo','scalar.txt','New scalar']
  ]),[['scalar.txt','New scalar']]);

  assert.deepEqual(await submit([
    ['fileforvo[tag]','discarded-a.txt','Old keyed slot'],
    ['fileforvo','discarded-b.txt','Intermediate scalar'],
    ['fileforvo[0]','indexed.txt','New keyed slot'],
    ['fileforvo[]','append.txt','New append']
  ]),[['indexed.txt','New keyed slot'],['append.txt','New append']]);
});

test('Original workspace multipart replaces explicit slots in place and appends after the highest numeric slot',async()=>{
  assert.deepEqual(await submit([
    ['fileforvo[2]','discarded.txt','First index two'],
    ['fileforvo[0]','zero.txt','Index zero'],
    ['fileforvo[2]','two.txt','Current index two'],
    ['fileforvo[]','discarded-append.txt','Implicit index three'],
    ['fileforvo[3]','three.txt','Current index three']
  ]),[['two.txt','Current index two'],['zero.txt','Index zero'],['three.txt','Current index three']]);
});

test('Original workspace multipart retains named and zero-prefixed slots independently of input text fields',async()=>{
  assert.deepEqual(await submit([
    ['fileforvo[photo]','discarded.txt','Old photo'],
    ['fileforvo[01]','prefix.txt','String index 01'],
    ['fileforvo','A separate text field'],
    ['fileforvo[photo]','photo.txt','Current photo'],
    ['fileforvo[1]','index.txt','Numeric index 1'],
    ['fileforvo[]','append.txt','Implicit index 2']
  ]),[['photo.txt','Current photo'],['prefix.txt','String index 01'],['index.txt','Numeric index 1'],['append.txt','Implicit index 2']]);
});

test('Original workspace multipart keeps PHP integer slots exact across signed and large indexes',async()=>{
  assert.deepEqual(await submit([
    ['fileforvo[named]','name.txt','Named slot'],
    ['fileforvo[-2]','negative.txt','First signed slot'],
    ['fileforvo[]','discarded-negative.txt','Implicit minus one'],
    ['fileforvo[-1]','negative-next.txt','Current minus one'],
    ['fileforvo[9007199254740993]','wide.txt','Large numeric slot'],
    ['fileforvo[]','discarded-wide.txt','Implicit next large index'],
    ['fileforvo[9007199254740994]','wide-next.txt','Current next large index']
  ]),[['name.txt','Named slot'],['negative.txt','First signed slot'],['negative-next.txt','Current minus one'],
      ['wide.txt','Large numeric slot'],['wide-next.txt','Current next large index']]);
});
