#!/usr/bin/env node
/**
 * Fails the build on hardcoded type or colour in the UI.
 *
 * This exists as its own CI step rather than an ESLint rule because the lint
 * job runs with `continue-on-error: true` -- the codebase carries a few hundred
 * pre-existing lint errors, so a rule added there would be a warning nobody
 * sees. This is the gate; the matching ESLint rule in .eslintrc.js gives the
 * same feedback in the editor.
 *
 * What it bans in src/screens, src/components and src/Custom-Components:
 *   fontSize: 14            -> a typography role   (...typography.bodySm)
 *   fontWeight: '600'       -> a role, or a token  (typography.labelMd.fontWeight)
 *   fontFamily: 'Roboto'    -> typography.fontFamily
 *   '#0F766E'               -> a colour token      (colors.primary)
 *
 * ALLOWED lists the files that define tokens rather than consume them, plus
 * the handful of deliberate exceptions. Each needs a reason.
 */
const fs = require('fs');
const path = require('path');

const ROOTS = ['src/screens', 'src/components', 'src/Custom-Components', 'src/navigators'];

const ALLOWED = new Map([
  // Token definitions: the one place each value is written down.
  ['src/theme/theme.ts', 'defines the palette and type scale'],
  ['src/theme/index.ts', 'legacy token set, still consumed by older screens'],
  ['src/utils/deliveryTheme.ts', 'DP_BRAND: the delivery surface palette'],
  ['src/components/auth/authTokens.ts', 'AUTH: the onboarding flow palette'],
  // Deliberate exceptions, commented at the line where they sit.
  [
    'src/screens/Delivery/Personnel/DeliveryComplete/DeliveryCompleteScreen.tsx',
    'confetti is meant to be off-system',
  ],
]);

const RULES = [
  { re: /fontSize:\s*\d/g, msg: 'hardcoded fontSize — use a typography role' },
  { re: /fontWeight:\s*'\d00'/g, msg: "hardcoded fontWeight — use a role, or typography.<role>.fontWeight" },
  { re: /fontFamily:\s*'[^']+'/g, msg: 'hardcoded fontFamily — use typography.fontFamily' },
  // Both quote styles. Matching only single quotes let every JSX attribute
  // through — `iconColor="#8B5CF6"` sailed past this gate, which is exactly how
  // the neon violets reached the SuperAdmin screens and stayed there.
  { re: /'#[0-9A-Fa-f]{3,8}'/g, msg: 'hardcoded colour — use a colour token' },
  { re: /"#[0-9A-Fa-f]{3,8}"/g, msg: 'hardcoded colour — use a colour token' },
];

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== '__tests__') walk(full, out);
    } else if (/\.tsx?$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

const findings = [];
for (const root of ROOTS) {
  if (!fs.existsSync(root)) continue;
  for (const file of walk(root)) {
    if (ALLOWED.has(file)) continue;
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
      // A commented-out line is not shipped code.
      if (/^\s*(\/\/|\*)/.test(line)) return;
      for (const { re, msg } of RULES) {
        re.lastIndex = 0;
        if (re.test(line)) findings.push({ file, line: i + 1, msg, text: line.trim() });
      }
    });
  }
}

if (findings.length === 0) {
  console.log('Design tokens: clean.');
  process.exit(0);
}

console.error(`Design tokens: ${findings.length} hardcoded value(s).\n`);
for (const f of findings) {
  console.error(`  ${f.file}:${f.line}  ${f.msg}`);
  console.error(`    ${f.text.slice(0, 100)}`);
}
console.error(
  '\nEvery value comes from src/theme/theme.ts. See the ROLE MAP comment there\n' +
    'for which token a given piece of UI takes. If a value genuinely belongs\n' +
    'outside the system, add the file to ALLOWED in this script with a reason.',
);
process.exit(1);
