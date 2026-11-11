/* =========================================================
   Markdown mini-renderer (tanpa dependensi)
   Aman: semua teks di-escape sebelum dirender.
   ========================================================= */
(function (global) {
  'use strict';

  var ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  var TOK = '\u0001';
  var BLK = '\u0000';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ESC[c]; });
  }

  function inline(text) {
    var stash = [];
    function put(html) {
      stash.push(html);
      return TOK + (stash.length - 1) + TOK;
    }

    var s = String(text == null ? '' : text);

    // inline code
    s = s.replace(/`([^`\n]+)`/g, function (_, code) {
      return put('<code class="inline">' + esc(code) + '</code>');
    });

    // gambar
    s = s.replace(/!\[([^\]\n]*)\]\((https?:\/\/[^\s)]+)\)/g, function (_, alt, src) {
      return put('<img src="' + esc(src) + '" alt="' + esc(alt) + '" loading="lazy" style="max-width:100%;border-radius:10px">');
    });

    // tautan
    s = s.replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+|mailto:[^\s)]+)\)/g, function (_, label, href) {
      return put('<a href="' + esc(href) + '" target="_blank" rel="noopener noreferrer">' + esc(label) + '</a>');
    });

    s = esc(s);

    // tebal + miring
    s = s.replace(/\*\*\*([^*\n]+)\*\*\*/g, '<strong><em>$1</em></strong>');
    s = s.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/__([^_\n]+)__/g, '<strong>$1</strong>');
    s = s.replace(/(^|[\s(])\*([^*\n]+)\*/g, '$1<em>$2</em>');
    s = s.replace(/(^|[\s(])_([^_\n]+)_/g, '$1<em>$2</em>');
    s = s.replace(/~~([^~\n]+)~~/g, '<del>$1</del>');

    // tautan otomatis (teks sudah di-escape, jangan escape ulang)
    s = s.replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, function (_, pre, url) {
      return pre + put('<a href="' + url + '" target="_blank" rel="noopener noreferrer">' + url + '</a>');
    });

    return s.replace(/\u0001(\d+)\u0001/g, function (_, i) { return stash[+i]; });
  }

  function codeHTML(block) {
    var lang = String(block.lang || '').split(/\s+/)[0];
    return '<div class="codeblock">' +
      '<div class="codeblock-head"><span class="lang">' + esc(lang || 'kode') + '</span>' +
      '<button type="button" class="copy-code">Salin</button></div>' +
      '<pre><code>' + esc(block.code) + '</code></pre></div>';
  }

  function splitRow(row) {
    var r = row.trim();
    if (r.charAt(0) === '|') r = r.slice(1);
    if (r.charAt(r.length - 1) === '|') r = r.slice(0, -1);
    return r.split('|').map(function (c) { return c.trim(); });
  }

  function render(src) {
    var text = String(src == null ? '' : src).replace(/\r\n?/g, '\n');

    // blok kode yang belum ditutup (saat streaming)
    var fenceCount = (text.match(/```/g) || []).length;
    if (fenceCount % 2 === 1) text += '\n```';

    var codeBlocks = [];
    text = text.replace(/```([^\n`]*)\n?([\s\S]*?)```/g, function (_, lang, code) {
      var idx = codeBlocks.push({ lang: lang, code: code.replace(/\n$/, '') }) - 1;
      return BLK + 'C' + idx + BLK;
    });

    var lines = text.split('\n');
    var out = [];
    var para = [];
    var i = 0;

    function flushPara() {
      if (!para.length) return;
      var joined = para.join(' ').trim();
      para = [];
      if (joined) out.push('<p>' + inline(joined) + '</p>');
    }

    while (i < lines.length) {
      var line = lines[i];
      var trimmed = line.trim();

      if (!trimmed) { flushPara(); i++; continue; }

      // blok kode
      var codeMatch = trimmed.match(/^\u0000C(\d+)\u0000$/);
      if (codeMatch) {
        flushPara();
        out.push(codeHTML(codeBlocks[+codeMatch[1]]));
        i++;
        continue;
      }

      // judul
      var h = trimmed.match(/^(#{1,6})\s+(.*)$/);
      if (h) {
        flushPara();
        var level = Math.min(h[1].length, 4);
        var htext = h[2].replace(/\s+#+\s*$/, '');
        out.push('<h' + level + '>' + inline(htext) + '</h' + level + '>');
        i++;
        continue;
      }

      // garis pemisah
      if (/^([-*_])\1{2,}$/.test(trimmed)) {
        flushPara();
        out.push('<hr>');
        i++;
        continue;
      }

      // kutipan
      if (/^>\s?/.test(trimmed)) {
        flushPara();
        var quote = [];
        while (i < lines.length && /^>\s?/.test(lines[i].trim())) {
          quote.push(lines[i].trim().replace(/^>\s?/, ''));
          i++;
        }
        out.push('<blockquote>' + render(quote.join('\n')) + '</blockquote>');
        continue;
      }

      // tabel
      if (
        trimmed.indexOf('|') !== -1 &&
        i + 1 < lines.length &&
        lines[i + 1].indexOf('-') !== -1 &&
        /^\s*\|?[\s:|-]+\|?\s*$/.test(lines[i + 1])
      ) {
        flushPara();
        var head = splitRow(lines[i]);
        var align = splitRow(lines[i + 1]).map(function (c) {
          var left = c.charAt(0) === ':';
          var right = c.charAt(c.length - 1) === ':';
          if (left && right) return 'center';
          if (right) return 'right';
          if (left) return 'left';
          return '';
        });
        i += 2;
        var rows = [];
        while (i < lines.length && lines[i].indexOf('|') !== -1 && lines[i].trim()) {
          rows.push(splitRow(lines[i]));
          i++;
        }
        var thead = '<tr>' + head.map(function (c, ci) {
          return '<th' + (align[ci] ? ' style="text-align:' + align[ci] + '"' : '') + '>' + inline(c) + '</th>';
        }).join('') + '</tr>';
        var tbody = rows.map(function (row) {
          return '<tr>' + head.map(function (_, ci) {
            return '<td' + (align[ci] ? ' style="text-align:' + align[ci] + '"' : '') + '>' + inline(row[ci] || '') + '</td>';
          }).join('') + '</tr>';
        }).join('');
        out.push('<table><thead>' + thead + '</thead><tbody>' + tbody + '</tbody></table>');
        continue;
      }

      // daftar
      if (/^\s*([-*+]|\d+[.)])\s+/.test(line)) {
        flushPara();
        var ordered = /^\s*\d+[.)]\s+/.test(line);
        var items = [];
        var start = 1;
        while (i < lines.length) {
          var m = lines[i].match(/^(\s*)([-*+]|\d+[.)])\s+(.*)$/);
          if (m) {
            if (!items.length) start = parseInt(m[2], 10) || 1;
            items.push(m[3]);
            i++;
            continue;
          }
          // lanjutan baris item (indentasi)
          if (lines[i].trim() && /^\s{2,}\S/.test(lines[i]) && items.length) {
            items[items.length - 1] += ' ' + lines[i].trim();
            i++;
            continue;
          }
          break;
        }
        var tag = ordered ? 'ol' : 'ul';
        var open = '<' + tag + (ordered && start !== 1 ? ' start="' + start + '"' : '') + '>';
        out.push(open + items.map(function (t) { return '<li>' + inline(t) + '</li>'; }).join('') + '</' + tag + '>');
        continue;
      }

      // paragraf
      para.push(trimmed);
      i++;
    }

    flushPara();

    return out.join('\n').replace(/\u0000C(\d+)\u0000/g, function (_, idx) {
      return codeHTML(codeBlocks[+idx]);
    });
  }

  global.Markdown = { render: render, escape: esc };
})(window);
