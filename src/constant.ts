import { KanaBatchSwapEndPoints, KanaSwapEndPoints } from "./types";

export enum NetworkId {
  "solana" = 1,
  "aptos" = 2,
  "polygon" = 3,
  "bsc" = 4,
  "sui" = 5,
  "ethereum" = 6,
  "base" = 7,
  "zkSync" = 9,
  "Avalanche" = 10,
  "Arbitrum" = 11,
}

export const local: KanaSwapEndPoints = {
  sameChainQuote:'http://localhost:3000/v1/swapQuote',
  swap:'http://localhost:3000/v1/swapInstruction',
  crossChainQuote: 'http://localhost:3000/v1/crossChainQuote',
  transfer: 'http://localhost:3000/v1/crossChainTransfer',
  claim: 'http://localhost:3000/v1/claim',
  redeem: 'http://localhost:3000/v1/redeem',
};

export const developement: KanaSwapEndPoints = {
  sameChainQuote:'https://ag-test.kanalabs.io/v1/swapQuote',
  swap:'https://ag-test.kanalabs.io/v1/swapInstruction',
  crossChainQuote: 'https://ag-test.kanalabs.io/v1/crossChainQuote',
  transfer: 'https://ag-test.kanalabs.io/v1/crossChainTransfer',
  claim: 'https://ag-test.kanalabs.io/v1/claim',
  redeem: 'https://ag-test.kanalabs.io/v1/redeem',
};

export const production: KanaSwapEndPoints = {
  sameChainQuote:'https://ag.kanalabs.io/v1/swapQuote',
  swap:'https://ag.kanalabs.io/v1/swapInstruction',
  crossChainQuote: 'https://ag.kanalabs.io/v1/crossChainQuote',
  transfer: 'https://ag.kanalabs.io/v1/crossChainTransfer',
  claim: 'https://ag.kanalabs.io/v1/claim',
  redeem: 'https://ag.kanalabs.io/v1/redeem',
};

export const batch_local: KanaBatchSwapEndPoints = {
  batchSwapQuote: 'http://localhost:3000/v1/batchSwapQuote',
  batchSwapInstruction: 'http://localhost:3000/v1/batchSwapInstruction',
  batchPermit:'http://localhost:3000/v1/permit2SignatureController'
};

export const batch_production: KanaBatchSwapEndPoints = {
  batchSwapQuote: 'https://ag.kanalabs.io/v1/batchSwapQuote',
  batchSwapInstruction: 'https://ag.kanalabs.io/v1/batchSwapInstruction',
  batchPermit:'https://ag.kanalabs.io/v1/permit2SignatureController'
};