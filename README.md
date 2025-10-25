# microCMS CLI

CLI for microCMS documentation (local files version).

## Setup

1. Install dependencies:
```bash
bun install
```

2. Create documentation files in `docs/` directory (see below)

3. Build:
```bash
bun run build
```

4. Run:
```bash
./bin docs
./bin docs /docs/api/content
```

## Development

```bash
# Run in development mode
bun run dev docs
bun run dev docs /docs/api/content
```

## Documentation Structure

```
docs/
├── summary.txt                    # Main summary (shown with: microcms docs)
├── api/
│   ├── content.txt               # /docs/api/content
│   └── management.txt            # /docs/api/management
├── getting-started/
│   └── installation.txt          # /docs/getting-started/installation
└── sdk/
    └── javascript.txt            # /docs/sdk/javascript
```

## Usage

```bash
# Display summary
microcms docs

# Display specific documentation
microcms docs /docs/api/content
microcms docs /docs/getting-started/installation
microcms docs /docs/sdk/javascript
```

## Benefits

✅ No API calls - instant response
✅ Works offline
✅ Simple file management
✅ Easy to version control
✅ No authentication needed
✅ Fast and lightweight

## Updating Documentation

Just edit the `.txt` files in the `docs/` directory and rebuild:

```bash
bun run build
```

Or distribute the docs folder with the binary.