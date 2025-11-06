const { ethers } = require("ethers");
const axios = require("axios");

const MONAD_RPC = "https://testnet-rpc.monad.xyz";
const PRIVATE_KEY =
  "0x098a5a5ef970dc30a42f8c2e542a760ecd567218bdb3f6135df07d5edbfa24e6";



const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
];

async function testNativeToTokenSwap() {
  const provider = new ethers.JsonRpcProvider(MONAD_RPC);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

  console.log("Testing Swap");
  console.log(`Wallet Address: ${wallet.address}`);

  const integratorAddress = "0x1234567890123456789012345678901234567890";
  const swapAmount = "100000"; // 0.1 WMON
  const fromToken = '0x760afe86e5de5fa0ee542fc7b7b713e1c5425701'; 
  const toToken = "0xB5a30b0FDc5EA94A52fDc42e3E9760Cb8449Fb37";
 
  const monBalanceBefore = await provider.getBalance(wallet.address);
  console.log(`\n📊 Initial Balances:`);
  console.log(`  MON (native): ${ethers.formatEther(monBalanceBefore)}`);
  
  const wmonContract = new ethers.Contract(fromToken, ERC20_ABI, provider);
  const wmonBalanceBefore = await wmonContract.balanceOf(wallet.address);
  
  const toTokenContract = new ethers.Contract(toToken, ERC20_ABI, provider);
  const toTokenBalanceBefore = await toTokenContract.balanceOf(wallet.address);
  console.log(`  WETH: ${ethers.formatEther(toTokenBalanceBefore)}`);
  
  // Fee wallet addresses
  const KANA_FEE_ADDRESS = "0x3CEF5594D565D904fF1407f687b2039Eb62d23D9";
  const kanaFeeBalanceBefore = await toTokenContract.balanceOf(KANA_FEE_ADDRESS);
  const integratorFeeBalanceBefore = await toTokenContract.balanceOf(integratorAddress);
  
  console.log(`\n💰 Fee Wallet Balances (Before):`);
  console.log(`  Kana Fee Wallet: ${ethers.formatEther(kanaFeeBalanceBefore)} WETH`);
  console.log(`  Integrator Wallet: ${ethers.formatEther(integratorFeeBalanceBefore)} WETH`);

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

    console.log('API Response:', JSON.stringify(quoteRes.data, null, 2));

    quoteData = quoteRes.data.data?.[0] || quoteRes.data;
    if (!quoteData || !quoteData.amountOut) {
      console.log('\n❌ No routes found. This token pair may not have liquidity.');
      console.log('Try using a different token pair with known liquidity.');
      throw new Error("No valid quote data received from API");
    }

    console.log("✅ Quote received");
    console.log(`\n📊 Quote Details:`);
    console.log(`  Amount Out: ${ethers.formatEther(quoteData.amountOut)} WETH`);
    console.log(`  Kana Fee: ${quoteData.kanaFee ? ethers.formatEther(quoteData.kanaFee) : '0'} WETH`);
    console.log(`  Integrator Fee: ${quoteData.integratorFee ? ethers.formatEther(quoteData.integratorFee) : '0'} WETH`);
    console.log(`  Final Amount Out: ${quoteData.finalAmountOut ? ethers.formatEther(quoteData.finalAmountOut) : ethers.formatEther(quoteData.amountOut)} WETH`);
  } catch (err) {
    console.error(
      " Quote fetching failed:",
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

    console.log("\nSwap instruction received:");
    console.log(`  Target Contract: ${swapIX.to}`);
    console.log(`  Value: ${swapIX.value || "0"}`);
    console.log(`  Data: ${swapIX.data ? swapIX.data.substring(0, 66) + '...' : 'EMPTY/MISSING'}`);
    console.log(`  Data Length: ${swapIX.data?.length || 0} bytes`);
  } catch (err) {
    console.error(
      " Swap instruction failed:",
      err.response?.data || err.message
    );
    return;
  }

  // Step 3: Execute approval
  if (approveIX) {
    console.log("\nExecuting approval...");
    const approveTx = await wallet.sendTransaction({
      to: approveIX.to,
      data: approveIX.data,
      value: "0",
      gasLimit: 100000,
    });
    console.log(`  TX: ${approveTx.hash}`);
    await approveTx.wait();
    console.log("  Approved");
  }

  // Step 4: Execute swap
  console.log("\n💱 Step 4: Executing swap...");
  try {
    console.log("Transaction details:");
    console.log(`  To: ${swapIX.to}`);
    console.log(`  Value: ${swapIX.value}`);
    const swapTx = await wallet.sendTransaction({
      to: swapIX.to,
      data: swapIX.data,
      value: swapIX.value || "0",
      gasLimit: 500000,
    });

    console.log(`\nTransaction sent: ${swapTx.hash}`);
    console.log(" Waiting for confirmation...");

    const receipt = await swapTx.wait();

    if (receipt.status === 0) {
      throw new Error("Transaction reverted");
    }

    console.log(` Swap completed in block ${receipt.blockNumber}`);
    console.log(`   Gas used: ${receipt.gasUsed.toString()}`);
  } catch (err) {
    console.error(" Swap execution failed:", err.message);
    if (err.data) {
      console.error("Error data:", err.data);
    }
    return;
  }

  // Step 5: Verify balances
  console.log("\n📊 Final Balances:");
  const monBalanceAfter = await provider.getBalance(wallet.address);
  const wmonBalanceAfter = await wmonContract.balanceOf(wallet.address);
  const toTokenBalanceAfter = await toTokenContract.balanceOf(wallet.address);
  const kanaFeeBalanceAfter = await toTokenContract.balanceOf(KANA_FEE_ADDRESS);
  const integratorFeeBalanceAfter = await toTokenContract.balanceOf(integratorAddress);

  console.log(`  MON (native): ${ethers.formatEther(monBalanceAfter)}`);
  console.log(`  WMON: ${ethers.formatEther(wmonBalanceAfter)}`);
  console.log(`  WETH: ${ethers.formatEther(toTokenBalanceAfter)}`);
  
  console.log(`\n💰 Fee Wallet Balances (After):`);
  console.log(`  Kana Fee Wallet: ${ethers.formatEther(kanaFeeBalanceAfter)} WETH`);
  console.log(`  Integrator Wallet: ${ethers.formatEther(integratorFeeBalanceAfter)} WETH`);

  const wmonSpent = wmonBalanceBefore - wmonBalanceAfter;
  const wethReceived = toTokenBalanceAfter - toTokenBalanceBefore;
  const kanaFeeCollected = kanaFeeBalanceAfter - kanaFeeBalanceBefore;
  const integratorFeeCollected = integratorFeeBalanceAfter - integratorFeeBalanceBefore;

  console.log("\n📈 Changes:");
  console.log(`  WMON spent: ${ethers.formatEther(wmonSpent)}`);
  console.log(`  WETH received: ${ethers.formatEther(wethReceived)}`);
  console.log(`  Kana Fee collected: ${ethers.formatEther(kanaFeeCollected)} WETH`);
  console.log(`  Integrator Fee collected: ${ethers.formatEther(integratorFeeCollected)} WETH`);

  console.log("\n🔍 FEE VERIFICATION:");
  if (kanaFeeCollected > 0n) {
    console.log(`  ✅ Kana fee DEDUCTED and sent to ${KANA_FEE_ADDRESS}`);
    console.log(`     Amount: ${ethers.formatEther(kanaFeeCollected)} WETH`);
  } else {
    console.log(`  ❌ Kana fee NOT deducted - no fees sent to Kana wallet`);
  }
  
  if (integratorFeeCollected > 0n) {
    console.log(`  ✅ Integrator fee DEDUCTED and sent to ${integratorAddress}`);
    console.log(`     Amount: ${ethers.formatEther(integratorFeeCollected)} WETH`);
  } else {
    console.log(`  ❌ Integrator fee NOT deducted - no fees sent to integrator wallet`);
  }

  if (wmonSpent > 0n && wethReceived > 0n) {
    console.log("\n✅ Swap successful!");
    console.log(`  Exchange rate: ${(Number(wethReceived) / Number(wmonSpent)).toFixed(6)} WETH per WMON`);
    
    if (kanaFeeCollected === 0n && integratorFeeCollected === 0n) {
      console.log(`\n⚠️  WARNING: No fees were deducted!`);
      console.log(`  The smart contract is not configured to collect fees.`);
      console.log(`  Backend calculates fees correctly, but Diamond contract doesn't apply them.`);
    }
  } else {
    console.log("\n❌ Swap failed - no tokens exchanged");  }
}

if (require.main === module) {
  testNativeToTokenSwap().catch(console.error);
}

module.exports = { testNativeToTokenSwap };