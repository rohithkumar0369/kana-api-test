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

const local = {
  swapQuote: "https://ag-test.kanalabs.io/v1/swapQuote",
  swapInstruction: "https://ag-test.kanalabs.io/v1/swapInstruction",
};

if (!process.env.HEDERA_PRIVATE_KEY || !process.env.HEDERA_ACCOUNT_ID) {
  throw new Error("Missing HEDERA_PRIVATE_KEY or HEDERA_ACCOUNT_ID in .env");
}

const privateKey = PrivateKey.fromStringECDSA(process.env.HEDERA_PRIVATE_KEY);
const accountId = AccountId.fromString(process.env.HEDERA_ACCOUNT_ID);
const hederaClient = Client.forMainnet();
hederaClient.setOperator(accountId, privateKey);

async function executeContractCall(ix: any, label: string) {
  const contractEVMAddress = ix.to;
  const contractNumHex = contractEVMAddress.slice(-40);
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

  console.log(
    ` ${label} TX Hash:`,
    Buffer.from(executedTxn.transactionHash).toString("hex")
  );
  console.log(`Status: ${receipt.status.toString()}`);
}

async function runFullSwapFlow() {
  try {
    console.log(" Starting");

    const quoteResponse = await axios.get(local.swapQuote, {
      params: {
        inputToken: "0x0000000000000000000000000000000000000000",
        outputToken: "0x000000000000000000000000000000000006f89a",
        chain: "12",
        amountIn: "1000000",
        slippage: 0.5,
        evmExchange: JSON.stringify(["etaSwap"]),
      },
    });

    const quoteList = quoteResponse.data?.data;
    if (!Array.isArray(quoteList) || quoteList.length === 0) {
      throw new Error(" No quote data found in response");
    }

    const quoteData = quoteList[0];
    console.log(" Quote selected:", quoteData);

    const instructionResponse = await axios.post(
      local.swapInstruction,
      {
        chain: "12",
        quote: quoteData,
        address: "0x4ade31Ee6009cB35427afEb784B59E881a459225",
      },
      {
        headers: { "Content-Type": "application/json" },
      }
    );

    const swapIX = instructionResponse.data?.data?.swapIX;
    if (!swapIX) throw new Error(" Missing swapIX in instruction response");

    const spenderEvmAddress = swapIX.to;
    const spenderContractNumHex = spenderEvmAddress.slice(-40);
    const spenderContractNum = parseInt(spenderContractNumHex, 16);
    const spenderContractId = new ContractId(0, 0, spenderContractNum);

    const usdcTokenId = TokenId.fromString("0.0.456858");
    console.log(
      ` Approving ${quoteData.amountIn} USDC to ${spenderContractId.toString()}`
    );

    const allowanceTx = await new AccountAllowanceApproveTransaction()
      .approveTokenAllowance(
        usdcTokenId,
        accountId,
        spenderContractId,
        quoteData.amountIn
      )
      .freezeWith(hederaClient)
      .sign(privateKey);

    const allowanceRes = await allowanceTx.execute(hederaClient);
    const allowanceReceipt = await allowanceRes.getReceipt(hederaClient);
    console.log(" HTS Allowance status:", allowanceReceipt.status.toString());

    await executeContractCall(swapIX, "Swap");

    console.log(" Swap flow completed successfully.");
  } catch (err: any) {
    console.error(
      "Error during swap flow:",
      err?.response?.data || err.message || err
    );
  }
}

runFullSwapFlow();
