import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const ALPHA_VANTAGE_KEY = 'Z0APBBRUSGC2N08B';

// Map Yahoo-style symbols to Alpha Vantage style
const mapSymbolForAlpha = (s: string) => {
  if (!s) return s;
  let mapped = s;
  // Handle CAD stocks for Alpha Vantage
  if (mapped.endsWith('-CA')) {
    mapped = mapped.replace('-CA', '.TRT'); // Or .TO, .TRT is more common for Alpha Vantage CAD
  }
  if (mapped.endsWith('.TO')) {
    mapped = mapped.replace('.TO', '.TRT');
  }
  if (mapped.includes('-') && mapped.includes('.TRT')) {
    mapped = mapped.replace('-', '.');
  }
  return mapped;
};

export default defineConfig({
  base: "/portfolioDash/",
  plugins: [
    react(),
    {
      name: 'portfolio-api',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          if (req.url?.startsWith('/api/yahoo-prices')) {
            const url = new URL(req.url, `http://${req.headers.host}`);
            const symbolsParam = url.searchParams.get('symbols');
            
            if (!symbolsParam) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: 'Missing symbols' }));
              return;
            }

            const symbols = symbolsParam.split(',').map(s => s.trim());
            const prices: Record<string, number> = {};

            try {
              console.log(`\n--- Yahoo Finance Batch Request (Chart Endpoint) ---`);
              console.log(`Original Symbols: ${symbols.join(', ')}`);
              
              // Map symbols for Yahoo Finance
              const yahooSymbols = symbols.map(s => {
                if (s === 'CASH') return s;
                let mapped = s;
                
                // If it already has .TO, .V, or is a pure US symbol, or an index, don't mess with it
                if (mapped.endsWith('.TO') || mapped.endsWith('.V') || mapped.startsWith('^')) return mapped;
                if (!mapped.includes('-')) return mapped;

                // Handle class shares: BBD.B-CA -> BBD-B-CA
                if (mapped.includes('.') && mapped.includes('-CA')) {
                  mapped = mapped.replace('.', '-');
                }
                
                if (mapped.endsWith('-CA')) mapped = mapped.replace('-CA', '.TO');
                if (mapped.endsWith('-US')) mapped = mapped.replace('-US', '');
                return mapped;
              });

              for (let i = 0; i < yahooSymbols.length; i++) {
                const originalSymbol = symbols[i];
                const yahooSymbol = yahooSymbols[i];

                if (originalSymbol === 'CASH') {
                  prices[originalSymbol] = 1.0;
                  continue;
                }

                try {
                  const chartUrl = `https://query2.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?interval=1d&range=1d`;
                  console.log(`[Proxy] Yahoo Chart URL: ${chartUrl}`);
                  
                  const response = await fetch(chartUrl, {
                    headers: {
                      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                    }
                  });
                  
                  const data = await response.json() as any;
                  const result = data.chart?.result?.[0];
                  
                  if (result) {
                    const meta = result.meta;
                    const price = meta?.regularMarketPrice || meta?.chartPreviousClose || 0;
                    prices[originalSymbol] = price;
                    console.log(`[Proxy] Yahoo Data for ${yahooSymbol}:`);
                    console.log(`  - Meta Price: ${meta?.regularMarketPrice}`);
                    console.log(`  - Prev Close: ${meta?.chartPreviousClose}`);
                    console.log(`  - Using: ${price} ${meta?.currency}`);
                  } else {
                    console.error(`[Proxy] Yahoo returned no data for ${yahooSymbol}:`, data.chart?.error);
                    prices[originalSymbol] = 0;
                  }
                } catch (e: any) {
                  console.error(`[Proxy] Yahoo Error for ${originalSymbol}:`, e.message);
                  prices[originalSymbol] = 0;
                }
              }
              console.log(`--- Yahoo Batch Complete ---\n`);
              
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ prices }));
            } catch (error) {
              console.error('[Proxy] Yahoo Critical failure:', error);
              res.statusCode = 500;
              res.end(JSON.stringify({ error: 'Server Error' }));
            }
            return;
          }

          if (req.url?.startsWith('/api/alpha-prices')) {
            const url = new URL(req.url, `http://${req.headers.host}`);
            const symbolsParam = url.searchParams.get('symbols');
            
            if (!symbolsParam) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: 'Missing symbols' }));
              return;
            }

            const symbols = symbolsParam.split(',').map(s => s.trim());
            const prices: Record<string, number> = {};

            try {
              for (const originalSymbol of symbols) {
                if (originalSymbol === 'CASH') {
                  prices[originalSymbol] = 1.0;
                  continue;
                }

                const apiSymbol = mapSymbolForAlpha(originalSymbol);
                console.log(`[Proxy] Fetching Alpha price for: ${apiSymbol}`);
                
                try {
                  const stockUrl = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${apiSymbol}&apikey=${ALPHA_VANTAGE_KEY}`;
                  console.log(`[Proxy] Alpha URL: ${stockUrl.replace(ALPHA_VANTAGE_KEY, '***')}`);
                  const response = await fetch(stockUrl);
                  const data = await response.json() as any;
                  
                  if (data['Note'] || data['Information']) {
                    console.warn(`[Proxy] Alpha Limit reached for ${apiSymbol}`);
                    prices[originalSymbol] = 0;
                  } else {
                    const priceStr = data['Global Quote']?.['05. price'];
                    prices[originalSymbol] = priceStr ? parseFloat(priceStr) : 0;
                    console.log(`[Proxy] Alpha ${apiSymbol} Result: ${prices[originalSymbol]}`);
                  }
                  
                  if (symbols.length > 1) {
                    await new Promise(r => setTimeout(r, 12000));
                  }
                } catch (e) {
                  console.error(`[Proxy] Alpha fetch failed for ${apiSymbol}:`, e);
                  prices[originalSymbol] = 0;
                }
              }

              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ prices }));
            } catch (error) {
              console.error('[Proxy] Alpha Critical failure:', error);
              res.statusCode = 500;
              res.end(JSON.stringify({ error: 'Server Error' }));
            }
            return;
          }
          next();
        });
      }
    }
  ],
})
