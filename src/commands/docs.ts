import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Get the docs directory path
 * In development: projectRoot/docs
 * In production: bundle location/docs
 */
function getDocsDir(): string {
  // プロジェクトルートのdocsディレクトリ
  const projectRoot = path.resolve(__dirname, '../..');
  const docsDir = path.join(projectRoot, 'docs');
  
  // docsディレクトリが存在するか確認
  if (fs.existsSync(docsDir)) {
    return docsDir;
  }
  
  // ビルド後のバイナリと同じ場所のdocs
  const binDocsDir = path.join(path.dirname(__filename), 'docs');
  if (fs.existsSync(binDocsDir)) {
    return binDocsDir;
  }
  
  throw new Error('docs directory not found');
}

/**
 * docsコマンド
 * Display microCMS documentation
 * 
 * @param docPath - Documentation path (optional)
 * 
 * Examples:
 *   microcms docs
 *   microcms docs /docs/api/content
 *   microcms docs /docs/getting-started/installation
 */
export function docsCommand(docPath?: string) {
  try {
    const docsDir = getDocsDir();
    
    if (!docPath) {
      // Display summary
      displaySummary(docsDir);
    } else {
      // Display specific document
      displayDocument(docsDir, docPath);
    }
  } catch (error: any) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

/**
 * サマリーを表示
 */
function displaySummary(docsDir: string) {
  const summaryPath = path.join(docsDir, 'summary.txt');
  
  if (!fs.existsSync(summaryPath)) {
    console.error('Error: summary.txt not found');
    console.error(`Expected location: ${summaryPath}`);
    process.exit(1);
  }
  
  const content = fs.readFileSync(summaryPath, 'utf-8');
  console.log(content);
}

/**
 * 特定のドキュメントを表示
 */
function displayDocument(docsDir: string, docPath: string) {
  // /docs/api/content → api/content.txt
  const normalizedPath = docPath
    .replace(/^\/docs\//, '')  // 先頭の /docs/ を削除
    .replace(/\/$/, '');         // 末尾の / を削除
  
  const filePath = path.join(docsDir, `${normalizedPath}.txt`);
  
  if (!fs.existsSync(filePath)) {
    console.error(`Error: Documentation not found: ${docPath}`);
    console.error(`Expected file: ${filePath}`);
    console.error('');
    console.error('To see available documentation:');
    console.error('  microcms docs');
    process.exit(1);
  }
  
  const content = fs.readFileSync(filePath, 'utf-8');
  console.log(content);
}
