// Held responses deliberately outlive the API's idle keep-alive timeout.
// Give each test forwarding operation its own connection, including the first,
// rather than racing the server's retirement of a previously pooled socket.
// Never replay a mutation: a lost reply must still fail the scenario gate.
export function fetchHeldSmokeRoute(route) {
  return route.fetch({
    headers: { ...route.request().headers(), connection: "close" },
    maxRetries: 0
  });
}
