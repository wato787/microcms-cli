# microCMS CLI

microCMS 用の CLI ツールです。実行コマンドは `microcms-cli` です。  
npm 配布物は事前ビルド済みのため、実行時に Bun は不要です（Node.js 18+）。

- `gen-types`: Management API のスキーマから TypeScript 型を生成

## Install

```bash
npm install -g @wato787/microcms-cli
# または
bun add -g @wato787/microcms-cli
```

```bash
# インストールせずに実行
npx @wato787/microcms-cli gen-types blog
```

## Commands

### `gen-types [endpointId] [options]`

microCMS Management API（`/api/v1/apis`）から API スキーマを取得し、TypeScript 型を生成します。
生成結果は `microcms.d.ts` に集約されます。
共通型（`MicroCMSListResponse` など）は `microcms-js-sdk` の公式定義に合わせています。
このコマンドは Content API のコンテンツ取得エンドポイントは呼びません。

- `endpointId` 指定時: 対象 endpoint のスキーマのみ取得
- `--all` 指定時: API 一覧を取得して全 endpoint を生成
- 生成型: `XxxSchema`（スキーマ本体）と `XxxContent`（SDK の共通メタ情報付き）
- 利用する Management API: `/api/v1/apis`, `/api/v1/apis/{endpoint}`

```bash
# 単一エンドポイント
microcms-cli gen-types blog

# 出力先ディレクトリ指定（デフォルトは ./types/microcms.d.ts）
microcms-cli gen-types blog -o ./src/types/microcms
# => ./src/types/microcms/microcms.d.ts

# 出力ファイルを直接指定
microcms-cli gen-types blog -o ./src/types/microcms.d.ts

# 全エンドポイントを一括生成
microcms-cli gen-types --all
# endpointIdを渡しても --all 指定時は無視されます
microcms-cli gen-types blog --all

# CIなどで環境変数をインライン指定
MICROCMS_SERVICE_DOMAIN=your-service-id \
MICROCMS_MANAGEMENT_API_KEY=your-management-api-key \
microcms-cli gen-types blog
```

#### Options

- `-o, --output <path>`: 出力先（ディレクトリ指定時は `<path>/microcms.d.ts`、デフォルト `./types/microcms.d.ts`）
- `--all`: 全エンドポイントの型を生成
- `--service-domain <domain>`: `MICROCMS_SERVICE_DOMAIN` をCLI引数で上書き
- `--api-key <key>`: `MICROCMS_MANAGEMENT_API_KEY` をCLI引数で上書き

#### Required environment variables

`gen-types` は **実行した利用者の環境変数** から設定を読み取ります。  
カレントディレクトリの `.env` と `.env.local` を自動で読み込みます（`.env.local` は後から読み込むため、同名の変数を上書きします）。[dotenv](https://github.com/motdotla/dotenv) 使用。  
CLI引数で指定しない場合、以下の環境変数が必要です。

```bash
MICROCMS_SERVICE_DOMAIN=your-service-id
MICROCMS_MANAGEMENT_API_KEY=your-management-api-key
```

#### Required Management API permission

`MICROCMS_MANAGEMENT_API_KEY` には、マネジメントAPIのGET権限として **「API情報の取得」** が必要です。

> 補足: 単一 endpoint で `apiType` が取得できない場合、CLI は警告を出して LIST として型生成します。

## Development

```bash
bun install
npm run build
bun run typecheck
bun run test

# 事前ビルド済み CLI を実行
npm run start -- gen-types blog

# ソースから実行（Bun）
bun run dev gen-types blog

# 単一バイナリを生成
bun run compile
```