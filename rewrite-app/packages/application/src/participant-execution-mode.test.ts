import assert from "node:assert/strict";
import test from "node:test";

import { participantExecutionModeDefinitions } from "@testcenter-rewrite-app/domain";

test("participant execution modes match the original Testcenter matrix", () => {
  assert.deepEqual(
    Object.fromEntries(
      Object.entries(participantExecutionModeDefinitions).map(([mode, definition]) => [
        mode,
        {
          alwaysNewSession: definition.alwaysNewSession,
          monitorable: definition.monitorable,
          canReview: definition.canReview,
          saveResponses: definition.saveResponses,
          forceTimeRestrictions: definition.forceTimeRestrictions,
          forceNaviRestrictions: definition.forceNaviRestrictions,
          presetCode: definition.presetCode,
          showTimeLeft: definition.showTimeLeft,
          showUnitMenu: definition.showUnitMenu,
          receiveRemoteCommands: definition.receiveRemoteCommands,
          canChangeStateOptions: definition.canChangeStateOptions
        }
      ])
    ),
    {
      "run-demo": {
        alwaysNewSession: false,
        monitorable: false,
        canReview: false,
        saveResponses: false,
        forceTimeRestrictions: false,
        forceNaviRestrictions: false,
        presetCode: true,
        showTimeLeft: false,
        showUnitMenu: false,
        receiveRemoteCommands: false,
        canChangeStateOptions: true
      },
      "run-hot-return": {
        alwaysNewSession: false,
        monitorable: true,
        canReview: false,
        saveResponses: true,
        forceTimeRestrictions: true,
        forceNaviRestrictions: true,
        presetCode: false,
        showTimeLeft: false,
        showUnitMenu: false,
        receiveRemoteCommands: true,
        canChangeStateOptions: false
      },
      "run-hot-restart": {
        alwaysNewSession: true,
        monitorable: true,
        canReview: false,
        saveResponses: true,
        forceTimeRestrictions: true,
        forceNaviRestrictions: true,
        presetCode: false,
        showTimeLeft: false,
        showUnitMenu: false,
        receiveRemoteCommands: true,
        canChangeStateOptions: false
      },
      "run-review": {
        alwaysNewSession: false,
        monitorable: false,
        canReview: true,
        saveResponses: false,
        forceTimeRestrictions: false,
        forceNaviRestrictions: false,
        presetCode: true,
        showTimeLeft: true,
        showUnitMenu: true,
        receiveRemoteCommands: false,
        canChangeStateOptions: true
      },
      "run-trial": {
        alwaysNewSession: false,
        monitorable: true,
        canReview: true,
        saveResponses: true,
        forceTimeRestrictions: false,
        forceNaviRestrictions: false,
        presetCode: true,
        showTimeLeft: true,
        showUnitMenu: true,
        receiveRemoteCommands: false,
        canChangeStateOptions: true
      },
      "run-simulation": {
        alwaysNewSession: false,
        monitorable: false,
        canReview: false,
        saveResponses: false,
        forceTimeRestrictions: true,
        forceNaviRestrictions: true,
        presetCode: false,
        showTimeLeft: false,
        showUnitMenu: false,
        receiveRemoteCommands: false,
        canChangeStateOptions: false
      }
    }
  );
});
