# pi-whisper

[![npm](https://img.shields.io/npm/v/pi-whisper?style=flat-square&logo=npm&logoColor=white&label=npm&color=64748b)](https://www.npmjs.com/package/pi-whisper)

> Ephemeral whisper mode for pi.

Use `/whisper` for side questions you do not want to keep in future context. While whisper mode stays on, whisper messages keep context with each other. Once whisper mode is turned off, that whisper session is excluded from future model context. Use `/whisper hide` to hide whisper transcript output and return to the main conversation when the optional core patch is compatible with your pi version.

## Install

```bash
npx pi-whisper install
```

Then fully restart pi.

## Uninstall

```bash
npx pi-whisper uninstall
```

Then fully restart pi.

## Usage

| Command         | Action                                                                        |
| --------------- | ----------------------------------------------------------------------------- |
| `/whisper`      | Toggle whisper mode on/off                                                    |
| `/whisper hide` | Hide all whisper transcript output for this session and turn whisper mode off |

## Notes

- Context isolation is implemented with pi extension hooks.
- The installer also attempts an optional local pi core patch for transcript hiding/styling.
- If that optional patch fails, `/whisper` still excludes whisper messages from future model context, but `/whisper hide` may not visually remove old transcript entries.
- `/reload` is not enough after install/remove; restart pi.
- The footer context percentage may not drop immediately after whisper mode is turned off. Whisper messages are still excluded from future model context, and the footer catches up after the next normal response.

> [!WARNING]
>
> Optional core patch last tested with pi `0.80.3`
