import axios from "axios";
import "dotenv/config";
import {
  Account,
  AccountAddress,
  Aptos,
  AptosConfig,
  Ed25519Account,
  Ed25519PrivateKey,
  Network,
  PrivateKey,
  PrivateKeyVariants,
} from "@aptos-labs/ts-sdk";
import { NetworkId, production } from "../constant";
import { ethers } from "ethers";
import { BigNumber } from "@ethersproject/bignumber";

const config = new AptosConfig({ network: Network.MAINNET });
const aptos = new Aptos(config);

// Constants
const APTOS_PRIVATEKEY = "PRIVATEKEY"; // Replace with your Aptos private key
const EVM_NODE_URI =
  "RPC";

const AVALANCHE_PRIVATEKEY = "PRIVATEKEY"; // Replace with your Avalanche private key

const SOURCE_FROM_TOKEN_ADDRESS = "0x1::aptos_coin::AptosCoin"; //Aptos
const TARGET_TO_TOKEN_ADDRESS = "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E"; //USDC

const AMOUNT_IN = "10000000"; // 0.1 APT

const SLIPPAGE_PERCENTAGE = 0.5;

const privateKey = AVALANCHE_PRIVATEKEY as string;
const rpc = EVM_NODE_URI as string;
const provider = ethers.getDefaultProvider(rpc);
const signer = new ethers.Wallet(privateKey, provider);
const sender = Account.fromPrivateKey({
  privateKey: new Ed25519PrivateKey(
    PrivateKey.formatPrivateKey(APTOS_PRIVATEKEY, PrivateKeyVariants.Ed25519)
  ), // Aptos Privatekey
});

export const kanaswap = async () => {
  const response = await axios.get(production.crossChainQuote, {
    params: {
      sourceToken: SOURCE_FROM_TOKEN_ADDRESS, //APT
      targetToken: TARGET_TO_TOKEN_ADDRESS, //USDC
      sourceChain: NetworkId.aptos, //Aptos
      targetChain: NetworkId.Avalanche, //AXAX
      amountIn: AMOUNT_IN, // amonut
      sourceSlippage: SLIPPAGE_PERCENTAGE, // 1%
      targetSlippage: SLIPPAGE_PERCENTAGE, // 1%
    },
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": "//* YOUR API KEY *//",
    },
  });

  console.log("🚀 ~ kanaswap ~ response:", response?.data);
  const swapInstruction = await axios.post(
    production.transfer,
    {
      quote: response.data?.data[0],
      sourceAddress: sender.accountAddress.toString(), // Aptos Address.
      targetAddress: (await signer.getAddress()).toString(), // EVM Address
    },
    {
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": "//* YOUR API KEY *//", // Your Kana API key
      },
    }
  );
  console.log("🚀 ~ kanaswap ~ swapInstruction:", swapInstruction.data?.data);
  const swapInstructionResponce = await executeAptosInstruction({
    provider: aptos,
    signer: sender as Ed25519Account,
    instruction: swapInstruction.data?.data,
  });
  console.log(
    "🚀 ~ kanaswap ~ swapInstructionResponce:",
    swapInstructionResponce
  );
  const { messageBytes, attestationSignature } = await fetchSignature({
    chainId: response.data?.data[0].sourceNetwork,
    txHash: swapInstructionResponce!,
    bridge: BridgeId.cctp,
  });
  console.log("🚀 ~ kanaswap ~ attestationSignature:", attestationSignature);
  console.log("🚀 ~ kanaswap ~ messageBytes:", messageBytes);
  const redeem = await axios.post(
    production.redeem,
    {
      sourceChainID: response.data?.data[0].sourceNetwork,
      bridgeID: response.data?.data[0].bridge,
      targetChainID: response.data?.data[0].targetNetwork,
      targetAddress: (await signer.getAddress()).toString(), //EVM signer
      messageBytes: messageBytes,
      attestationSignature: attestationSignature,
    },
    {
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": "//* YOUR API KEY *//", // Your Kana API key
      },
    }
  );
  console.log("🚀 ~ kanaswap ~ redeem:", redeem?.data.data);

  console.log("🚀 ~ kanaswap ~ redeem:", redeem?.data.data.claimIx);
  console.log(
    "sender.accountAddress.toString()",
    (await signer.getAddress()).toString()
  );
  const claimHash = await executeEVMInstruction({
    signer,
    instruction: redeem.data?.data,
  });
  console.log("🚀 ~ kanaswap ~ claimHash:", claimHash);
};

kanaswap();

export enum BridgeId {
  "native" = 0,
  "wormhole" = 1,
  "layerzero" = 2,
  "cctp" = 3,
  "cctpV2" = 4,
  "SWFT" = 99,
  "LZ_OFT" = 102,
}

interface FetchSignatureParams {
  chainId: NetworkId;
  txHash: string;
  bridge: BridgeId.cctp | BridgeId.cctpV2;
  maxRetries?: number;
  pollInterval?: number;
}
interface AttestationMessage {
  message: string;
  attestation: string;
}
interface AttestationResponse {
  error?: string;
  messages?: AttestationMessage[];
}
interface SignatureResult {
  messageBytes: string;
  attestationSignature: string;
}
export const CIRCLE_ATTESTATION_API = "https://iris-api.circle.com/";
export const KanaChainID_TO_CCTP: {
  [key: number]: number;
} = {
  [NetworkId.ethereum]: 0,
  [NetworkId.Avalanche]: 1,
  [NetworkId.Arbitrum]: 3,
  [NetworkId.solana]: 5,
  [NetworkId.base]: 6,
  [NetworkId.polygon]: 7,
  [NetworkId.sui]: 8,
  [NetworkId.aptos]: 9,
};
export interface TransactionIX {
  to: string;
  from: string;
  value: string;
  data: string;
  gasPrice: string;
  gasLimit?: string;
  chainId: number;
  nonce?: number;
}

export interface transferIX {
  approveIX?: TransactionIX;
  transferIX?: TransactionIX;
}
export interface claimIX {
  claimIx?: TransactionIX;
}
export interface transferAptosIX {
  swapPayload?: EntryFunctionPayload;
  bridgePayload?: EntryFunctionPayload;
}
export const fetchSignature = async (
  params: FetchSignatureParams
): Promise<SignatureResult> => {
  const {
    chainId,
    txHash,
    bridge,
    maxRetries = 50,
    pollInterval = 2000,
  } = params;

  let attestationResponse: AttestationResponse = {};
  let retries = 0;

  while (
    (attestationResponse.error ||
      !attestationResponse.messages ||
      attestationResponse.messages?.[0]?.attestation === "PENDING") &&
    retries < maxRetries
  ) {
    try {
      // Construct URL based on API version
      const url =
        bridge === BridgeId.cctp
          ? `${CIRCLE_ATTESTATION_API}/messages/${KanaChainID_TO_CCTP[chainId]}/${txHash}`
          : `${CIRCLE_ATTESTATION_API}/v2/messages/${KanaChainID_TO_CCTP[chainId]}?transactionHash=${txHash}`;

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(
          `API request failed: ${response.status} ${response.statusText}`
        );
      }

      attestationResponse = await response.json();

      // If still pending or has error, wait before next attempt
      if (
        attestationResponse.error ||
        !attestationResponse.messages ||
        attestationResponse.messages?.[0]?.attestation === "PENDING"
      ) {
        retries++;
        if (retries < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, pollInterval));
        }
      }
    } catch (error) {
      retries++;
      console.error(`Fetch attempt ${retries} failed:`, error);

      if (retries < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, pollInterval));
      } else {
        throw new Error(
          `Failed to fetch signature after ${maxRetries} attempts: ${error}`
        );
      }
    }
  }
  if (retries >= maxRetries) {
    throw new Error(
      `Attestation timeout: max retries (${maxRetries}) exceeded`
    );
  }
  if (!attestationResponse.messages?.[0]) {
    throw new Error("Invalid response: no messages found");
  }

  const { message, attestation } = attestationResponse.messages[0];

  if (!message || !attestation) {
    throw new Error("Invalid response: missing message or attestation");
  }

  return { messageBytes: message, attestationSignature: attestation };
};
function _increaseGasLimit(originalGasLimit: number): number {
  const increasePercentage = 0.1;
  const increaseAmount = originalGasLimit * increasePercentage;
  const increasedGasLimit = Math.ceil(originalGasLimit + increaseAmount);
  return increasedGasLimit;
}

const executeEVMInstruction = async (params: {
  signer: ethers.Wallet;
  instruction: claimIX;
}) => {
  const { signer, instruction } = params;

  if (instruction.claimIx) {
    const txParams = instruction.claimIx;
    console.log("🚀 ~ txParams:", txParams);

    const swapTX: TransactionIX = {
      from: txParams.from,
      to: txParams.to,
      data: txParams.data,
      chainId: txParams.chainId,
      gasPrice: BigNumber.from(txParams.gasPrice).toHexString(),
      value: BigNumber.from(txParams.value).toHexString(),
    };

    const gasLimit = await signer.estimateGas(swapTX);
    const increasedGasLimit = _increaseGasLimit(Number(gasLimit));
    swapTX.gasLimit = increasedGasLimit.toString();
    const tx = await signer.sendTransaction(swapTX);
    const reciept = await tx.wait();

    return reciept!.hash as string;
  }
};

type EntryFunctionId = string;
type MoveType = string;

export type EntryFunctionPayload = {
  function: EntryFunctionId;
  type_arguments: Array<MoveType>;
  arguments: Array<any>;
};
function formatFunctionName(
  functionName: string
): `${string}::${string}::${string}` | undefined {
  const parts = functionName.split("::");
  if (parts.length === 3) {
    return functionName as `${string}::${string}::${string}`;
  }
  return undefined;
}
const executeAptosInstruction = async (params: {
  provider: Aptos;
  signer: Ed25519Account;
  instruction: transferAptosIX;
}) => {
  const { provider, signer, instruction } = params;

  if (instruction.swapPayload && instruction.bridgePayload) {
    const gasUnitPrice: number = 100;
    const maxGasPrice: number = 4000;
    const formattedFunctionName = formatFunctionName(
      instruction.swapPayload.function
    );
    const transcaction = await provider.transaction.build.simple({
      sender: sender.accountAddress.toString(),
      data: {
        function: formattedFunctionName!,
        typeArguments: instruction.swapPayload.type_arguments,
        functionArguments: instruction.swapPayload.arguments,
      },
      options: {
        gasUnitPrice: gasUnitPrice,
        maxGasAmount: maxGasPrice,
      },
    });
    const submit = await provider.signAndSubmitTransaction({
      signer: signer,
      transaction: transcaction,
    });
    const swapHash = await provider.waitForTransaction({
      transactionHash: submit.hash,
      options: { checkSuccess: true },
    });
    console.log("🚀 ~ swapHash:", swapHash.hash);
  }

  if (instruction.bridgePayload) {
    const gasUnitPrice: number = 100;
    const maxGasPrice: number = 4000;
    const formattedFunctionName = formatFunctionName(
      instruction.bridgePayload.function
    );
    const transcaction = await provider.transaction.build.simple({
      sender: sender.accountAddress.toString(),
      data: {
        function: formattedFunctionName!,
        typeArguments: instruction.bridgePayload.type_arguments,
        functionArguments: instruction.bridgePayload.arguments,
      },
      options: {
        gasUnitPrice: gasUnitPrice,
        maxGasAmount: maxGasPrice,
      },
    });
    const submit = await provider.signAndSubmitTransaction({
      signer: signer,
      transaction: transcaction,
    });
    const bridgeHash = await provider.waitForTransaction({
      transactionHash: submit.hash,
      options: { checkSuccess: true },
    });
    console.log("🚀 ~ bridgeHash:", bridgeHash.hash);
    return bridgeHash.hash;
  }
};
