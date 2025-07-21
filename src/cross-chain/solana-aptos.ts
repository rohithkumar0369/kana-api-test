import axios from "axios";
import "dotenv/config";
import {
  Account,
  Aptos,
  AptosConfig,
  Ed25519Account,
  Ed25519PrivateKey,
  Network,
  PrivateKey,
  PrivateKeyVariants,
} from "@aptos-labs/ts-sdk";
import { NetworkId } from "../constant";
import {
  clusterApiUrl,
  Connection,
  Keypair,
  PublicKey,
  VersionedTransaction,
} from "@solana/web3.js";
import bs58 from "bs58";

const config = new AptosConfig({ network: Network.MAINNET });
const aptos = new Aptos(config);

// Constants
const APTOS_PRIVATEKEY =
  "PRIVATEKEY"; // Replace with your Aptos private key
const SOLANA_PRIVATEKEY =
  "PRIVATEKEY";

const SOURCE_FROM_TOKEN_ADDRESS =
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"; //USDC
const TARGET_TO_TOKEN_ADDRESS =
  "0xbae207659db88bea0cbead6da0ed00aac12edcdda169e591cd41c94180b46f3b"; //USDC

const AMOUNT_IN = "100000"; // 0.1 USDC

const SLIPPAGE_PERCENTAGE = 1;

// Setup Signer
const solanaSigner = Keypair.fromSecretKey(bs58.decode(SOLANA_PRIVATEKEY));
const solanaProvider = new Connection(
  clusterApiUrl("mainnet-beta"),
  "confirmed"
);
const sender = Account.fromPrivateKey({
  privateKey: new Ed25519PrivateKey(
    PrivateKey.formatPrivateKey(APTOS_PRIVATEKEY, PrivateKeyVariants.Ed25519)
  ), // Aptos Privatekey
});

export const kanaswap = async () => {
  const response = await axios.get(
    "https://ag.kanalabs.io/v1/crossChainQuote",
    {
      params: {
        sourceToken: SOURCE_FROM_TOKEN_ADDRESS, //SOL
        targetToken: TARGET_TO_TOKEN_ADDRESS, //USDC
        sourceChain: NetworkId.solana, //Aptos
        targetChain: NetworkId.aptos, //Solana
        amountIn: AMOUNT_IN, // amonut
        sourceSlippage: SLIPPAGE_PERCENTAGE, // 1%
        targetSlippage: SLIPPAGE_PERCENTAGE, // 1%
      },
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": "//* YOUR API KEY *//",
      },
    }
  );

  console.log("🚀 ~ kanaswap ~ response:", response?.data.data[0]);
  const swapInstruction = await axios.post(
    "https://ag.kanalabs.io/v1/crossChainTransfer",
    {
      quote: response.data?.data[0],
      sourceAddress: solanaSigner.publicKey.toString(), // Solana Address.
      targetAddress: sender.accountAddress.toString(), // Aptos Address.
    },
    {
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": "//* YOUR API KEY *//", // Your Kana API key
      },
    }
  );

  console.log("🚀 ~ kanaswap ~ swapInstruction:", swapInstruction.data?.data);

  const swapInstructionResponce = await executeSolanaInstruction({
    provider: solanaProvider,
    signer: solanaSigner,
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
    "https://ag.kanalabs.io/v1/redeem",
    {
      sourceChainID: response.data?.data[0].sourceNetwork,
      bridgeID: response.data?.data[0].bridge,
      targetChainID: response.data?.data[0].targetNetwork,
      targetAddress: solanaSigner.publicKey.toString(), //Solana signer
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
    solanaSigner.publicKey.toString()
  );
  const claimHash = await executeAptosInstruction({
    provider: aptos,
    signer: sender as Ed25519Account,
    payload: redeem?.data.data.claimPayload as EntryFunctionPayload,
    address: sender.accountAddress.toString(),
    waitForTransaction: true,
    gasLimit: 0,
    gasUnit: 0,
  });
  console.log("🚀 ~ kanaswap ~ claimHash:", claimHash);

  console.log("🚀 ~ kanaswap ~ redeem:", redeem?.data.data.claimPayload);
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
  claimIx?: string;
}
export interface transferSolanaIX {
  transferTx?: string;
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
export const sendSolanaTransaction = async (
  provider: Connection,
  transaction: VersionedTransaction
): Promise<string> => {
  // Pre-serialize the transaction
  const serializedTx = transaction.serialize();

  // Configure retry strategy
  const RETRY_INTERVAL_MS = 5000;
  const MAX_ATTEMPTS = 15;
  const STATUS_CHECK_TIMEOUT_MS = 5000;
  const blockhash = transaction.message.recentBlockhash as string;

  let lastError: Error | null = null;
  let attempt = 0;
  let signature: string | null = null;

  // Execute retry loop
  while (attempt < MAX_ATTEMPTS) {
    attempt++;

    try {
      // If we have a signature, check if confirmed
      if (signature) {
        try {
          const status = await provider.getSignatureStatus(signature, {
            searchTransactionHistory: true,
          });

          if (
            status?.value?.confirmationStatus === "confirmed" ||
            status?.value?.confirmationStatus === "finalized"
          ) {
            return signature;
          }
        } catch (statusError) {
          signature = null;
        }
      }

      // Send new transaction if needed
      if (!signature || (attempt > 3 && (attempt - 4) % 3 === 0)) {
        if (attempt > 1) {
          await new Promise((resolve) =>
            setTimeout(resolve, RETRY_INTERVAL_MS)
          );
        }

        signature = await provider.sendRawTransaction(serializedTx, {
          maxRetries: 3,
          preflightCommitment: "confirmed",
          skipPreflight: true,
        });

        try {
          await Promise.race([
            provider.confirmTransaction(
              { signature, blockhash, lastValidBlockHeight: 0 },
              "confirmed"
            ),
            new Promise((_, reject) =>
              setTimeout(
                () => reject(new Error("Timeout")),
                STATUS_CHECK_TIMEOUT_MS
              )
            ),
          ]);
          return signature;
        } catch (confirmError) {
          // Continue to next iteration
        }
      } else {
        await new Promise((resolve) => setTimeout(resolve, RETRY_INTERVAL_MS));
      }
    } catch (error: any) {
      lastError = error as Error;

      if (error.message.includes("0x1771")) {
        throw new Error("Slippage: Out Amount less than the slippage amount");
      }

      signature = null;
    }
  }
  if (signature) {
    return signature;
  }
  throw (
    lastError ||
    new Error(`Failed to send transaction after ${MAX_ATTEMPTS} attempts`)
  );
};
const executeSolanaInstruction = async (params: {
  provider: Connection;
  signer: Keypair;
  instruction: transferSolanaIX;
}) => {
  const { provider, signer, instruction } = params;
  const decodedTransaction = Buffer.from(instruction.transferTx!, "base64");
  const transaction = VersionedTransaction.deserialize(decodedTransaction);
  transaction.message.recentBlockhash = (
    await provider.getLatestBlockhash("confirmed")
  ).blockhash;
  transaction.sign([signer]);
  const submittedTransaction = await sendSolanaTransaction(
    provider,
    transaction
  );
  console.log(`Submitted transaction hash: ${submittedTransaction}`);
  return submittedTransaction;
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
  payload: EntryFunctionPayload;
  address: string;
  waitForTransaction?: boolean;
  gasLimit?: number;
  gasUnit?: number;
  isGoogleWallet?: boolean;
}) => {
  const {
    provider,
    signer,
    payload,
    address,
    waitForTransaction,
    gasLimit,
    gasUnit,
  } = params;
  console.log("🚀 ~ params:", params);
  const gasUnitPrice: number = gasUnit ? gasUnit : 100;
  const maxGasPrice: number = gasLimit ? gasLimit : 4000;
  const formattedFunctionName = formatFunctionName(payload.function);
  const transcaction = await provider.transaction.build.simple({
    sender: address,
    data: {
      function: formattedFunctionName!,
      typeArguments: payload.type_arguments,
      functionArguments: payload.arguments,
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
  if (waitForTransaction) {
    await provider.waitForTransaction({
      transactionHash: submit.hash,
      options: { checkSuccess: true },
    });
  }
  return submit.hash;
};
