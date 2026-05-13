import type {
  BlockedActivationFlowHost,
  BootstrapWorkspaceFlowHost,
  ImportActivateFlowHost,
  ParticipantHappyPathFlowHost
} from "./rewrite-app-shell.workflows";

export function createBootstrapWorkspaceFlowHost(
  args: BootstrapWorkspaceFlowHost
): BootstrapWorkspaceFlowHost {
  return args;
}

export function createImportActivateFlowHost(
  args: ImportActivateFlowHost
): ImportActivateFlowHost {
  return args;
}

export function createBlockedActivationFlowHost(
  args: BlockedActivationFlowHost
): BlockedActivationFlowHost {
  return args;
}

export function createParticipantHappyPathFlowHost(
  args: ParticipantHappyPathFlowHost
): ParticipantHappyPathFlowHost {
  return args;
}
