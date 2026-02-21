# microCMS CLI

microCMS 用の CLI ツールです。

- `docs`: ローカルに配置した docs テキストを表示
- `gen-types`: Management API のスキーマから TypeScript 型を生成

## Setup

```bash
bun install
bun run build
```

## Commands

### `docs [path]`

ローカル `docs/` ディレクトリのドキュメントを表示します。

```bash
# サマリー表示
microcms docs

# 個別ドキュメント表示
microcms docs /docs/api/content
```

### `gen-types [endpointId] [options]`

Management API のスキーマを取得し、TypeScript 型を生成します。
生成結果は `microcms.d.ts` に集約されます。

```bash
# 単一エンドポイント
microcms gen-types blog

# 出力先ディレクトリ指定（デフォルト: ./types）
microcms gen-types blog -o ./src/types/microcms
# => ./src/types/microcms/microcms.d.ts

# 出力ファイルを直接指定
microcms gen-types blog -o ./src/types/microcms.d.ts

# 全エンドポイントを一括生成
microcms gen-types --all
```

#### Options

- `-o, --output <path>`: 出力先（ディレクトリ指定時は `<path>/microcms.d.ts`、デフォルト `./types/microcms.d.ts`）
- `--all`: 全エンドポイントの型を生成

#### Required environment variables

`gen-types` 実行時に以下が必要です。

```bash
MICROCMS_SERVICE_DOMAIN=your-service-id
MICROCMS_MANAGEMENT_API_KEY=your-management-api-key
```

`MICROCMS_MANAGEMENT_API_KEY` がない場合は `MICROCMS_API_KEY` でも動作します。

## Development

```bash
bun run dev docs
bun run dev gen-types blog
```