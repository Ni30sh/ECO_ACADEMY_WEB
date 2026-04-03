#!/usr/bin/env node

/**
 * Verify Supabase Migration Setup
 * Run this script to check if all files are in place
 * Usage: node verify-setup.js
 */

const fs = require('fs');
const path = require('path');

const checkIcon = '✅';
const errorIcon = '❌';
const warningIcon = '⚠️';

let passCount = 0;
let failCount = 0;
let warnCount = 0;

// Colors for terminal output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
  reset: '\x1b[0m'
};

function checkFile(filePath, description) {
  const fullPath = path.join(__dirname, filePath);
  if (fs.existsSync(fullPath)) {
    console.log(`${checkIcon} ${description}`);
    passCount++;
    return true;
  } else {
    console.log(`${errorIcon} Missing: ${description} (${filePath})`);
    failCount++;
    return false;
  }
}

function checkEnvVar(varName, description) {
  if (process.env[varName]) {
    console.log(`${checkIcon} ${description}`);
    passCount++;
    return true;
  } else {
    console.log(`${warningIcon} Not set: ${description}`);
    warnCount++;
    return false;
  }
}

function printSection(title) {
  console.log(`\n${colors.blue}━━━ ${title} ━━━${colors.reset}`);
}

// Main verification
console.log(`${colors.blue}
╔════════════════════════════════════════════════════════════╗
║  Supabase Migration Setup Verification                    ║
║  EcoVerse Academy                                          ║
╚════════════════════════════════════════════════════════════╝
${colors.reset}`);

// Check infrastructure files
printSection('Infrastructure Files');
checkFile('supabase/migrations/20260330_create_full_schema.sql', 'Database schema migration');
checkFile('supabase/migrations/20260330_seed_data.sql', 'Seed data migration');

// Check query layer
printSection('Query Layer');
checkFile('src/integrations/supabase/types.ts', 'TypeScript type definitions');
checkFile('src/integrations/supabase/queries.ts', 'Query methods (60+ functions)');
checkFile('src/integrations/supabase/client.ts', 'Supabase client setup');

// Check components
printSection('UI Components');
checkFile('src/components/MissionStepViewer.tsx', 'Student step progression component');
checkFile('src/components/TeacherStepReview.tsx', 'Teacher review component');

// Check hooks
printSection('React Hooks');
checkFile('src/hooks/useAuth.tsx', 'Authentication hook (needs update)');
checkFile('src/hooks/useMissionProgress.ts', 'Mission progress tracking hook (NEW)');
checkFile('src/hooks/useDashboardData.ts', 'Dashboard data hook (needs update)');
checkFile('src/hooks/useLearnData.ts', 'Learn data hook (needs update)');
checkFile('src/hooks/index.ts', 'Hooks index file');

// Check documentation
printSection('Documentation');
checkFile('SUPABASE_MIGRATION_GUIDE.md', 'Migration guide (8 phases)');
checkFile('SUPABASE_QUERY_REFERENCE.md', 'Query reference (60+ examples)');
checkFile('MIGRATION_COMPLETE.md', 'Implementation summary');
checkFile('STEP_SYSTEM_IMPLEMENTATION.md', 'Integration examples');
checkFile('QUICK_REFERENCE.md', 'Quick reference guide');

// Check environment
printSection('Environment Variables');
checkEnvVar('VITE_SUPABASE_URL', 'Supabase project URL');
checkEnvVar('VITE_SUPABASE_ANON_KEY', 'Supabase anon key');

// Check package.json
printSection('Dependencies');
const packageJson = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8')
);

const requiredDeps = [
  '@supabase/supabase-js',
  '@tanstack/react-query',
  'framer-motion',
  'tailwindcss'
];

let depsOk = true;
for (const dep of requiredDeps) {
  const installed = packageJson.dependencies[dep] || packageJson.devDependencies[dep];
  if (installed) {
    console.log(`${checkIcon} ${dep}`);
    passCount++;
  } else {
    console.log(`${warningIcon} Not installed: ${dep} (run: bun install)`);
    warnCount++;
    depsOk = false;
  }
}

// Summary
printSection('Summary');
console.log(`
${colors.green}Passed: ${passCount}${colors.reset}
${colors.yellow}Warnings: ${warnCount}${colors.reset}
${colors.red}Failed: ${failCount}${colors.reset}
`);

if (failCount === 0 && warnCount === 0) {
  console.log(`${colors.green}✨ All checks passed! Ready to start migration.${colors.reset}\n`);
  console.log('Next steps:');
  console.log('1. Create .env.local with Supabase credentials');
  console.log('2. Follow SUPABASE_MIGRATION_GUIDE.md → Phase 1');
  console.log('3. Run: npm run dev\n');
  process.exit(0);
} else if (failCount === 0) {
  console.log(`${colors.yellow}⚠️  Some warnings found. Check that environment is configured.${colors.reset}\n`);
  console.log('Next steps:');
  console.log('1. Create .env.local file (see template below)');
  console.log('2. Install dependencies if needed: bun install\n');
  console.log('Template .env.local:');
  console.log('─'.repeat(50));
  console.log('VITE_SUPABASE_URL=https://[ID].supabase.co');
  console.log('VITE_SUPABASE_ANON_KEY=[YOUR_ANON_KEY]');
  console.log('─'.repeat(50) + '\n');
  process.exit(1);
} else {
  console.log(`${colors.red}❌ Some files are missing. Check the list above.${colors.reset}\n`);
  process.exit(1);
}
