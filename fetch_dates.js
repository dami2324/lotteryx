const url = 'https://lotteryguru.com/panama-lottery-results/pa-miercolito/pa-miercolito-results-history';
fetch(url)
  .then(r=>r.text())
  .then(html => {
    const regex = /<strong>(\d{2}) (\w+)<\/strong>\s*(\d{4})/g;
    let match;
    while((match = regex.exec(html)) !== null) {
      console.log(`${match[3]}-${match[2]}-${match[1]}`);
    }
  });
