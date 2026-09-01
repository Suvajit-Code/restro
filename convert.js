const fs = require('fs');
const path = require('path');

const viewsDir = path.join(__dirname, 'views');
const files = fs.readdirSync(viewsDir).filter(f => f.endsWith('.ejs'));

files.forEach(file => {
    let content = fs.readFileSync(path.join(viewsDir, file), 'utf8');
    
    // Replace {{ var }} with <%= var %>
    content = content.replace(/\{\{\s*(.*?)\s*\}\}/g, '<%= $1 %>');
    
    // Replace {% if cond %} with <% if(cond) { %>
    content = content.replace(/\{%\s*if\s+(.*?)\s*%\}/g, '<% if($1) { %>');
    
    // Replace {% elif cond %} with <% } else if(cond) { %>
    content = content.replace(/\{%\s*elif\s+(.*?)\s*%\}/g, '<% } else if($1) { %>');
    
    // Replace {% else %} with <% } else { %>
    content = content.replace(/\{%\s*else\s*%\}/g, '<% } else { %>');
    
    // Replace {% endif %} with <% } %>
    content = content.replace(/\{%\s*endif\s*%\}/g, '<% } %>');
    
    // Replace {% for item in items %} with <% items.forEach(item => { %>
    content = content.replace(/\{%\s*for\s+(.*?)\s+in\s+(.*?)\s*%\}/g, '<% $2.forEach($1 => { %>');
    
    // Replace {% endfor %} with <% }) %>
    content = content.replace(/\{%\s*endfor\s*%\}/g, '<% }) %>');
    
    // Replace session['name'] with session.name
    content = content.replace(/session\['name'\]/g, 'session.name');
    content = content.replace(/session\['role'\]/g, 'session.role');
    
    fs.writeFileSync(path.join(viewsDir, file), content);
});
console.log('Jinja to EJS conversion complete!');
