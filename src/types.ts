export type KanaSwapEndPoints = {
  sameChainQuote:string;
  swap:string;
  crossChainQuote: string; // cross chain quotes
  transfer: string; // cross chain instruction
  claim: string;
  redeem: string;
};

export type KanaBatchSwapEndPoints = {
  batchSwapQuote: string; //batch cross chain quotes
  batchSwapInstruction: string; //batch cross chain instruction
  batchPermit:string;
};
