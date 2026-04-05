#!/usr/bin/env node

/**
 * Build script to minify CSS and JS files for production
 * Run: npm run build
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const CSS_DIR = path.join(PUBLIC_DIR, 'css');
const JS_DIR = path.join(PUBLIC_DIR, 'js');

console.log('🔨 Starting build process...\n');

// Simple CSS minifier (removes comments, whitespace, newlines)
function minifyCSS(css) {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, '') // Remove comments
    .replace(/\s+/g, ' ') // Collapse whitespace
    .replace(/\s*{\s*/g, '{') // Remove space around braces
    .replace(/\s*}\s*/g, '}')
    .replace(/\s*;\s*/g, ';') // Remove space around semicolons
    .replace(/\s*:\s*/g, ':') // Remove space around colons
    .replace(/;\}/g, '}') // Remove trailing semicolons
    .trim();
}

// Minify CSS files
const cssFiles = fs.readdirSync(CSS_DIR).filter(f => f.endsWith('.css') && !f.endsWith('.min.css'));
console.log(`📦 Found ${cssFiles.length} CSS files to minify`);

cssFiles.forEach(file => {
  const inputPath = path.join(CSS_DIR, file);
  const outputPath = path.join(CSS_DIR, file.replace('.css', '.min.css'));
  
  try {
    const originalCSS = fs.readFileSync(inputPath, 'utf8');
    const minifiedCSS = minifyCSS(originalCSS);
    fs.writeFileSync(outputPath, minifiedCSS);
    
    const originalSize = fs.statSync(inputPath).size;
    const minifiedSize = fs.statSync(outputPath).size;
    const savings = ((1 - minifiedSize / originalSize) * 100).toFixed(1);
    console.log(`✅ ${file} → ${file.replace('.css', '.min.css')} (${savings}% smaller)`);
  } catch (err) {
    console.error(`❌ Failed to minify ${file}:`, err.message);
  }
});

console.log('');

// Minify JS files (basic - removes comments and extra whitespace)
const jsFiles = fs.readdirSync(JS_DIR).filter(f => f.endsWith('.js') && !f.endsWith('.min.js'));
console.log(`📦 Found ${jsFiles.length} JS files to minify`);

jsFiles.forEach(file => {
  const inputPath = path.join(JS_DIR, file);
  const outputPath = path.join(JS_DIR, file.replace('.js', '.min.js'));
  
  try {
    const originalJS = fs.readFileSync(inputPath, 'utf8');
    // Basic JS minification - remove comments and extra whitespace
    const minifiedJS = originalJS
      .replace(/\/\*[\s\S]*?\*\//g, '') // Remove multi-line comments
      .replace(/\/\/.*$/gm, '') // Remove single-line comments
      .replace(/\n\s*\n/g, '\n') // Remove empty lines
      .replace(/\s+/g, ' ') // Collapse whitespace
      .replace(/\s*{\s*/g, '{')
      .replace(/\s*}\s*/g, '}')
      .replace(/\s*;\s*/g, ';')
      .replace(/\s*\(\s*/g, '(')
      .replace(/\s*\)\s*/g, ')')
      .trim();
    
    fs.writeFileSync(outputPath, minifiedJS);
    
    const originalSize = fs.statSync(inputPath).size;
    const minifiedSize = fs.statSync(outputPath).size;
    const savings = ((1 - minifiedSize / originalSize) * 100).toFixed(1);
    console.log(`✅ ${file} → ${file.replace('.js', '.min.js')} (${savings}% smaller)`);
  } catch (err) {
    console.error(`❌ Failed to minify ${file}:`, err.message);
  }
});

console.log('\n✨ Build complete!\n');
