import { Aptos, AptosConfig, Network } from "@aptos-labs/ts-sdk";
import { clusterApiUrl, Connection } from "@solana/web3.js";
import { ethers } from "ethers";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

export const Providers = () => {
  const getEthersProvider = (url: string) => new ethers.JsonRpcProvider(url);

  return {
    APTOSPROVIDER: new Aptos(new AptosConfig({ network: Network.MAINNET })),
    SOLANAPROVIDER: new Connection(clusterApiUrl("mainnet-beta"), "confirmed"),
    POLYGONPROVIDER: getEthersProvider(requireEnv("POLYGON_RPC")),
    BSCPROVIDER: getEthersProvider(requireEnv("BSC_RPC")),
    ETHPROVIDER: getEthersProvider(requireEnv("ETHEREUM_RPC")),
    ARBITRUMPROVIDER: getEthersProvider(requireEnv("ARBITRUM_RPC")),
    AVALANCHEPROVIDER: getEthersProvider(requireEnv("AVALANCHE_RPC")),
    BASEPROVIDER: getEthersProvider(requireEnv("BASE_RPC")),
    ZKSYNCPROVIDER: getEthersProvider(requireEnv("ZKSYNC_RPC")),
  };
};