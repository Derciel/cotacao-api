// Native fetch will be used
const query = `[out:json][timeout:15];
(
  node["barrier"="toll_booth"](-23.6,-46.7,-23.4,-46.5);
  node["highway"="toll_gantry"](-23.6,-46.7,-23.4,-46.5);
);
out body;`;
fetch('https://overpass-api.de/api/interpreter', {
  method: 'POST',
  body: 'data=' + encodeURIComponent(query),
  headers: { 
    'Content-Type': 'application/x-www-form-urlencoded',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
  }
}).then(r => r.text()).then(console.log).catch(console.error);
