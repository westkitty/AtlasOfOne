# Canonical Greyson visual assets

`Aerron` was Greyson's former asset/code name. For Atlas of One, the **Aerron assets are the Greyson assets**.

The supplied source archive is `aerron_andrew_snes_pack_RENDERED.zip`. Only its Aerron-side material belongs to Atlas. The Andrew-side material in that mixed source pack is unrelated to The Greyson Map and must not be imported into this repository.

## Runtime map sprites

The current runtime set is copied byte-for-byte from `rendered-prompts/aerron/game-ready-48x64/` and renamed only at the repository boundary:

| Runtime path | Canonical source | SHA-256 |
|---|---|---|
| `map/idle-front.png` | `aerron_idle_front_00.png` | `c1f6a4e8b4b9ce783fafd115835bce7ab3c17cdd1194cd3f20737cb3158700c9` |
| `map/idle-qfront.png` | `aerron_idle_qfront_00.png` | `20c025e6136628b601580f1f39b2bca54597f6a1a80cab80ef508955eccdb589` |
| `map/idle-left.png` | `aerron_idle_left_00.png` | `1e82f77826cfb201bfe1a3e4951524038fc11aa9c67d7f6bc1b1eff0139279ce` |
| `map/idle-back.png` | `aerron_idle_back_00.png` | `3a6935ac04a7381ccdf3d3a9c938233d2199c84e743e03fcd08d24893e9cda6b` |
| `map/idle-qback.png` | `aerron_idle_qback_00.png` | `35a8a75584d17dfb86cdb040b624576bf1974c25c04887ed98f530556ccf5407` |

All five are 48×64 transparent PNGs. `idle-front.png` is the default map/character sprite. The left sprite may be mirrored for the opposite lateral direction instead of creating redundant art.

## Detailed turnaround

The canonical detailed turnaround is supplied in the same archive as `sheets/aerron_turnaround_hires.png` (1360×640, SHA-256 `a02876c825984ed5037248dfa25b60acf427f7e9b07a20a96166c4fb22d9c9ce`). It is reserved for the later Character/Vault/final-assessment progression reveal. It is intentionally not part of the current runtime asset subset yet.

## Cleanup policy

Runtime curation may omit duplicate raw renders, 12× previews, contact sheets, and Andrew assets. Do not redraw or silently alter Greyson/Aerron's appearance. If a future web-optimized derivative is required, retain this provenance and verify it visually against the canonical Aerron source.
