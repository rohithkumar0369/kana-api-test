import axios from "axios";
import "dotenv/config";
import { local, NetworkId } from "../constant";

export const fetchingQuotes = async () => {
  const response = await axios.get(local.sameChainQuote, {
    params: {
      inputToken: "0x0000000000000000000000000000000000000000",
      outputToken: "0x0000000000000000000000000000000000010348",
      chain: "295",
      amountIn: "100000000",
      slippage: 0,
      evmExchange: JSON.stringify(["etaSwap"]),
    },
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": "//* YOUR API KEY *//", // Your Kana API key
    },
  });
  console.log("🚀 ~ kanaswap ~ response:", response?.data?.data);
  console.log(
    "🚀 ~ kanaswap ~ response:",
    response?.data?.data[0].fromChainId[0]
  );
};

fetchingQuotes();
