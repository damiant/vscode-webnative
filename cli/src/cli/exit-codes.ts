/** Exit codes from cli/docs.md */
export const ExitCode = {
  Success: 0,
  CommandFailed: 1,
  UsageError: 2,
  NoProject: 3,
  MissingTool: 4,
  MissingInput: 5,
  CheckFailed: 6,
  Timeout: 7,
  Interrupted: 130,
} as const;

export type ExitCodeValue = (typeof ExitCode)[keyof typeof ExitCode];
