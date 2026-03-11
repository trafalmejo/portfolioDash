# Portfolio Tracker

A web-based tool to track the current price of stocks, featuring an interactive table with Excel-like functionality and automated price updates.

## Project Overview
- **Goal:** Create a visually appealing, functional stock portfolio tracker.
- **Tech Stack:** React (TypeScript), Vite, Vanilla CSS.
- **API Providers:** 
    - **Yahoo Finance:** (via Vite Proxy & Chart API) - Main real-time source.
    - **Alpha Vantage:** Secondary source for redundancy.
    - **Bank of Canada (Valet):** Official source for daily USD/CAD exchange rates.

## Key Features
- **Centering:** The application is perfectly centered both vertically and horizontally.
- **Interactive Table:** Manage stocks with columns for Shares, Executed Price, and Book Value.
- **Redundant Pricing:** Dual columns for Yahoo Finance and Alpha Vantage prices.
- **Collapsible Alpha:** The Alpha Vantage column can be shown/hidden to focus on Yahoo data and save API limits.
- **TSX Index Tracker:** Live S&P/TSX Index (^GSPTSE) displayed in the summary cards.
- **Real-time FX:** Automated USD/CAD conversion using Bank of Canada daily rates.
- **Direct Verification:** 
    - "Verify" column with links to Yahoo Finance web pages.
    - "api" links next to Yahoo prices for direct raw JSON verification.
- **Price Persistence:** Last successful API results are saved to `localStorage` to handle intermittent failures or rate limits.
- **Export to CSV:** Full portfolio export including current prices, FX rates, and the TSX Index.
- **Automatic Refresh:** Yahoo prices and FX rates refresh automatically on page load.
- **Manual Control:** Separate "Refresh Yahoo" and "Refresh Alpha" buttons to manage rate limits.

## Stock Data (Initial Import)
The following stocks were provided by the user for initial tracking:

| Name | Symbol | Currency | Sector | Executed Price | Shares |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Franco-Nevada Corp | FNV.TO | CAD | Materials | 303.09 | 1.0 |
| Agnico Eagle Mines | AEM.TO | CAD | Materials | 232.22 | 2.0 |
| Atkinsrealis Group Inc | ATRL.TO | CAD | Industrials | 100.03 | 6.0 |
| Bombardier Inc. Cl B | BBD-B.TO | CAD | Industrials | 189.78 | 1.0 |
| Element Fleet Mgmt | EFN.TO | CAD | Industrials | 36.37 | 20.0 |
| WSP Global Inc | WSP.TO | CAD | Industrials | 272.00 | 2.0 |
| Micron Technology | MU | USD | Info Tech | 199.05 | 1.0 |
| Dollarama Inc. | DOL.TO | CAD | Consumer | 183.52 | 3.0 |
| Aritzia, Inc. | ATZ.TO | CAD | Consumer | 82.88 | 5.0 |
| Loblaw Companies | L.TO | CAD | Consumer | 53.80 | 11.0 |
| Boston Scientific Co | BSX | USD | Health Care | 99.34 | 7.0 |
| TMX Group Ltd. | X.TO | CAD | Financials | 52.31 | 11.0 |
| Mastercard Inc | MA | USD | Financials | 583.59 | 1.0 |
| Brookfield Corp | BN.TO | CAD | Financials | 64.00 | 12.0 |
| Celestica Inc. | CLS.TO | CAD | Info Tech | 434.00 | 2.0 |
| Shopify, Inc. Class A | SHOP.TO | CAD | Info Tech | 244.93 | 2.0 |
| CGI Inc. Class A | GIB-A.TO | CAD | Info Tech | 122.50 | 3.0 |
| Intuit Inc. | INTU | USD | Info Tech | 675.72 | 1.0 |
| Rogers Communications | RCI-B.TO | CAD | Communica | 51.90 | 12.0 |
| Cash | CASH | CAD | N/A | 1.00 | 1873.0 |

## Current Status
- [x] Centered UI horizontally and vertically.
- [x] Integrated Yahoo Finance Chart API (/v8/chart) for reliable data.
- [x] Integrated Bank of Canada Valet API for FX rates.
- [x] Implemented "Book Value" and "Executed Price" column renaming.
- [x] Removed commas from stock names for cleaner display.
- [x] Added collapsible Alpha Vantage column with separate refresh controls.
- [x] Added live TSX Index tracker in summary cards.
- [x] Updated CSV export with all new metrics (FX Rate, Book Value, TSX Index).
- [x] Cleaned header by removing Debug and Reset buttons.

## Next Steps
- [ ] Add more complex performance charts (History/Trends).
- [ ] Implement manual entry for new stocks via the UI.
- [ ] Support for multiple portfolios.
- [ ] Implement dark/light mode toggle (currently defaults to system preference).
