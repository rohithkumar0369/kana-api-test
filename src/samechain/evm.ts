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
const privateKey = PrivateKey.fromString(process.env.HEDERA_PRIVATE_KEY!);
const client = Client.forMainnet().setOperator(accountId, privateKey);

const inputToken = "0x000000000000000000000000000000000022d6de"; // KARATE
const outputToken = "0x0000000000000000000000000000000000000000"; // HBAR
const amountIn = "1000000"; 

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

  const res = await (
    await tx.freezeWith(client).sign(privateKey)
  ).execute(client);
  const receipt = await res.getReceipt(client);
  console.log("Swap tx status:", receipt.status.toString());
}

async function main() {
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

  // Approve if needed
  if (
    inputToken !== outputToken &&
    inputToken !== "0x0000000000000000000000000000000000000000"
  ) {
    const tokenId = TokenId.fromString(
      `0.0.${parseInt(inputToken.slice(-40), 16)}`
    );
    const spender = ContractId.fromSolidityAddress(swapIX.to);

    const approveTx = await new AccountAllowanceApproveTransaction()
      .approveTokenAllowance(tokenId, accountId, spender, amountIn)
      .freezeWith(client)
      .sign(privateKey);

    const approveRes = await approveTx.execute(client);
    const approveReceipt = await approveRes.getReceipt(client);
    console.log("Approve status:", approveReceipt.status.toString());
  }

  await executeContractCall(swapIX);
}

main().catch(console.error);
