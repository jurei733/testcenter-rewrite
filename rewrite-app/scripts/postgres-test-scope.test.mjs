import assert from 'node:assert/strict';
import test from 'node:test';
import {postgresTestScopeUrl,withPostgresTestScope} from './postgres-test-scope.mjs';
const base='postgresql://owned:owned-secret@localhost/owned?host=%2Fowned%2Fsocket&options=-c%20statement_timeout%3D45000';
const schema='owned_ci_pg_'+'a'.repeat(32);

test('scoping preserves credentials, socket and existing options while selecting only a generated schema',()=>{
 const url=new URL(postgresTestScopeUrl(base,schema)),before=new URL(base);
 for(const key of ['protocol','username','password','hostname','pathname'])assert.equal(url[key],before[key]);
 assert.equal(url.searchParams.get('host'),'/owned/socket');
 assert.equal(url.searchParams.get('options'),'-c statement_timeout=45000 -c search_path='+schema);
 assert.equal(before.searchParams.get('options'),'-c statement_timeout=45000');
 for(const bad of ['public','owned_ci_pg_other','owned_ci_pg_'+'a'.repeat(32)+';DROP SCHEMA public','"public"'])
  assert.throws(()=>postgresTestScopeUrl(base,bad));
 assert.throws(()=>postgresTestScopeUrl('https://example.invalid',schema));
});

function fixture({createFailure,dropFailure,endFailure}={}){
 const queries=[];let ended=false;
 return {queries,get ended(){return ended;},factory:options=>{
  assert.equal(options.connectionString,base);
  return {query:async sql=>{queries.push(sql);if(sql.startsWith('CREATE')&&createFailure)throw createFailure;
    if(sql.startsWith('DROP')&&dropFailure)throw dropFailure;},end:async()=>{ended=true;if(endFailure)throw endFailure;}};
 }};
}

test('a real callback status survives exact owned-schema cleanup',async()=>{
 const f=fixture();let selected;
 const status=await withPostgresTestScope(base,async connection=>{
  selected=new URL(connection).searchParams.get('options').split('search_path=')[1];
  assert.match(selected,/^owned_ci_pg_[a-f0-9]{32}$/);assert.equal(f.queries.length,1);assert.equal(f.ended,false);return 37;
 },f.factory);
 assert.equal(status,37);assert.deepEqual(f.queries,[`CREATE SCHEMA "${selected}"`,`DROP SCHEMA "${selected}" CASCADE`]);assert.equal(f.ended,true);
});

test('an interrupted/failing callback still removes only its schema and preserves the original error',async()=>{
 const f=fixture(),failure=Error('owned child failure');
 await assert.rejects(withPostgresTestScope(base,async()=>{throw failure;},f.factory),error=>error===failure);
 assert.equal(f.queries.length,2);assert.match(f.queries[1],/^DROP SCHEMA "owned_ci_pg_[a-f0-9]{32}" CASCADE$/);assert.equal(f.ended,true);
});

test('a creation failure runs no child and cannot drop a pre-existing schema',async()=>{
 const failure=Error('owned create failure'),f=fixture({createFailure:failure});let invoked=false;
 await assert.rejects(withPostgresTestScope(base,async()=>{invoked=true;},f.factory),error=>error===failure);
 assert.equal(invoked,false);assert.equal(f.queries.length,1);assert.equal(f.ended,true);
});

test('cleanup attempts pool close and retains both child and cleanup failures',async()=>{
 const childFailure=Error('owned child failure'),dropFailure=Error('owned drop failure'),endFailure=Error('owned end failure');
 const f=fixture({dropFailure,endFailure});
 await assert.rejects(withPostgresTestScope(base,async()=>{throw childFailure;},f.factory),error=>
  error instanceof AggregateError && assert.deepEqual(error.errors,[childFailure,dropFailure,endFailure])===undefined);
 assert.equal(f.ended,true);
});

test('separate invocations choose different schemas without changing the configured connection',async()=>{
 const selected=[];
 for(let i=0;i<2;i++)await withPostgresTestScope(base,async connection=>{selected.push(connection);return 0;},fixture().factory);
 assert.notEqual(selected[0],selected[1]);assert.equal(new URL(base).searchParams.get('options'),'-c statement_timeout=45000');
});

if(process.env.FIRST_SLICE_STORE==='postgres')test('actual PostgreSQL scopes clean up success/failure while unrelated owned data survives',async()=>{
 const {Pool}=await import('pg'),{randomUUID}=await import('node:crypto');
 assert.ok(process.env.FIRST_SLICE_POSTGRES_URL);
 const connectionString=process.env.FIRST_SLICE_POSTGRES_URL;
 const control=new Pool({connectionString}),retained='owned_scope_sentinel_'+randomUUID().replaceAll('-','');
 let created=false;const allocated=[];
 try{
  await control.query(`CREATE SCHEMA "${retained}"`);created=true;
  await control.query(`CREATE TABLE "${retained}".retained (value text NOT NULL)`);
  await control.query(`INSERT INTO "${retained}".retained VALUES ($1)`,['Exact owned sentinel Ω\n";']);
  for(const fail of [false,true]){
   const invoke=()=>withPostgresTestScope(connectionString,async scoped=>{
    const scopedUrl=new URL(scoped),selected=/search_path=(owned_ci_pg_[a-f0-9]{32})$/.exec(scopedUrl.searchParams.get('options'))?.[1];
    assert.ok(selected);allocated.push(selected);
    const client=new Pool({connectionString:scoped});
    try{
     assert.equal((await client.query('SELECT current_schema() AS name')).rows[0].name,selected);
     await client.query('CREATE TABLE owned_transient (value integer)');
     await client.query('INSERT INTO owned_transient VALUES (7)');
     if(fail)throw Error('Owned callback rejected after actual DDL');return 37;
    }finally{await client.end();}
   });
   if(fail)await assert.rejects(invoke,/Owned callback rejected/);else assert.equal(await invoke(),37);
   assert.equal((await control.query('SELECT to_regnamespace($1) AS name',[allocated.at(-1)])).rows[0].name,null);
   assert.deepEqual((await control.query(`SELECT value FROM "${retained}".retained`)).rows,[{value:'Exact owned sentinel Ω\n";'}]);
  }
  assert.notEqual(allocated[0],allocated[1]);
 }finally{
  try{if(created)await control.query(`DROP SCHEMA "${retained}" CASCADE`);}finally{await control.end();}
 }
});
