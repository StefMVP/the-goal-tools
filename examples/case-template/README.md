# Case template

Synthetic data. Copy to `local/cases/NAME/`, then run `bin/goal case build NAME` and open `#/case/NAME`.

| file | use |
|---|---|
| `case.json` | title, clock |
| `inputs/items.csv` | `id,stage,start,end,cause,owner` |
| `build.sh` | inputs to `data.js` |
| `tab.js` | tab module (optional) |

Subtabs: `#/case/NAME/SUB`, one book tool each. Rows: one plain headline and one badge each. See [docs/cases.md](../../docs/cases.md).
