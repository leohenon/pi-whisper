# Testing

Install with `npx pi-whisper install`

Restart pi before testing.

## 1. Whisper is excluded from context

- Fresh session
- `/whisper`
- Send: `the secret word is <secret word>`
- `/whisper`
- Ask: `what is the secret word?`
- Expected: it does **not** know `<secret word>`

## 2. Whisper still sees normal context

- Fresh session
- Send: `my favorite color is blue`
- `/whisper`
- Ask: `what is my favorite color?`
- Expected: `blue`

## 3. Whisper keeps whisper context while mode stays on

- Fresh session
- `/whisper`
- Send: `the secret word is <secret word>`
- Send: `what is the secret word?`
- Expected: `<secret word>`

## 4. Whisper tool calls are excluded too

- Fresh session
- `/whisper`
- Send: `read the README and tell me the first heading`
- `/whisper`
- Ask: `what file did you just read?`
- Expected: it does **not** remember

## 5. Hide works

- Fresh session
- `/whisper`
- Send: `hello`
- `/whisper hide`
- Expected:
  - whisper output disappears
  - whisper mode turns off
