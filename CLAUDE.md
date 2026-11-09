# CLAUDE.md

Guidance for Claude Code working in this repository. Most work here happens in
Claude Code cloud sessions started from a phone, so keep replies short and
push work to GitHub: the container is discarded when a session ends.

## What this is

An AAC (augmentative and alternative communication) app for XW's mum. She taps
a phrase, a symbol or typed text and the device speaks it.

## Principles

- **It must work when the network does not.** A communication aid that fails
  when the Wi-Fi drops is worse than none. Offline-first; cloud is for syncing
  and remote editing, never a runtime dependency for speaking.
- **Speed and reliability beat features.** Every extra tap costs her effort.
  Large targets, no accidental navigation, no surprise dialogs.
- **Family edits, Mum speaks.** Editing phrases and boards happens from family
  members' phones; her screen stays simple.
- **Her data is private.** The repo is private; no analytics, no third-party
  trackers.

## Open questions (ask XW before building the affected part)

1. How does she communicate now: can she read and type, or does she need
   pictures/symbols? What is the cause (stroke, ALS/MND, Parkinson's, other)?
2. How does she use a screen: accurate taps, large targets only, a switch, or
   eye-gaze?
3. Which device: iPad, Android tablet, phone?
4. Languages: English only, or Mandarin / a dialect (Hokkien, Cantonese,
   Teochew)?
5. Voice: a standard text-to-speech voice, or a clone of her own voice from
   recordings?
6. Who edits her boards, and from where?

## Proposed default (until the answers change it)

An installable web app (PWA) that runs on any tablet: large customisable phrase
and symbol boards, type-to-speak, offline after first load, boards synced
through a cloud backend so family can edit remotely.

## Working rules

- Conclusion first, no padding.
- Develop on a branch and open a draft pull request; do not push to `main`.
- Never commit secrets. API keys go in the cloud environment's settings.
