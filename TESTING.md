# Testing

Install with `npx pi-whisper install` or `pi-whisper install`.

Restart pi before testing. `/reload` is not enough for core changes.

## 1. Whisper is excluded from context

- Fresh session
- `/whisper`
- Send: `the secret word is marzipan`
- `/whisper`
- Ask: `what is the secret word?`
- Expected: it does **not** know `marzipan`

## 2. Whisper still sees normal context

- Fresh session
- Send: `my favorite color is blue`
- `/whisper`
- Ask: `what is my favorite color?`
- Expected: `blue`

## 3. Whisper tool calls are excluded too

- Fresh session
- `/whisper`
- Send: `read the README and tell me the first heading`
- `/whisper`
- Ask: `what file did you just read?`
- Expected: it does **not** remember

## 4. Hide works

- Fresh session
- `/whisper`
- Send: `hello`
- `/whisper hide`
- Expected:
  - whisper output disappears
  - whisper mode turns off
