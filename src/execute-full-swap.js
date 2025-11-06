const { ethers } = require("ethers");
const axios = require("axios");

const MONAD_RPC = "https://testnet-rpc.monad.xyz";
const PRIVATE_KEY =
  "0x098a5a5ef970dc30a42f8c2e542a760ecd567218bdb3f6135df07d5edbfa24e6";

const WMON_ADDRESS = "0x760AfE86e5de5fa0Ee542fc7B7B713e1c5425701";

const TARGET_TOKEN_ADDRESS = "0x760AfE86e5de5fa0Ee542fc7B7B713e1c5425701"; // TCHOG token

const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
];

async function testNativeToTokenSwap() {
  const provider = new ethers.JsonRpcProvider(MONAD_RPC);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

  console.log("🧪 Testing WMON → Native MON Swap");
  console.log("=".repeat(50));
  console.log(`Wallet Address: ${wallet.address}`);

  const integratorAddress = "0x1234567890123456789012345678901234567890";
  const swapAmount = "100000"; // 0.1 WMON
  const fromToken = WMON_ADDRESS; // WMON
  const toToken = "0xf817257fed379853cDe0fa4F97AB987181B1E5Ea"; // Native MON
  // Check initial balances
  const monBalanceBefore = await provider.getBalance(wallet.address);
  console.log(`\n📊 Initial Balances:`);
  console.log(`  MON (native): ${ethers.formatEther(monBalanceBefore)}`);

  const wmonContract = new ethers.Contract(WMON_ADDRESS, ERC20_ABI, provider);
  const wmonBalanceBefore = await wmonContract.balanceOf(wallet.address);
  console.log(`  WMON: ${ethers.formatEther(wmonBalanceBefore)}`);

  // Step 1: Fetch swap quote
  console.log("\n🔍 Step 1: Fetching swap quote...");
  console.log(`Request params:`);
  console.log(`  From: ${fromToken}`);
  console.log(`  To: ${toToken}`);
  console.log(`  Amount: ${swapAmount}`);

  let quoteData;
  try {
    const quoteParams = {
      inputToken: fromToken,
      outputToken: toToken,
      amountIn: swapAmount,
      integrator: integratorAddress,
      integratorFeePercentage: "0.3",
      chain: "13", // Monad chain ID
      slippage: "5.0",
    };

    const quoteRes = await axios.get("http://localhost:3000/v1/swapQuote", {
      params: quoteParams,
      timeout: 15000,
    });

    quoteData = quoteRes.data.data?.[0] || quoteRes.data;
    if (!quoteData || !quoteData.amountOut) {
      throw new Error("No valid quote data received from API");
    }

    console.log("✅ Quote received");
  } catch (err) {
    console.error(
      "❌ Quote fetching failed:",
      err.response?.data || err.message
    );
    return;
  }

  // Step 2: Fetch swap instruction
  console.log("\n🔧 Step 2: Fetching swap instruction...");
  let swapIX;
  let approveIX;
  try {
    const instructionRes = await axios.post(
      "http://localhost:3000/v1/swapInstruction",
      {
        quote: quoteData,
        address: wallet.address,
        integrator: integratorAddress,
      },
      { timeout: 15000 }
    );

    const data = instructionRes.data.data || instructionRes.data;
    approveIX = data.approveIX;
    swapIX = data.swapIX;

    if (!swapIX) {
      throw new Error("swapIX not returned by API");
    }

    console.log("✅ Swap instruction received:");
    console.log(`  Target Contract: ${swapIX.to}`);
    console.log(`  Value (MON): ${ethers.formatEther(swapIX.value || "0")}`);
    console.log(`  Estimated Gas: ${swapIX.gasLimit || "Not specified"}`);
  } catch (err) {
    console.error(
      "❌ Swap instruction failed:",
      err.response?.data || err.message
    );
    return;
  }

  // Step 3: Execute approval
  if (approveIX) {
    console.log("\n🔓 Executing approval...");
    const approveTx = await wallet.sendTransaction({
      to: approveIX.to,
      data: approveIX.data,
      value: "0",
      gasLimit: 100000,
    });
    console.log(`  TX: ${approveTx.hash}`);
    await approveTx.wait();
    console.log("  ✅ Approved");
  }

  // Step 4: Execute swap
  console.log("\n💱 Step 3: Executing swap...");
  try {
    console.log("Transaction details:");
    console.log(`  To: ${swapIX.to}`);
    console.log(`  Value: ${swapIX.value}`);
    console.log(`  Data length: ${swapIX.data?.length || 0} bytes`);

    const swapTx = await wallet.sendTransaction({
      to: swapIX.to,
      data: swapIX.data,
      value: swapIX.value || "0",
      gasLimit: 500000,
    });

    console.log(`\n📤 Transaction sent: ${swapTx.hash}`);
    console.log("⏳ Waiting for confirmation...");

    const receipt = await swapTx.wait();

    if (receipt.status === 0) {
      throw new Error("Transaction reverted");
    }

    console.log(`✅ Swap completed in block ${receipt.blockNumber}`);
    console.log(`   Gas used: ${receipt.gasUsed.toString()}`);
  } catch (err) {
    console.error("❌ Swap execution failed:", err.message);
    if (err.data) {
      console.error("Error data:", err.data);
    }
    return;
  }

  // Step 5: Verify balances
  console.log("\n📊 Final Balances:");
  const monBalanceAfter = await provider.getBalance(wallet.address);
  const wmonBalanceAfter = await wmonContract.balanceOf(wallet.address);

  console.log(`  MON (native): ${ethers.formatEther(monBalanceAfter)}`);
  console.log(`  WMON: ${ethers.formatEther(wmonBalanceAfter)}`);

  const monReceived = monBalanceAfter - monBalanceBefore;
  const wmonSpent = wmonBalanceBefore - wmonBalanceAfter;

  console.log("\n📈 Changes:");
  console.log(`  WMON spent: ${ethers.formatEther(wmonSpent)}`);
  console.log(`  MON received: ${ethers.formatEther(monReceived)} (minus gas)`);

  if (wmonSpent > 0n) {
    console.log("\n✅ Swap successful!");
  } else {
    console.log("\n⚠️  Warning: No WMON spent");
  }
}

if (require.main === module) {
  testNativeToTokenSwap().catch(console.error);
}

module.exports = { testNativeToTokenSwap };
