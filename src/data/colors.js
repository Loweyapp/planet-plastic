export var CODE_COLORS = {
  'XF-1':'#1a1a1a','XF-2':'#f5f4f0','XF-7':'#c0392b','XF-8':'#2471a3','XF-9':'#7b2d00',
  'XF-10':'#6b3a2a','XF-11':'#2d5a27','XF-13':'#3a6b2a','XF-14':'#9ba8a0','XF-15':'#e8c9a0',
  'XF-16':'#c0c0c0','XF-17':'#1a4a6b','XF-18':'#2e5fa3','XF-19':'#b0b8b4','XF-20':'#8a9a95',
  'XF-21':'#b8d4c0','XF-22':'#8c9490','XF-23':'#8ab4d4','XF-24':'#5a6560','XF-26':'#1e4d2b',
  'XF-27':'#1a2e1a','XF-28':'#7a4a20','XF-50':'#4a6a8a','XF-51':'#6b6040','XF-52':'#8a6a40',
  'XF-53':'#7a8a85','XF-54':'#6a7870','XF-55':'#c8b890','XF-56':'#8a9098','XF-57':'#c8a870',
  'XF-58':'#3a5a28','XF-59':'#c8a050','XF-60':'#c8a040','XF-61':'#2a4a22','XF-62':'#4a5830',
  'XF-63':'#3a4040','XF-69':'#1a1e1a','XF-71':'#3a5a40','XF-78':'#c8b080','XF-81':'#2d4d28',
  'XF-83':'#7a8880','XF-84':'#4a4040','XF-85':'#1a1a18','XF-86':'#f0f0ee',
  'X-3':'#1a3a8a','X-8':'#e8d820','X-9':'#7a4020','X-10':'#4a5058','X-11':'#d8d8d8',
  'X-12':'#d4a830','X-18':'#1a1a1a','X-19':'#3a3a3a','X-23':'#2040a0','X-24':'#e8d820',
  'X-25':'#207040','X-27':'#b02020','X-33':'#8a6020','X-34':'#7a5030',
};

var NAME_COLORS = {
  black:'#1a1a1a', white:'#f8f8f6', red:'#c0392b', blue:'#2471a3', green:'#27ae60',
  yellow:'#f1c40f', grey:'#95a5a6', gray:'#95a5a6', brown:'#7b3f00', orange:'#e67e22',
  flesh:'#e8c9a0', tan:'#c8a870', earth:'#8a6a40', olive:'#4a5830', dark:'#3a3a3a',
  light:'#c8d0cc', silver:'#c0c0c8', gold:'#d4a830', copper:'#b87333', iron:'#4a4040',
  chrome:'#d8d8e0', aluminium:'#c8c8c8', aluminum:'#c8c8c8', metallic:'#a0a8b0',
  rust:'#8b3a20', sand:'#d4c090', buff:'#c8a870', pink:'#e8a0a0', purple:'#8040a0',
  clear:'#e0e8f0', smoke:'#5a5a60', wash:'#4a4a50', primer:'#8a8a90',
};

export function swatchColor(item) {
  if (item['Code'] && CODE_COLORS[item['Code']]) return CODE_COLORS[item['Code']];
  var name = (item['Product Name'] || '').toLowerCase();
  for (var kw of Object.keys(NAME_COLORS)) {
    if (name.includes(kw)) return NAME_COLORS[kw];
  }
  var cat = (item['Category'] || '').toLowerCase();
  if (cat === 'primer')    return '#8a8a90';
  if (cat === 'varnish')   return '#e0e8f4';
  if (cat === 'thinner')   return '#e8f0e0';
  if (cat === 'weathering') return '#7a6a50';
  return '#d0d0d0';
}
