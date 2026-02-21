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

- `endpointId` 指定時: 対象 endpoint のスキーマのみ取得
- `--all` 指定時: API 一覧を取得して全 endpoint を生成

```bash
# 単一エンドポイント
microcms gen-types blog

# 出力先ディレクトリ指定（デフォルトは ./types/microcms.d.ts）
microcms gen-types blog -o ./src/types/microcms
# => ./src/types/microcms/microcms.d.ts

# 出力ファイルを直接指定
microcms gen-types blog -o ./src/types/microcms.d.ts

# 全エンドポイントを一括生成
microcms gen-types --all
# endpointIdを渡しても --all 指定時は無視されます
microcms gen-types blog --all

# CIなどで環境変数をインライン指定
MICROCMS_SERVICE_DOMAIN=your-service-id \
MICROCMS_MANAGEMENT_API_KEY=your-management-api-key \
microcms gen-types blog
```

#### Options

- `-o, --output <path>`: 出力先（ディレクトリ指定時は `<path>/microcms.d.ts`、デフォルト `./types/microcms.d.ts`）
- `--all`: 全エンドポイントの型を生成
- `--service-domain <domain>`: `MICROCMS_SERVICE_DOMAIN` をCLI引数で上書き
- `--api-key <key>`: `MICROCMS_MANAGEMENT_API_KEY` をCLI引数で上書き

#### Required environment variables

`gen-types` は **実行した利用者の環境変数** から設定を読み取ります。  
CLI引数で指定しない場合、以下の環境変数が必要です。

```bash
MICROCMS_SERVICE_DOMAIN=your-service-id
MICROCMS_MANAGEMENT_API_KEY=your-management-api-key
```

> 補足: 単一 endpoint で `apiType` が取得できない場合、CLI は警告を出して LIST として型生成します。

## Development

```bash
bun run dev docs
bun run dev gen-types blog
```