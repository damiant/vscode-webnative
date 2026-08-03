# WebNative CLI agent skills

Agent skills for the `npx wn` CLI, split by how often the commands get used. Each `SKILL.md` is self-contained — it repeats the CLI contract (JSON output, exit codes, non-interactive behaviour) so an agent that loads only one still behaves correctly.

| Skill                                                 | Covers                           | Commands                                                                         |
| ----------------------------------------------------- | -------------------------------- | -------------------------------------------------------------------------------- |
| [web-native](./web-native/SKILL.md)                   | The daily loop                   | `info`, `run`, `build`, `sync`, `devices`, `debug`, `scripts`, `stop`, `release` |
| [web-native-config](./web-native-config/SKILL.md)     | Project and native configuration | `native`, `assets`, `new`, `generate`, `integrate`, `config`                     |
| [web-native-packages](./web-native-packages/SKILL.md) | Dependencies and plugins         | `packages`, `plugins`                                                            |
| [web-native-migrate](./web-native-migrate/SKILL.md)   | Health checks and version moves  | `check`, `migrate`, `generate migration`                                         |

`web-native` is the one to load by default. The other three are for less frequent, higher-risk work and carry the extra guardrails that work needs.

Full CLI specification: [../docs.md](../docs.md).

## Installing

Copy a skill directory into either location:

- `~/.cursor/skills/<name>/` — personal, available in every project
- `.cursor/skills/<name>/` — project-scoped, shared with the repository
