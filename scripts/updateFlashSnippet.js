const fs = require('fs');
const path = require('path');
const root = path.join(process.cwd(), 'views');
const oldSnippet = `\n  <% if (success && success.length) { %>\n    <div class="flash success"><%= success[0] %></div>\n  <% } %>\n  <% if (error && error.length) { %>\n    <div class="flash error"><%= error[0] %></div>\n  <% } %>\n`;
const newSnippet = `\n  <style>\n    .flash {\n      padding: 12px 14px;\n      border-radius: 14px;\n      margin: 18px auto;\n      max-width: 980px;\n      font-weight: 600;\n      display: flex;\n      align-items: center;\n      gap: 10px;\n      border: 1px solid rgba(0,0,0,0.08);\n      background: rgba(255, 255, 255, 0.9);\n      box-shadow: 0 10px 24px rgba(15, 23, 42, 0.08);\n    }\n    .flash.success {\n      border-color: rgba(74, 222, 128, 0.4);\n      color: #166534;\n      background: rgba(74, 222, 128, 0.15);\n    }\n    .flash.error {\n      border-color: rgba(255, 107, 107, 0.4);\n      color: #b91c1c;\n      background: rgba(254, 202, 202, 0.25);\n    }\n  </style>\n  <% if (success && success.length) { %>\n    <div class="flash success"><%= success[0] %></div>\n  <% } %>\n  <% if (error && error.length) { %>\n    <div class="flash error"><%= error[0] %></div>\n  <% } %>\n`;

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(dirent => {
    const res = path.join(dir, dirent.name);
    return dirent.isDirectory() ? walk(res) : res;
  });
}

const files = walk(root).filter(f => f.endsWith('.ejs'));
let updated = 0;
for (const file of files) {
  let txt = fs.readFileSync(file, 'utf8');
  if (!txt.includes(oldSnippet)) continue;
  const newTxt = txt.replace(oldSnippet, newSnippet);
  fs.writeFileSync(file, newTxt, 'utf8');
  updated++;
}
console.log('Updated', updated, 'files');
