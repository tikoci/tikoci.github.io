# House skills

Source of the tikoci house skills: `SKILL.md` defaults for developing and
maintaining tikoci repositories. The build publishes each skill directory
unchanged at `https://tikoci.dev/house/skills/<name>/` and lists them at
<https://tikoci.dev/house/>. Planning and the skill list:
[issue #21](https://github.com/tikoci/tikoci.github.io/issues/21) and
[docs/house/](https://github.com/tikoci/tikoci.github.io/tree/main/docs/house).

Start with [tikoci-house](tikoci-house/SKILL.md): how repos adopt these skills
and where agent instructions live. Writing and checking a skill:
[tikoci-house/references/writing-house-skills.md](tikoci-house/references/writing-house-skills.md).

## Published files

| URL | Holds |
| --- | --- |
| `/house/` | Index page rendered from each skill's frontmatter. |
| `/house/index.json` | `schemaVersion` 1: `skills[]` with `name`, `description`, `url` (absolute `SKILL.md` URL) and `files` (paths relative to the skill directory). |
| `/house/skills/<name>/SKILL.md` | The skill, byte for byte. |
| `/house/skills/<name>/references/...` | Supporting files, at the same relative paths as in the repo. |

To copy a skill into a repo:

```sh
cp -r path/to/tikoci.github.io/skills/tikoci-house .agents/skills/
```

or fetch each path in `files` from `index.json` under the skill's URL.
