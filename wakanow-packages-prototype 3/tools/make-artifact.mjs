/**
 * Folds the Vite production build into a single self-contained page so the
 * prototype can be published as an Artifact and clicked through with nothing
 * installed. The Artifact runtime supplies the <!doctype>/<head>/<body>
 * skeleton, so this emits page CONTENT only.
 */
import fs from 'node:fs';
import path from 'node:path';

const DIST = new URL('../dist', import.meta.url).pathname;
const OUT = new URL('../wakanow-packages-prototype.html', import.meta.url).pathname;

const html = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');

const cssFile = html.match(/href="\/(assets\/[^"]+\.css)"/)?.[1];
const jsFile = html.match(/src="\/(assets\/[^"]+\.js)"/)?.[1];
if (!cssFile || !jsFile) throw new Error('Could not find built assets in dist/index.html');

const css = fs.readFileSync(path.join(DIST, cssFile), 'utf8');
const js = fs.readFileSync(path.join(DIST, jsFile), 'utf8');

// The bundle is an ES module and uses import.meta — it must stay type="module".
// Closing-tag sequences inside string literals would end the script early.
const safeJs = js.replace(/<\/script>/gi, '<\\/script>');

const page = `<title>Wakanow Packages</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=DM+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>
${css}
</style>
<div id="root"></div>
<script type="module">
${safeJs}
</script>
`;

fs.writeFileSync(OUT, page);
const kb = (Buffer.byteLength(page) / 1024).toFixed(0);
console.log(`wrote ${path.basename(OUT)} — ${kb} KB (css ${(css.length / 1024) | 0} KB, js ${(js.length / 1024) | 0} KB)`);
