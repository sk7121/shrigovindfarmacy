const fs = require('fs');
const path = require('path');
const root = path.join(process.cwd(), 'views');
const snippet = `
  <% if (success && success.length) { %>
    <div class="flash success"><%= success[0] %></div>
  <% } %>
  <% if (error && error.length) { %>
    <div class="flash error"><%= error[0] %></div>
  <% } %>
`;
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(dirent => {
    const res = path.join(dir, dirent.name);
    return dirent.isDirectory() ? walk(res) : res;
  });
}

const files = walk(root).filter(f => f.endsWith('.ejs'));
const modified = [];

for (const file of files) {
  let txt = fs.readFileSync(file, 'utf8');
  if (txt.includes('flash success') || txt.includes('flash error') || txt.includes('<% if (success') || txt.includes('<% if (error')) {
    continue;
  }
  const match = txt.match(/<body(\s[^>]*)?>/i);
  if (!match) continue;
  const insertPos = match.index + match[0].length;
  const newTxt = txt.slice(0, insertPos) + snippet + txt.slice(insertPos);
  fs.writeFileSync(file, newTxt, 'utf8');
  modified.push(file);
}

console.log('Inserted flash snippet into', modified.length, 'files.');
console.log(modified.join('\n'));
