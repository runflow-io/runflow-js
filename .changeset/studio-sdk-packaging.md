---
"@runflow-io/studio": patch
---

Stop declaring `@runflow-io/sdk` as a peerDependency — it has always been bundled into the studio's dist (`tsup noExternal`), so consumers never needed to install it. This also stops changesets from major-bumping the studio whenever the bundled SDK takes a minor. The build now tracks the workspace SDK directly (`workspace:*` devDependency).
