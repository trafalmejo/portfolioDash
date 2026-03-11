import { useState, useEffect } from "react";
import type { Stock } from "./types";
import { INITIAL_STOCKS } from "./data";
import {
  formatCurrency,
  formatPercentage,
  fetchYahooPrices,
  fetchAlphaPrices,
  getExchangeRate,
  downloadCSV,
  getYahooChartUrl,
} from "./utils";
import "./App.css";

function App() {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAlpha, setShowAlpha] = useState(false);
  const [exchangeRate, setExchangeRate] = useState(1.40);
  const [tsxPrice, setTsxPrice] = useState<number | null>(null);

  const formatIndex = (val: number) => {
    return new Intl.NumberFormat('en-CA', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(val);
  };

  // Load initial data and refresh prices immediately
  useEffect(() => {
    const init = async () => {
      const savedStocks = localStorage.getItem("portfolio_stocks_apis");
      let currentStocks: Stock[];

      if (savedStocks) {
        currentStocks = JSON.parse(savedStocks);
        setStocks(currentStocks);
      } else {
        currentStocks = INITIAL_STOCKS;
        setStocks(currentStocks);
        localStorage.setItem(
          "portfolio_stocks_apis",
          JSON.stringify(INITIAL_STOCKS),
        );
      }
      setLoading(false);

      // Trigger auto-refresh on start (Yahoo only to save Alpha limits)
      await handleRefreshPrices(currentStocks, true);
    };

    init();
  }, []);

  const handleRefreshSource = async (source: "yahoo" | "alpha") => {
    setRefreshing(true);
    try {
      const symbols = stocks.map(s => s.symbol);
      const newRate = await getExchangeRate();
      setExchangeRate(newRate);

      let yahooPrices: Record<string, number> = {};
      let alphaPrices: Record<string, number> = {};

      if (source === "yahoo") {
        yahooPrices = await fetchYahooPrices([...symbols, '^GSPTSE']);
        if (yahooPrices['^GSPTSE']) setTsxPrice(yahooPrices['^GSPTSE']);
      } else {
        alphaPrices = await fetchAlphaPrices(symbols);
      }

      const updatedStocks = stocks.map((stock) => {
        const newYahooPrice =
          source === "yahoo" ? yahooPrices[stock.symbol] : null;
        const currentPriceYahoo =
          newYahooPrice && newYahooPrice > 0
            ? newYahooPrice
            : stock.currentPriceYahoo || stock.executedPrice;

        const currentPriceCADYahoo =
          stock.currency === "USD"
            ? currentPriceYahoo * exchangeRate
            : currentPriceYahoo;
        const currentValueYahoo = currentPriceCADYahoo * stock.shares;

        const newAlphaPrice =
          source === "alpha" ? alphaPrices[stock.symbol] : null;
        const currentPriceAlpha =
          newAlphaPrice && newAlphaPrice > 0
            ? newAlphaPrice
            : stock.currentPriceAlpha || stock.executedPrice;

        const currentPriceCADAlpha =
          stock.currency === "USD"
            ? currentPriceAlpha * exchangeRate
            : currentPriceAlpha;
        const currentValueAlpha = currentPriceCADAlpha * stock.shares;

        return {
          ...stock,
          currentPriceYahoo,
          currentValueYahoo,
          currentPriceAlpha,
          currentValueAlpha,
        };
      });

      setStocks(updatedStocks);
      localStorage.setItem(
        "portfolio_stocks_apis",
        JSON.stringify(updatedStocks),
      );
    } catch (error) {
      console.error(`Failed to refresh ${source}:`, error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleRefreshPrices = async (
    stocksToUpdate?: Stock[],
    skipAlpha: boolean = false,
  ) => {
    setRefreshing(true);
    try {
      const activeStocks = stocksToUpdate || stocks;
      const symbols = activeStocks.map((s) => s.symbol);

      const yahooPromise = fetchYahooPrices([...symbols, '^GSPTSE']);
      const alphaPromise = skipAlpha
        ? Promise.resolve({})
        : fetchAlphaPrices(symbols);

      const [yahooPrices, alphaPrices] = await Promise.all([
        yahooPromise,
        alphaPromise,
      ]);

      if (yahooPrices['^GSPTSE']) setTsxPrice(yahooPrices['^GSPTSE']);

      console.log("--- Frontend Price Sync ---");
      console.log("Symbols requested:", symbols);
      console.log("Yahoo Prices received:", yahooPrices);

      const newRate = await getExchangeRate();
      setExchangeRate(newRate);

      const updatedStocks = (stocksToUpdate || stocks).map((stock) => {
        const livePriceFromApi = yahooPrices[stock.symbol];

        // ONLY update if we got a valid price (> 0) from the API.
        // Otherwise, keep the existing currentPriceYahoo (the "last price").
        const currentPriceYahoo =
          livePriceFromApi && livePriceFromApi > 0
            ? livePriceFromApi
            : stock.currentPriceYahoo || stock.executedPrice;

        const currentPriceCADYahoo =
          stock.currency === "USD"
            ? currentPriceYahoo * newRate
            : currentPriceYahoo;
        const currentValueYahoo = currentPriceCADYahoo * stock.shares;
        const totalGainLossYahoo = currentValueYahoo - stock.bookValue;
        const totalGainLossPercentageYahoo =
          (totalGainLossYahoo / stock.bookValue) * 100;

        const livePriceAlphaFromApi = alphaPrices[stock.symbol];
        const currentPriceAlpha =
          livePriceAlphaFromApi && livePriceAlphaFromApi > 0
            ? livePriceAlphaFromApi
            : stock.currentPriceAlpha || stock.executedPrice;

        const currentPriceCADAlpha =
          stock.currency === "USD"
            ? currentPriceAlpha * newRate
            : currentPriceAlpha;
        const currentValueAlpha = currentPriceCADAlpha * stock.shares;
        const totalGainLossAlpha = currentValueAlpha - stock.bookValue;
        const totalGainLossPercentageAlpha =
          (totalGainLossAlpha / stock.bookValue) * 100;

        return {
          ...stock,
          currentPriceYahoo,
          currentValueYahoo,
          totalGainLossYahoo,
          totalGainLossPercentageYahoo,
          currentPriceAlpha,
          currentValueAlpha,
          totalGainLossAlpha,
          totalGainLossPercentageAlpha,
        };
      });

      setStocks(updatedStocks);
      localStorage.setItem(
        "portfolio_stocks_apis",
        JSON.stringify(updatedStocks),
      );
    } catch (error) {
      console.error("Failed to fetch prices:", error);
    } finally {
      setRefreshing(false);
    }
  };

  const totalBookValue = stocks.reduce(
    (sum, stock) => sum + stock.bookValue,
    0,
  );
  const totalValueCombined = stocks.reduce((sum, stock) => {
    const avgValue =
      ((stock.currentValueYahoo || 0) + (stock.currentValueAlpha || 0)) / 2;
    return sum + (avgValue || 0);
  }, 0);

  const totalGainLossCombined =
    totalValueCombined > 0 ? totalValueCombined - totalBookValue : 0;
  const totalGainLossPercentageCombined =
    totalBookValue > 0 ? (totalGainLossCombined / totalBookValue) * 100 : 0;

  if (loading) {
    return <div className="loading-overlay">Loading portfolio...</div>;
  }

  return (
    <div className="app-container">
      <header>
        <h1>Portfolio Tracker</h1>
        <div className="controls">
          <button
            onClick={() => handleRefreshSource("yahoo")}
            className="yahoo-btn"
            disabled={refreshing}
          >
            Refresh Yahoo
          </button>
          <button
            onClick={() => setShowAlpha(!showAlpha)}
            className="toggle-btn"
          >
            {showAlpha ? "Hide Alpha" : "Show Alpha"}
          </button>
          {showAlpha && (
            <button
              onClick={() => handleRefreshSource("alpha")}
              className="alpha-btn"
              disabled={refreshing}
            >
              Refresh Alpha
            </button>
          )}
          <button onClick={() => downloadCSV(stocks, exchangeRate, tsxPrice)}>Export CSV</button>
        </div>
      </header>

      <div className="summary-cards">
        <div className="card">
          <h3>Total Book Value</h3>
          <p>{formatCurrency(totalBookValue)}</p>
        </div>
        <div className="card">
          <h3>Current Market Value</h3>
          <p>{formatCurrency(totalValueCombined)}</p>
        </div>
        <div className="card">
          <h3>USD/CAD Rate (BoC)</h3>
          <p>{exchangeRate.toFixed(4)}</p>
        </div>
        <div className="card">
          <h3>S&P/TSX Index</h3>
          <p>{tsxPrice ? formatIndex(tsxPrice) : "---"}</p>
        </div>
        <div className="card">
          <h3>Total P/L</h3>
          <p className={totalGainLossCombined >= 0 ? "gain" : "loss"}>
            {formatCurrency(totalGainLossCombined)} (
            {formatPercentage(totalGainLossPercentageCombined)})
          </p>
        </div>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Symbol</th>
              <th className="text-right">Shares</th>
              <th className="text-right">Executed Price</th>
              <th className="text-right">Book Value</th>
              <th className="text-right">Yahoo Price</th>

              {showAlpha && <th className="text-right">Alpha Price</th>}
              <th className="text-center">Verify</th>
              <th className="text-right">Market Value</th>
              <th className="text-right">P/L</th>
              <th className="text-right">P/L %</th>
            </tr>
          </thead>
          <tbody>
            {stocks.map((stock) => {
              const yahooPrice = stock.currentPriceYahoo;
              const alphaPrice = stock.currentPriceAlpha;

              // Use average of both for Market Value calculations
              const marketValue =
                stock.currentValueYahoo && stock.currentValueAlpha
                  ? (stock.currentValueYahoo + stock.currentValueAlpha) / 2
                  : stock.currentValueYahoo || stock.currentValueAlpha || 0;

              const plValue =
                marketValue > 0 ? marketValue - stock.bookValue : 0;
              const plPercentage =
                stock.bookValue > 0 ? (plValue / stock.bookValue) * 100 : 0;

              return (
                <tr key={stock.id}>
                  <td>{stock.name.replace(/,/g, '')}</td>
                  <td>{stock.symbol}</td>
                  <td className="text-right">{stock.shares}</td>
                  <td className="text-right">
                    {formatCurrency(stock.executedPrice, stock.currency)}
                  </td>
                  <td className="text-right">
                    {formatCurrency(stock.shares * stock.executedPrice, stock.currency)}
                  </td>
                  <td className="text-right">
                    {yahooPrice ? (
                      <div className="price-container">
                        <span className="price-source price-yahoo">
                          {formatCurrency(yahooPrice, stock.currency)}
                        </span>
                        <a
                          href={getYahooChartUrl(stock.symbol)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="api-link"
                          title="View raw API data"
                        >
                          api
                        </a>
                      </div>
                    ) : (
                      "-"
                    )}
                  </td>
                  {showAlpha && (
                    <td className="text-right">
                      {alphaPrice ? (
                        <span className="price-source price-alpha">
                          {formatCurrency(alphaPrice, stock.currency)}
                        </span>
                      ) : (
                        "-"
                      )}
                    </td>
                  )}
                  <td className="text-center">
                    <a
                      href={`https://finance.yahoo.com/quote/${stock.symbol}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="verify-link"
                      title="Fact check on Yahoo Finance"
                    >
                      ↗
                    </a>
                  </td>
                  <td className="text-right">
                    {marketValue ? formatCurrency(marketValue) : "-"}
                  </td>
                  <td
                    className={`text-right ${plValue >= 0 ? "gain" : "loss"}`}
                  >
                    {plValue ? formatCurrency(plValue) : "-"}
                  </td>
                  <td
                    className={`text-right ${plPercentage >= 0 ? "gain" : "loss"}`}
                  >
                    {plPercentage ? formatPercentage(plPercentage) : "-"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="footer-note">
        * Using Yahoo Finance (via yahoo-finance2) and Alpha Vantage Direct API.
        Note: Alpha Vantage Free tier is limited to 5 requests per minute.
      </p>
    </div>
  );
}

export default App;
