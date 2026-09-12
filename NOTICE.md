# License and Provenance Notice

This project is licensed under the GNU General Public License v3.0
(see `LICENSE`).

## Why GPLv3

Some of the demonstration Chart of Accounts data in this project
(specifically the Italian and Swiss German/French/Italian sample
charts under `docs/reference/`, adapted for `schema.sql`) is derived
from real account structures published in
[Tekki's SQL-Ledger fork](https://github.com/Tekki/sql-ledger)
(GPLv3), itself building on SQL-Ledger by DWS Systems Inc. GIFI codes
themselves are a public Canadian government standard, not copyrighted
— the specific chart structures and wording built around them are
Tekki's/DWS's own work, and this project inherits GPLv3 as a
consequence of adapting them.

## What's original vs. adapted

The overwhelming majority of this project — the TypeScript/SvelteKit
application itself, the entity/ledger data model, every backend
function and frontend page — is original work, not derived from
SQL-Ledger or any other project. The Chart of Accounts *content* for
specific demonstration businesses (BMW M GmbH, Peugeot Citroën Sochaux
SNC, and the Italian/Swiss sample charts) draws on real, published
national accounting structures for authenticity, adapted (not copied
verbatim in full) and re-expressed within this project's own data
model.
