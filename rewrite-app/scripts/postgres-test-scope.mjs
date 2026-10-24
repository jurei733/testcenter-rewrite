import {randomUUID} from 'node:crypto';
import {Pool} from 'pg';

export function postgresTestScopeUrl(connectionString, schema) {
  const url=new URL(connectionString);
  if (!['postgres:','postgresql:'].includes(url.protocol) || !/^owned_ci_pg_[a-f0-9]{32}$/.test(schema)) {
    throw Error('PostgreSQL test isolation requires a generated owned schema.');
  }
  const previous=url.searchParams.get('options');
  url.searchParams.set('options',[previous,`-c search_path=${schema}`].filter(Boolean).join(' '));
  return url.toString();
}

/** The callback finishes before cleanup. Only this invocation's generated schema
 * is removed; existing schemas/data and the caller's URL remain untouched. */
export async function withPostgresTestScope(connectionString, execute, createPool=options=>new Pool(options)) {
  const schema='owned_ci_pg_'+randomUUID().replaceAll('-','');
  const scoped=postgresTestScopeUrl(connectionString,schema);
  const pool=createPool({connectionString});
  let created=false,result,failure;
  const cleanupFailures=[];
  try {
    await pool.query(`CREATE SCHEMA "${schema}"`);created=true;
    result=await execute(scoped);
  } catch(error) { failure=error; }
  finally {
    try { if(created)await pool.query(`DROP SCHEMA "${schema}" CASCADE`); }
    catch(error){cleanupFailures.push(error);}
    try { await pool.end(); } catch(error){cleanupFailures.push(error);}
  }
  if(cleanupFailures.length)throw new AggregateError([...(failure?[failure]:[]),...cleanupFailures],
    'PostgreSQL test scope cleanup failed.');
  if(failure)throw failure;
  return result;
}
