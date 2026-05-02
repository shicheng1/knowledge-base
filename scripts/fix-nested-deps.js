const fs = require('fs');
const path = require('path');

module.exports = async function (context) {
  const appOutDir = context.appOutDir;

  const appDir = path.join(appOutDir, 'resources', 'app');
  if (!fs.existsSync(appDir)) {
    console.log('app dir not found:', appDir);
    return;
  }

  const nodeModulesDir = path.join(appDir, 'node_modules');
  if (!fs.existsSync(nodeModulesDir)) {
    console.log('node_modules not found, skipping');
    return;
  }

  const fixed = [];

  function collectNestedDeps(dir, parentName) {
    const nestedNodeModules = path.join(dir, 'node_modules');
    if (!fs.existsSync(nestedNodeModules)) return;

    let entries;
    try { entries = fs.readdirSync(nestedNodeModules, { withFileTypes: true }); }
    catch { return; }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name.startsWith('@')) {
        const scopedDir = path.join(nestedNodeModules, entry.name);
        let scopedEntries;
        try { scopedEntries = fs.readdirSync(scopedDir, { withFileTypes: true }); }
        catch { continue; }
        for (const se of scopedEntries) {
          if (!se.isDirectory()) continue;
          const fullName = entry.name + '/' + se.name;
          const targetPath = path.join(nodeModulesDir, fullName);
          if (!fs.existsSync(targetPath)) {
            copyRecursive(path.join(scopedDir, se.name), targetPath);
            fixed.push(parentName + ' -> ' + fullName);
          }
        }
      } else {
        const targetPath = path.join(nodeModulesDir, entry.name);
        if (!fs.existsSync(targetPath)) {
          copyRecursive(path.join(nestedNodeModules, entry.name), targetPath);
          fixed.push(parentName + ' -> ' + entry.name);
        }
      }
    }
  }

  function copyRecursive(src, dest) {
    try { fs.mkdirSync(dest, { recursive: true }); } catch {}
    let entries;
    try { entries = fs.readdirSync(src, { withFileTypes: true }); }
    catch { return; }
    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      if (entry.isDirectory()) {
        copyRecursive(srcPath, destPath);
      } else {
        try { fs.copyFileSync(srcPath, destPath); } catch {}
      }
    }
  }

  let topEntries;
  try { topEntries = fs.readdirSync(nodeModulesDir, { withFileTypes: true }); }
  catch { console.log('Failed to read node_modules'); return; }

  for (const entry of topEntries) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith('@')) {
      const scopedDir = path.join(nodeModulesDir, entry.name);
      let scopedEntries;
      try { scopedEntries = fs.readdirSync(scopedDir, { withFileTypes: true }); }
      catch { continue; }
      for (const se of scopedEntries) {
        if (!se.isDirectory()) continue;
        collectNestedDeps(path.join(scopedDir, se.name), entry.name + '/' + se.name);
      }
    } else {
      collectNestedDeps(path.join(nodeModulesDir, entry.name), entry.name);
    }
  }

  if (fixed.length > 0) {
    console.log('Fixed ' + fixed.length + ' nested dependencies:');
    fixed.forEach(f => console.log('  ' + f));
  } else {
    console.log('No nested dependencies to fix');
  }
};
