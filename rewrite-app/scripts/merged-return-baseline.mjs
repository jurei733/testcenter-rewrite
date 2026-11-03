const clock = value => Number.isSafeInteger(value) && value >= 0;

// The owned fixture sends answer, progress and Player state in three ordered
// notifications. Freeze the unchanged-state baseline only after all three have
// persisted. Later retention assertions still compare the exact envelope.
export function matchesMergedReturnBaseline(raw, answer) {
  try {
    const state = JSON.parse(raw);
    const unit = state.unitState, player = state.playerState, times = state.fieldTimestamps;
    const answerAt = times?.dataParts?.answer;
    const progressAt = times?.unitState?.responseProgress;
    const presentationAt = times?.unitState?.presentationProgress;
    const pageAt = times?.playerState?.currentPage;
    const pagesAt = times?.playerState?.validPages;
    return state.kind === 'verona_unit_state' && state.version === 1 &&
      unit?.dataParts?.answer === answer && unit.unitStateDataType === 'verona-smoke@1' &&
      state.dataPartValueTypes?.answer === 'string' &&
      unit.presentationProgress === 'complete' && unit.responseProgress === 'complete' &&
      player?.currentPage === 'page-1' && Array.isArray(player.validPages) && player.validPages.length === 2 &&
      player.validPages[0]?.id === 'page-1' && player.validPages[0]?.label === 'Introduction' &&
      player.validPages[1]?.id === 'page-2' && player.validPages[1]?.label === 'Review' &&
      [answerAt, progressAt, presentationAt, pageAt, pagesAt].every(clock) &&
      progressAt >= answerAt && presentationAt >= answerAt &&
      pageAt >= Math.max(progressAt, presentationAt) && pagesAt >= Math.max(progressAt, presentationAt);
  } catch {return false;}
}
