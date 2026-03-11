export type Currency = 'CAD' | 'USD';

export interface Stock {
  id: string;
  name: string;
  symbol: string;
  currency: Currency;
  sector: string;
  executedPrice: number; // Purchase price in original currency
  cadPriceAtExecution: number; // Purchase price converted to CAD
  shares: number;
  bookValue: number; // CAD price at execution * shares
  
  // Source 1: Yahoo Finance API
  currentPriceYahoo?: number; 
  currentValueYahoo?: number;
  totalGainLossYahoo?: number;
  totalGainLossPercentageYahoo?: number;

  // Source 2: Alpha Vantage API
  currentPriceAlpha?: number;
  currentValueAlpha?: number;
  totalGainLossAlpha?: number;
  totalGainLossPercentageAlpha?: number;
}
