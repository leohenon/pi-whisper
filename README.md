# pi-whisper

[![npm](https://img.shields.io/npm/v/pi-whisper?style=flat-square&logo=npm&logoColor=white&label=npm&color=64748b)](https://www.npmjs.com/package/pi-whisper) [![node](https://img.shields.io/badge/node-%3E%3D18-64748b?style=flat-square&logo=nodedotjs&logoColor=white)](https://nodejs.org)

Ephemeral whisper mode for pi.

Use `/whisper` for side questions you do not want to keep in future context. Use `/whisper hide` to hide whisper transcript output and return to the main conversation.

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

- This package patches local pi core files; it is not a pure stock-api extension
- `/reload` is not enough after install/remove; restart pi
