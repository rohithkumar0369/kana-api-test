import axios from "axios";

const local = {
  sameChainQuote: "http://localhost:3000/v1/swapQuote",
};

async function fetchQuote() {
  try {
    const response = await axios.get(local.sameChainQuote, {
      params: {
        inputToken: "0x0000000000000000000000000000000000000000",
        outputToken: "0x000000000000000000000000000000000006f89a",
        chain: "12",
        amountIn: "100000000",
        slippage: 0,
        evmExchange: JSON.stringify(["etaSwap"]),
      },
      headers: {
        "Content-Type": "application/json",
      },
    });
    console.log("🚀 ~ kanaswap ~ response:", response.data);
  } catch (error) {
    console.error("Error fetching quote:", error);
  }
}

fetchQuote();
