const years = [2025, 2026];

for (const year of years) {
  const url = `https://www.panamaloteria.com/resultados-sorteo-gorditodelzodiaco.php?ano=${year}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } });
  const html = await res.text();

  // Parse each <tr> that contains a Gordito draw
  const trBlocks = html.match(/<tr[\s\S]*?<\/tr>/g) || [];
  for (const tr of trBlocks) {
    const dateMatch = tr.match(/Gordito Del Zodiaco (\d{2})\/(\d{2})\/(\d{4})/);
    if (!dateMatch) continue;

    const numbers = [...tr.matchAll(/label-numero">([\d]+)<\/span>/g)].map(m => m[1]);
    if (numbers.length < 3) continue;

    const [, day, month, yr] = dateMatch;
    const [first, second, third] = numbers;
    console.log(`${yr}-${month}-${day} | Gordito | 1ro ${first} term ${first.slice(-2)} | 2do ${second} term ${second.slice(-2).padStart(2,'0')} | 3ro ${third} term ${third.slice(-2).padStart(2,'0')} | Fuente PanamaLoteria`);
  }
}
