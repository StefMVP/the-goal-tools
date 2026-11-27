# Demo case: Northwind Analytics CRM

Fictional B2B SaaS sales pipeline. Seeded synthetic data (`make.py`). No real company, person or deal.

| file | use |
|---|---|
| `inputs/deals.csv` | 110 deals: `id,stage,start,end,cause,owner` |
| `make.py` | writes `inputs/deals.csv` |
| `stages.json` | Flow lab stages (deals per week) |
| `plans.json` | T · I · OE product mix: plans and team hours |

Open as a case: `cp -r examples/demo-crm local/cases/demo-crm && bin/goal case build demo-crm`, then `#/case/demo-crm`.
