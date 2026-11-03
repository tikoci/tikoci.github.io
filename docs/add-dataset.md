# Add a dataset

1. Define a small independently versioned schema and durable URL under
   `/metadata/`. Specify provenance, scope, successful observation time, latest
   attempt and error/staleness semantics. Review the data before building a UI.
2. Add a recognizable collector under scripts/ and a reviewed bootstrap snapshot
   under data/metadata/. Prefer explicit field allowlists for public data; tokens
   may see private repositories. No credentials, raw response dumps or private
   fields belong in published output.
3. Register it in data/metadata/index.json and document its schema. Add meaningful
   fixture/contract checks and validate required snapshots before deleting dist.
4. Choose hourly, weekly or manual refresh in the existing workflow. Retain useful
   observations on upstream failure; keep invalid contracts detectable. Persist
   snapshots with the existing reviewed git strategy. Do not introduce a generic
   collector framework or deploy a partial artifact.

TOML is a good choice for new authored configuration and TSV for new tabular
metadata. These are recommendations; don't convert existing formats for uniformity.
