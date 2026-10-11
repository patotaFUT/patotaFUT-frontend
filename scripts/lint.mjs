import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

// Focused TypeScript source policy plus Prettier, without a second parser or
// unavailable ESLint packages. tsc performs the remaining semantic checks.
let failures = 0;
function inspect(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const name = path.join(directory, entry.name);
    if (entry.isDirectory()) inspect(name);
    else if (/\.tsx?$/.test(name)) {
      const content = fs.readFileSync(name, 'utf8');
      const source = ts.createSourceFile(
        name,
        content,
        ts.ScriptTarget.Latest,
        true,
      );
      function reject(node, reason) {
        const position = source.getLineAndCharacterOfPosition(
          node.getStart(source),
        );
        console.error(`${name}:${position.line + 1}: ${reason}`);
        failures++;
      }
      function visit(node) {
        if (node.kind === ts.SyntaxKind.AnyKeyword)
          reject(node, 'Explicit any is forbidden');
        if (ts.isNonNullExpression(node))
          reject(node, 'Non-null assertion is forbidden');
        if (ts.isAsExpression(node) || ts.isTypeAssertionExpression(node))
          reject(node, 'Type assertions are forbidden; narrow unknown instead');
        if (
          ts.isPropertyAccessExpression(node) &&
          ['localStorage', 'sessionStorage'].includes(node.name.text)
        )
          reject(
            node,
            'Browser storage is not part of this authentication flow',
          );
        ts.forEachChild(node, visit);
      }
      visit(source);
      if (/@ts-(?:ignore|nocheck|expect-error)/.test(content)) {
        console.error(`${name}: TypeScript suppressions are forbidden`);
        failures++;
      }
    }
  }
}
inspect('src');
inspect('tests');
if (failures > 0) process.exitCode = 1;
else
  console.log(
    'Source policy passed: no any, casts, non-null assertions, suppressions or browser storage.',
  );
