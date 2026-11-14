# MumAAC spec

## The person

Mum can no longer speak clearly, and loss of dexterity makes writing and typing
hard. Some handwritten words are unreadable, others can be guessed.

- **Device:** iPad or iPhone, finger only (no stylus).
- **Touch:** imprecise aim (lands near the target, not on it) and sometimes
  taps several times when she means once.
- **Language:** English first. Chinese later; the design must not rule it out.

## Two modes

### Mode 1 — Big keyboard with prediction

Most useful soonest: it needs no training data.

- Very large keys, few per screen. Speak button and Undo always visible.
- **Touch handling built for her, not for typical users:**
  - A key registers on lift, not on touch, so sliding off cancels it.
  - Repeated taps on the same key within a short window count once. The window
    is adjustable (start around 400 ms).
  - Each tap counts as a guess near a key, not a certain key. Prediction
    weighs the neighbouring keys, so "tje" still suggests "the".
- **Prediction:** word completion and next word, ranked by her own past use
  first, then a common-English word list. Suggestions are large buttons.
- A row of quick phrases (yes, no, toilet, pain, water…) that family can edit.

### Mode 2 — Handwriting that learns her writing

1. **Enrolment.** Family chooses a list of familiar words (names, needs,
   places). She writes each one several times. The app stores the strokes:
   the finger's path and timing, not just a picture.
2. **Recognition.** She writes; the app shows its top 3–4 guesses as big
   buttons, plus "none of these", which opens the keyboard.
   - **Offline, always available:** compare her strokes with her own saved
     samples (shape matching over the stroke paths). Covers the enrolled words.
   - **Online, optional:** send the scribble with examples of her writing to
     Claude's vision model for words outside the enrolled list. A bonus, never
     required for speaking.
3. **Learning.** Every guess she or family confirms is saved as a new sample,
   so recognition improves with use. Family can label old unrecognised
   scribbles from their own phones.

A guess is **never spoken automatically**. She picks one first.

## Shared across both modes

- Speech uses the device's built-in voices, which work offline on iOS.
- History of what she said, for quick repeats.
- Cloud sync of word lists, quick phrases and handwriting samples, so family
  can edit remotely. Samples are personal data: private storage, no analytics.

## Form

An installable web app (added to the iPhone or iPad home screen from Safari):
no App Store, works offline after the first load, and updates by deploying.
If iOS limits get in the way, the same code can be wrapped as a native app later.

## Build order

1. Keyboard mode: touch handling, prediction, speech. Usable on its own. **Done.**
2. Handwriting capture and enrolment screens. **Done.**
3. Offline handwriting recognition from her samples. **Done; untested on her real writing.**
4. Cloud sync and family editing.
5. Claude-assisted recognition for unenrolled words.
6. Chinese.

## Decided

- Keyboard layout: alphabetical (A–Z).
- Vocabulary: common English words plus family names.
- Voice: the standard iPhone voice for now.

- Handwriting words: the family names plus a starter list of care words,
  editable in settings. Three samples of each word counts as taught.
- A scribble no guess matched ("None of these") opens the keyboard; the word
  she then picks is saved as that scribble's label.

## Still open

- How well shape matching holds up on her real writing. If it is weak, the
  options are more samples per word or the Claude-assisted step.
- Handwriting samples live only on her device until cloud sync is built.
