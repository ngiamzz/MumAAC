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

## The spec

**`docs/spec.md` is the source of truth** for who she is, the two modes
(big keyboard with prediction; handwriting that learns her writing), the build
order and the questions still open. Read it before building anything.

In short: she has lost dexterity, uses an iPad or iPhone with her finger, aims
imprecisely and sometimes taps more than once. English first, Chinese later.

## Working rules

- Conclusion first, no padding.
- Develop on a branch and open a draft pull request; do not push to `main`.
- Never commit secrets. API keys go in the cloud environment's settings.
