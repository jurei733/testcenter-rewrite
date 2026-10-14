import assert from 'node:assert/strict';

export const observeParticipantCommandCompletions = page => {
  const packets = [];
  page.on('request', request => {
    if (new URL(request.url()).pathname.endsWith('/command-completions')) packets.push(request.postDataJSON());
  });
  return packets;
};

export const assertNativeCommandCompletion = async ({ repository, run, request, packets, poll }) => {
  const readLogs = async () => (await repository.listParticipantTestLogsByWorkspace(run.tenantId, run.workspaceId))
    .filter(log => log.testRunId === run.testRunId && log.logKey === 'command executed');
  if (request.commandCompletion !== 'browser-v1') {
    await poll(async () => (await readLogs()).filter(log => log.participantTestLogId.startsWith(`delivery:${run.testRunId}:console:${request.deliveryId}:`)).length === 1,
      'The legacy native command was not logged exactly once');
    return;
  }
  const matching = () => packets.filter(packet => packet.testRunId === run.testRunId && packet.command?.kind === 'native' &&
    packet.command.request.deliveryId === request.deliveryId);
  await poll(async () => matching().length > 0, 'The fulfilled native handler did not submit its completion identity');
  const first = matching()[0];
  assert.deepEqual(first.command.request, request);
  assert.equal(first.contentReleaseId, run.contentReleaseId); assert.equal(first.bookletKey, run.bookletKey);
  const content = [request.keyword, ...request.arguments].join(' ');
  await poll(async () => (await readLogs()).filter(log => log.timestamp === first.timeStamp && log.logContent === content).length === 1,
    'The fulfilled native completion was not logged exactly once with its captured timestamp');
  for (const packet of matching()) assert.deepEqual(packet, first, 'A completion replay changed its timestamp or identity');
};
