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

// Config
const accountId = AccountId.fromString(process.env.HEDERA_ACCOUNT_ID!);
const privateKey = PrivateKey.fromStringECDSA(process.env.HEDERA_PRIVATE_KEY!);
const client = Client.forMainnet().setOperator(accountId, privateKey);

const inputToken: string = "0x000000000000000000000000000000000022d6de"; // KARATE
const outputToken: string = "0x0000000000000000000000000000000000000000"; // HBAR
const amountIn: string = "1000000";

const local = {
  swapQuote: "https://ag-test.kanalabs.io/v1/swapQuote",
  swapInstruction: "https://ag-test.kanalabs.io/v1/swapInstruction",
};

async function executeContractCall(ix: any) {
  const contractId = ContractId.fromSolidityAddress(ix.to);
  const tx = new ContractExecuteTransaction()
    .setContractId(contractId)
    .setGas(2_000_000)
    .setFunctionParameters(Buffer.from(ix.data.slice(2), "hex"));

  if (ix.value && parseInt(ix.value) > 0) {
    tx.setPayableAmount(Hbar.fromTinybars(ix.value));
  }

  const signedTx = await tx.freezeWith(client).sign(privateKey);
  const res = await signedTx.execute(client);
  const txId = res.transactionId.toString();
  const receipt = await res.getReceipt(client);

  console.log("Swap Tx Hash:", txId);
  console.log("Swap Status:", receipt.status.toString());
}

async function main() {
  try {
    const quote = await axios.get(local.swapQuote, {
      params: {
        chain: "12",
        inputToken,
        outputToken,
        amountIn,
        slippage: 0.5,
        evmExchange: JSON.stringify(["etaSwap"]),
      },
    });

    const route = quote.data?.data?.[0];
    if (!route) throw new Error("No swap route found");

    const instruction = await axios.post(local.swapInstruction, {
      chain: "12",
      quote: route,
      address: "0x4ade31Ee6009cB35427afEb784B59E881a459225",
    });

    const swapIX = instruction.data?.data?.swapIX;
    if (!swapIX) throw new Error("No swap instruction returned");

    if (
      inputToken !== outputToken &&
      inputToken !== "0x0000000000000000000000000000000000000000"
    ) {
      const tokenId = TokenId.fromString(
        `0.0.${parseInt(inputToken.slice(-40), 16)}`
      );
      const spender = ContractId.fromSolidityAddress(swapIX.to);

      await new AccountAllowanceApproveTransaction()
        .approveTokenAllowance(tokenId, accountId, spender, Number(amountIn))
        .freezeWith(client)
        .sign(privateKey)
        .then((tx) => tx.execute(client))
        .then((res) => res.getReceipt(client));
    }

    await executeContractCall(swapIX);
    process.exit(0);
  } catch (err) {
    console.error("Swap failed:", err);
    process.exit(1);
  }
}

main();
