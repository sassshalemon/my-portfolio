# Attribution / provenance

This is an integration experiment, not a claim of inventing the donor mechanisms.

- PR #1809 / head `6b3aaf610dbafc2d1269eb7becd62b18303f5858`: host co-grinder EC-v2, physical-core pinning, starvation-aware ramp and surrounding integration. Credit: **@Meganpark980320** and inherited coauthors/lineage named in that PR.
- PR #1731 / head `3f646fdbd3d431d920edbcfe37fe5c63d620e25b`: `cg_sha.h`, AVX2 x8 SHA-256 and 2-way SHA-NI front-end design. Credit: **@ercumentyildirim** and inherited coauthors/lineage named in that PR.
- Integration in this package: adaptation of donor SHA outputs to #1809's candidate-major z layout, joint SHA/EC runtime tuner, scalar fallback/tail handling, and source packaging.

If submitted to Yukon, preserve upstream licenses and use the coauthor flags required by QSB rules for all material reused from public submissions.
