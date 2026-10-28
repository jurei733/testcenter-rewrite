import assert from "node:assert/strict";
import { createServer } from "node:net";
import { test } from "node:test";
import { drainSmokeResponse } from "./drain-smoke-response.mjs";

async function withWireResponse(writeResponse, check) {
  const sockets = new Set();
  const server = createServer(socket => {
    sockets.add(socket);
    socket.once("close", () => sockets.delete(socket));
    socket.once("data", () => writeResponse(socket));
  });
  await new Promise(done => server.listen(0, "127.0.0.1", done));
  try {
    await check(`http://127.0.0.1:${server.address().port}/owned-fixture`);
  } finally {
    for (const socket of sockets) socket.destroy();
    await new Promise(done => server.close(done));
  }
}

test("status-only setup waits for the real delayed body after successful headers", async () => {
  let finishBody;
  await withWireResponse(socket => {
    socket.write("HTTP/1.1 200 OK\r\nContent-Length: 2\r\nConnection: close\r\n\r\n{");
    finishBody = () => socket.end("}");
  }, async url => {
    const response = await fetch(url);
    assert.equal(response.status, 200);
    let completed = false;
    const drained = drainSmokeResponse(response).then(() => { completed = true; });
    await new Promise(done => setImmediate(done));
    assert.equal(completed, false, "Headers cannot release the body-consumption barrier");
    finishBody();
    await drained;
    assert.equal(response.bodyUsed, true);
    assert.equal(response.body.locked, false);
  });
});

test("successful status cannot hide a real truncated setup body", async () => {
  await withWireResponse(socket => {
    socket.write("HTTP/1.1 200 OK\r\nContent-Length: 20\r\nConnection: close\r\n\r\n{");
    setTimeout(() => socket.end(), 25);
  }, async url => {
    const response = await fetch(url);
    assert.equal(response.status, 200);
    await assert.rejects(drainSmokeResponse(response), error => {
      assert.match(error.cause.code, /^UND_ERR_(?:SOCKET|RES_CONTENT_LENGTH_MISMATCH)$/);
      return true;
    });
    assert.equal(response.body.locked, false);
  });
});

test("bodyless setup responses need no reader", async () => {
  await drainSmokeResponse(new Response(null, { status: 204 }));
});
