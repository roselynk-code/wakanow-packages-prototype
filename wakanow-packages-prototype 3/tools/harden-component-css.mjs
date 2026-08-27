/**
 * Raises the specificity of the shared components' stylesheets.
 *
 * Each page's generated CSS carries the mockups' `*{margin:0;padding:0}` reset,
 * scoped by tools/scope-css.mjs to `.pg-x, .pg-x *`. That is a single class —
 * exactly the same specificity as a component rule like `.wk-dp-done`. Which of
 * the two wins then comes down to the order Vite happens to concatenate the
 * stylesheets, which varies per page: the date picker's footer button lost its
 * padding on the builder but kept it on the landing page.
 *
 * Adding an ancestor to every inner rule takes them to (0,2,0), so they beat the
 * reset everywhere regardless of bundle order. Run once; the output is committed.
 */
import fs from 'node:fs';
import postcss from 'postcss';

const TARGETS = [
  {
    file: new URL('../src/components/DateRangePicker.css', import.meta.url).pathname,
    ancestor: '.wk-dp-pop',
    // Selectors that must stay at the top level: the anchor, which lives
    // outside the popover, and the popover root plus its alignment modifiers,
    // which are compounded onto that root rather than nested inside it.
    roots: ['.wk-dp-anchor', '.wk-dp-pop', '.wk-dp-left', '.wk-dp-right'],
  },
  {
    file: new URL('../src/components/BackBar.css', import.meta.url).pathname,
    ancestor: '.wk-backbar',
    roots: ['.wk-backbar'],
  },
];

for (const { file, ancestor, roots } of TARGETS) {
  const css = fs.readFileSync(file, 'utf8');

  const result = postcss([
    {
      postcssPlugin: 'harden',
      Rule(rule) {
        rule.selectors = rule.selectors.map((selector) => {
          if (/(\.[\w-]+)\1/.test(selector.replace(/\s.*/, ''))) return selector; // already doubled
          const head = selector.split(/[\s>+~]/)[0];
          const base = head.split(':')[0];

          // A root lives outside the ancestor, so it cannot take a descendant
          // prefix. Double its own class instead — same element, one more class
          // of specificity, no markup change.
          if (roots.includes(base)) return selector.replace(base, `${base}${base}`);

          // Already inside the ancestor (including modifiers compounded onto it).
          if (selector.startsWith(ancestor)) return selector;

          return `${ancestor} ${selector}`;
        });
      },
    },
  ]).process(css, { from: undefined });

  fs.writeFileSync(file, result.css);
  console.log(`hardened ${file.split('/').pop()}`);
}
