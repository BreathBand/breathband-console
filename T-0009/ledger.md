# T-0009 · Build and serve the console in Docker locally, with npm run docker:smoke

<!-- Written by Rivetari runtime from ledger.jsonl. Don't edit: changes are detected. -->

## Timeline

- 2026-11-24 00:15 intake: card drafted with 4 acceptance criteria; awaiting confirmation (arynbht@gmail.com)
- 2026-11-24 00:16 intake: intake confirmed; card sha256 be1c64040d6d6211da98350994adfef4b231aa2309d83502e4031d76d36f684c (arynbht@gmail.com (--yes))
- 2026-11-24 00:16 route: assembly proposed; sha256 f9971722588e37f057a9163c8a1ac024d3566b3f45574b50b736273a6d99ffcc; skills none; proof infra-plan; awaiting approval (rivetari router (for arynbht@gmail.com))
- 2026-11-24 00:16 route: route approved; assembly sha256 f9971722588e37f057a9163c8a1ac024d3566b3f45574b50b736273a6d99ffcc (arynbht@gmail.com (--yes))

## Decisions

- 2026-11-24 00:15 risk high: derived from the touches: high: infrastructure as code (Dockerfile); medium: dependencies or a lockfile (package.json) (the declared medium can't lower it)
- 2026-11-24 00:16 routed to infra, testing: infra (touches **/Dockerfile (Dockerfile); "deploy" in the description; "docker" in the title; "dockerfile" in the description), testing ("test" in the description; "e2e" in the description; "playwright" in the description)
- 2026-11-24 00:16 infra: no vendored skill covers it; the agent works from the spine
