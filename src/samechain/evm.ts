import axios from "axios";
import {
  Client,
  PrivateKey,
  AccountId,
  ContractExecuteTransaction,
  Hbar,
  ContractId,
} from "@hashgraph/sdk";
import dotenv from "dotenv";

dotenv.config();

const local = {
  sameChainQuote: "http://localhost:3000/v1/swapQuote",
  sameChainInstruction: "http://localhost:3000/v1/swapInstruction",
};

if (!process.env.HEDERA_PRIVATE_KEY || !process.env.HEDERA_ACCOUNT_ID) {
  throw new Error("Missing HEDERA_PRIVATE_KEY or HEDERA_ACCOUNT_ID in .env");
}

const privateKey = PrivateKey.fromStringECDSA(process.env.HEDERA_PRIVATE_KEY);
const accountId = AccountId.fromString(process.env.HEDERA_ACCOUNT_ID);

const hederaClient = Client.forMainnet();
hederaClient.setOperator(accountId, privateKey);

async function runFullSwapFlow() {
  try {
    console.log("Starting full swap flow...");

    const quoteResponse = await axios.get(local.sameChainQuote, {
      params: {
        inputToken: "0x0000000000000000000000000000000000000000",
        outputToken: "0x000000000000000000000000000000000006f89a",
        chain: "12",
        amountIn: "100000000",
        slippage: 0.5,
        evmExchange: JSON.stringify(["etaSwap"]),
      },
      headers: {
        "Content-Type": "application/json",
      },
    });

    const quoteData = quoteResponse.data?.data?.[0];
    if (!quoteData) {
      throw new Error(
        "No quote data received. Check quote parameters and API response."
      );
    }
    console.log("Quote fetched:", quoteData);

    const instructionResponse = await axios.post(
      local.sameChainInstruction,
      {
        chain: "12",
        quote: quoteData,

        address: "0x4ade31Ee6009cB35427afEb784B59E881a459225",
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    const swapInstructionData = instructionResponse.data?.data?.swapIX;
    if (!swapInstructionData) {
      throw new Error("No swap instruction data received or incorrect format.");
    }

    console.log(" EVM Swap Instruction received:", swapInstructionData);

    const contractEVMAddress = swapInstructionData.to;

    const contractNumHex = contractEVMAddress.slice(-40);
    const contractNum = parseInt(contractNumHex, 16);

    const contractId = new ContractId(0, 0, contractNum);

    console.log(`Derived Hedera Contract ID: ${contractId.toString()}`);

    const callData = swapInstructionData.data;
    const hbarValue = Hbar.fromTinybars(swapInstructionData.value);
    const gasLimit = 1_000_000;

    const contractExecuteTxn = new ContractExecuteTransaction()
      .setContractId(contractId)
      .setGas(gasLimit)
      .setFunctionParameters(Buffer.from(callData.slice(2), "hex"));

    if (hbarValue.toTinybars().toNumber() > 0) {
      contractExecuteTxn.setPayableAmount(hbarValue);
    }

    console.log(" Hedera ContractExecuteTransaction built. Executing...");

    const signedTxn = await contractExecuteTxn
      .freezeWith(hederaClient)
      .sign(privateKey);

    const executedTxn = await signedTxn.execute(hederaClient);
    const receipt = await executedTxn.getReceipt(hederaClient); // ✅ Correct usage

    console.log("Swap successful!");
    console.log(
      " Transaction Hash:",
      Buffer.from(executedTxn.transactionHash).toString("hex")
    );
    console.log("Receipt status:", receipt.status.toString());
  } catch (error) {
    console.error(
      " Error during swap flow:",
      error?.response?.data || error.message || error
    );
    if (error.status) {
      console.error("Error status:", error.status);
    }
    if (error.code) {
      console.error("Error code:", error.code);
    }
    if (error.transactionId) {
      console.error(
        "Transaction ID (if available):",
        error.transactionId.toString()
      );
    }
  }
}

runFullSwapFlow();
