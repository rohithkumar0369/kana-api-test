import axios from "axios";
import {
  Client,
  PrivateKey,
  AccountId,
  ContractExecuteTransaction,
  Hbar,
  ContractId,
  AccountAllowanceApproveTransaction,
  TokenId,
} from "@hashgraph/sdk";
import dotenv from "dotenv";

dotenv.config();

const tokens: Record<string, string> = {
  HBAR: "0x0000000000000000000000000000000000000000",
  USDC: "0x000000000000000000000000000000000006f89a",
  KARATE: "0x000000000000000000000000000000000022d6de",
  USDT: "0x0000000000000000000000000000000000101af0",
  Calaxy: "0x00000000000000000000000000000000000d1ea6",
  Satoshi: "0x00000000000000000000000000000000000ff4da",
  SAUCE: "0x00000000000000000000000000000000000b2ad5",
  Dai: "0x0000000000000000000000000000000000101af5",
};

const local = {
  swapQuote: "https://ag-test.kanalabs.io/v1/swapQuote",
  swapInstruction: "https://ag-test.kanalabs.io/v1/swapInstruction",
};

if (!process.env.HEDERA_PRIVATE_KEY || !process.env.HEDERA_ACCOUNT_ID) {
  throw new Error("Missing HEDERA_PRIVATE_KEY or HEDERA_ACCOUNT_ID in .env");
}

const privateKey = PrivateKey.fromString(process.env.HEDERA_PRIVATE_KEY);
const accountId = AccountId.fromString(process.env.HEDERA_ACCOUNT_ID);
const hederaClient = Client.forMainnet();
hederaClient.setOperator(accountId, privateKey);

const swapResults: string[] = [];

async function executeContractCall(ix: any, label: string): Promise<string> {
  try {
    const contractNumHex = ix.to.slice(-40);
    const contractNum = parseInt(contractNumHex, 16);
    const contractId = new ContractId(0, 0, contractNum);

    console.log(`Executing ${label} on contract: ${contractId.toString()}`);

    const hbarValue = Hbar.fromTinybars(ix.value || 0);
    const callData = ix.data;
    const gasLimit = 2_000_000;

    const txn = new ContractExecuteTransaction()
      .setContractId(contractId)
      .setGas(gasLimit)
      .setFunctionParameters(Buffer.from(callData.slice(2), "hex"));

    if (hbarValue.toTinybars().toNumber() > 0) {
      txn.setPayableAmount(hbarValue);
    }

    const signedTxn = await txn.freezeWith(hederaClient).sign(privateKey);
    const executedTxn = await signedTxn.execute(hederaClient);
    const receipt = await executedTxn.getReceipt(hederaClient);

    const status = receipt.status.toString();
    console.log(
      ` ${label} TX Hash:`,
      Buffer.from(executedTxn.transactionHash).toString("hex")
    );
    console.log(`Status: ${status}`);

    if (status !== "SUCCESS") {
      throw new Error(`Contract execution failed: ${status}`);
    }

    return "Success";
  } catch (err: any) {
    throw new Error(err?.message || "Unknown contract execution error");
  }
}

async function runFullSwapFlow() {
  console.log(":repeat: Starting Hedera token swaps...");
  const tokenKeys = Object.keys(tokens);

  let count = 1;

  for (const inputTokenName of tokenKeys) {
    for (const outputTokenName of tokenKeys) {
      if (inputTokenName === outputTokenName) continue;

      const label = `${inputTokenName} → ${outputTokenName}`;
      console.log(`:currency_exchange: Swapping ${label}`);

      try {
        const inputToken = tokens[inputTokenName];
        const outputToken = tokens[outputTokenName];

        let amountIn: string;

        switch (inputTokenName) {
          case "HBAR":
            amountIn = "50000000";
            break;
          case "USDC":
          case "USDT":
            amountIn = "200000";
            break;
          case "KARATE":
            amountIn = "1000000000";
            break;
          case "Calaxy":
            amountIn = "10000000";
            break;
          case "Satoshi":
            amountIn = "10000000000";
            break;
          case "Dai":
            amountIn = "20000000";
            break;
          case "SAUCE":
            amountIn = "2000000";
            break;
          default:
            amountIn = "100000000";
        }

        const quoteRes = await axios.get(local.swapQuote, {
          params: {
            inputToken,
            outputToken,
            chain: "12",
            amountIn,
            slippage: 0.5,
            evmExchange: JSON.stringify(["etaSwap"]),
          },
        });

        const quoteList = quoteRes.data?.data;
        if (!Array.isArray(quoteList) || quoteList.length === 0) {
          swapResults.push(
            `${count++}. ${inputTokenName} to ${outputTokenName} - :x: Fail - Reason: No quote available`
          );
          continue;
        }

        const quoteData = quoteList[0];
        // console.log("Quote", quoteData);

        const instructionRes = await axios.post(
          local.swapInstruction,
          {
            chain: "12",
            quote: quoteData,
            address: "0x4ade31Ee6009cB35427afEb784B59E881a459225",
          },
          { headers: { "Content-Type": "application/json" } }
        );

        const swapIX = instructionRes.data?.data?.swapIX;
        if (!swapIX) {
          swapResults.push(
            `${count++}. ${inputTokenName} to ${outputTokenName} - :x: Fail - Reason: Missing swapIX`
          );
          continue;
        }

        // Approve if needed
        if (inputTokenName !== "HBAR") {
          const spenderContractNum = parseInt(swapIX.to.slice(-40), 16);
          const spenderContractId = new ContractId(0, 0, spenderContractNum);

          const tokenHex = inputToken.slice(-40);
          const tokenNum = parseInt(tokenHex, 16);
          const tokenId = TokenId.fromString(`0.0.${tokenNum}`);

          const allowanceTx = await new AccountAllowanceApproveTransaction()
            .approveTokenAllowance(
              tokenId,
              accountId,
              spenderContractId,
              quoteData.amountIn
            )
            .freezeWith(hederaClient)
            .sign(privateKey);

          const allowanceRes = await allowanceTx.execute(hederaClient);
          const allowanceReceipt = await allowanceRes.getReceipt(hederaClient);

          console.log(
            ":white_check_mark: HTS Allowance status:",
            allowanceReceipt.status.toString()
          );
        }

        // Execute swap
        await executeContractCall(swapIX, label);
        console.log(":white_check_mark: Swap flow completed.\n");

        swapResults.push(
          `${count++}. ${inputTokenName} to ${outputTokenName} - :white_check_mark: Success`
        );
      } catch (err: any) {
        console.error(":x: Swap failed:", label);
        console.error("Reason:", err?.message || err);
        swapResults.push(
          `${count++}. ${inputTokenName} to ${outputTokenName} - :x: Fail - Reason: ${
            err?.message || "Unknown error"
          }`
        );
      }
    }
  }

  console.log("\n:clipboard: === Swap Summary Report ===");
  for (const line of swapResults) {
    console.log(line);
  }

  console.log("\n:white_check_mark::white_check_mark: All swaps completed.");
}

runFullSwapFlow();
