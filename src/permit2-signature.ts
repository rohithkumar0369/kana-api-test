import axios from "axios";
import "dotenv/config";
import { batch_local, NetworkId } from "./constant";
import { ethers } from "ethers";
import { BigNumber } from "@ethersproject/bignumber";

// const EVM_NODE_URI = "RPC";

// const POLYGON_PRIVATEKEY = "PRIVATEKEY"; // Replace with your Avalanche private key

// const privateKey = POLYGON_PRIVATEKEY as string;
// const rpc = EVM_NODE_URI as string;
// const provider = ethers.getDefaultProvider(rpc);
// const signer = new ethers.Wallet(privateKey, provider);

export const fetchSignature = async () => {
  const response = await axios.post(
    batch_local.batchSwapQuote,
    {
      fromTokenAddresses: [
        "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
        "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
      ],
      toTokenAddresses: ["0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063"],
      sourceChainId: [3,3],
      targetChainId: [3],
      fromAmounts: ["1000000000000000", "100000"],
      fromAddress: ["0x4ade31Ee6009cB35427afEb784B59E881a459225","0x4ade31Ee6009cB35427afEb784B59E881a459225"],
      toAddress: ["0x4ade31Ee6009cB35427afEb784B59E881a459225"],
    },
    {
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": "//* YOUR API KEY *//", // Your Kana API key
      },
    }
  );
  console.log("🚀 ~ kanaswap ~ response:", response?.data?.data);
  console.log(
    "🚀 ~ kanaswap ~ response:",
    response?.data?.data[0].fromChainId[0]
  );
};

fetchSignature();
