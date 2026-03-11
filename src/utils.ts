const ALPHA_VANTAGE_KEY = 'Z0APBBRUSGC2N08B';

export const formatCurrency = (amount: number, currency: string = 'CAD') => {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

export const formatPercentage = (value: number) => {
  return new Intl.NumberFormat('en-CA', {
    style: 'percent',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value / 100);
};

// Map Yahoo symbols to Alpha Vantage
const mapSymbol = (s: string) => {
  if (s === 'CASH') return s;
  let mapped = s;
  if (mapped.includes('-') && mapped.includes('.TO')) {
    mapped = mapped.replace('-', '.');
  }
  return mapped;
};

// Helper to get the Yahoo Chart API URL
export const getYahooChartUrl = (s: string) => {
  if (s === 'CASH') return '';
  let mapped = s;
  
  // Handle class shares: BBD.B-CA -> BBD-B-CA
  if (mapped.includes('.') && mapped.includes('-CA')) {
    mapped = mapped.replace('.', '-');
  }
  
  if (mapped.endsWith('-CA')) mapped = mapped.replace('-CA', '.TO');
  if (mapped.endsWith('-US')) mapped = mapped.replace('-US', '');
  
  return `https://query2.finance.yahoo.com/v8/finance/chart/${mapped}?interval=1d&range=1d`;
};

// Fetch through our local proxy when in DEV mode, otherwise use a CORS proxy for static hosting
export const fetchYahooPrices = async (symbols: string[]) => {
  if (import.meta.env.DEV) {
    try {
      const response = await fetch(`/api/yahoo-prices?symbols=${symbols.join(',')}`);
      const data = await response.json();
      return data.prices || {};
    } catch (e) {
      console.error('Local Yahoo proxy failed, falling back...', e);
    }
  }

  try {
    const prices: Record<string, number> = {};
    
    // Batch process to avoid too many requests
    for (const symbol of symbols) {
      if (symbol === 'CASH') {
        prices[symbol] = 1.0;
        continue;
      }

      const url = getYahooChartUrl(symbol);
      const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
      
      try {
        const response = await fetch(proxyUrl);
        const json = await response.json();
        const data = JSON.parse(json.contents);
        const result = data.chart?.result?.[0];
        
        if (result) {
          const meta = result.meta;
          prices[symbol] = meta?.regularMarketPrice || meta?.chartPreviousClose || 0;
        } else {
          prices[symbol] = 0;
        }
      } catch (e) {
        console.error(`Yahoo fetch failed for ${symbol}:`, e);
        prices[symbol] = 0;
      }
    }
    return prices;
  } catch (e) {
    console.error('Failed to fetch Yahoo prices:', e);
    return {};
  }
};

// Fetch Alpha Vantage through local proxy in DEV, otherwise direct
export const fetchAlphaPrices = async (symbols: string[]) => {
  if (import.meta.env.DEV) {
    try {
      const response = await fetch(`/api/alpha-prices?symbols=${symbols.join(',')}`);
      const data = await response.json();
      return data.prices || {};
    } catch (e) {
      console.error('Local Alpha proxy failed, falling back...', e);
    }
  }

  try {
    const prices: Record<string, number> = {};
    
    for (const symbol of symbols) {
      if (symbol === 'CASH') {
        prices[symbol] = 1.0;
        continue;
      }

      const apiSymbol = mapSymbol(symbol);
      const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${apiSymbol}&apikey=${ALPHA_VANTAGE_KEY}`;
      
      try {
        const response = await fetch(url);
        const data = await response.json();
        
        if (data['Note'] || data['Information']) {
          prices[symbol] = 0;
        } else {
          const priceStr = data['Global Quote']?.['05. price'];
          prices[symbol] = priceStr ? parseFloat(priceStr) : 0;
        }
        
        // Respect Alpha Vantage free tier limits (12s delay if more than 1)
        if (symbols.length > 1) {
          await new Promise(r => setTimeout(r, 12000));
        }
      } catch (e) {
        console.error(`Alpha fetch failed for ${symbol}:`, e);
        prices[symbol] = 0;
      }
    }
    return prices;
  } catch (e) {
    console.error('Failed to fetch Alpha prices:', e);
    return {};
  }
};

export const getExchangeRate = async () => {
  try {
    const response = await fetch('https://www.bankofcanada.ca/valet/observations/FXUSDCAD/json?recent=1');
    const data = await response.json();
    const rate = data.observations?.[0]?.FXUSDCAD?.v;
    return rate ? parseFloat(rate) : 1.40;
  } catch (e) {
    console.error('Bank of Canada exchange rate error:', e);
    return 1.40;
  }
};

export const downloadCSV = (stocks: any[], exchangeRate: number, tsxPrice: number | null) => {
  const headers = ['Name', 'Symbol', 'Shares', 'Executed Price', 'Book Value', 'Yahoo Price', 'Alpha Price', 'CAD Rate', 'Market Value', 'P/L', 'P/L %', 'S&P/TSX Index'];
  const rows = stocks.map(stock => {
    const marketValue = stock.currentValueYahoo && stock.currentValueAlpha 
      ? (stock.currentValueYahoo + stock.currentValueAlpha) / 2 
      : (stock.currentValueYahoo || stock.currentValueAlpha || 0);

    const plValue = marketValue > 0 ? marketValue - stock.bookValue : 0;
    const plPercentage = stock.bookValue > 0 ? (plValue / stock.bookValue) * 100 : 0;

    return [
      stock.name.replace(/,/g, ''),
      stock.symbol,
      stock.shares,
      stock.executedPrice,
      stock.shares * stock.executedPrice,
      stock.currentPriceYahoo || '',
      stock.currentPriceAlpha || '',
      exchangeRate,
      marketValue || '',
      plValue || '',
      plPercentage || '',
      tsxPrice || ''
    ];
  });


  const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `portfolio_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
