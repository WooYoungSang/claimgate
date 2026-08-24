(function(){
  const src=document.getElementById('md-source').textContent.replace(/\r/g,'');
  const lines=src.split('\n');
  const esc=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const inline=s=>s
    .replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>')
    .replace(/`([^`]+)`/g,'<code>$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g,'<a href="$2">$1</a>');
  const cells=line=>line.trim().replace(/^\||\|$/g,'').split('|').map(x=>x.trim());
  let out=[],i=0;
  const special=l=>!l.trim()||/^#{1,3}\s/.test(l)||/^>/.test(l)||/^[-*]\s+/.test(l)||/^\d+\.\s+/.test(l)||/^\|/.test(l)||/^</.test(l);
  while(i<lines.length){
    let l=lines[i];
    if(!l.trim()){i++;continue;}
    let m=l.match(/^(#{1,3})\s+(.*)$/);
    if(m){const n=m[1].length;out.push(`<h${n}>${inline(m[2])}</h${n}>`);i++;continue;}
    if(l.trim().startsWith('<')){out.push(l);i++;continue;}
    if(l.startsWith('>')){let q=[];while(i<lines.length&&lines[i].startsWith('>'))q.push(lines[i++].replace(/^>\s?/,''));out.push(`<blockquote>${inline(q.join('<br>'))}</blockquote>`);continue;}
    if(/^\|/.test(l)&&i+1<lines.length&&/^\|?\s*:?-+/.test(lines[i+1])){
      const head=cells(l);i+=2;let rows=[];while(i<lines.length&&/^\|/.test(lines[i]))rows.push(cells(lines[i++]));
      out.push('<table><thead><tr>'+head.map(x=>`<th>${inline(x)}</th>`).join('')+'</tr></thead><tbody>'+rows.map(r=>'<tr>'+r.map(x=>`<td>${inline(x)}</td>`).join('')+'</tr>').join('')+'</tbody></table>');continue;
    }
    if(/^[-*]\s+/.test(l)){let a=[];while(i<lines.length&&/^[-*]\s+/.test(lines[i]))a.push(lines[i++].replace(/^[-*]\s+/,''));out.push('<ul>'+a.map(x=>`<li>${inline(x)}</li>`).join('')+'</ul>');continue;}
    if(/^\d+\.\s+/.test(l)){let a=[];while(i<lines.length&&/^\d+\.\s+/.test(lines[i]))a.push(lines[i++].replace(/^\d+\.\s+/,''));out.push('<ol>'+a.map(x=>`<li>${inline(x)}</li>`).join('')+'</ol>');continue;}
    let p=[l];i++;while(i<lines.length&&!special(lines[i]))p.push(lines[i++]);out.push(`<p>${inline(p.join(' '))}</p>`);
  }
  document.getElementById('content').innerHTML=out.join('\n');
})();
