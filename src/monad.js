const { ethers } = require('ethers');
const axios = require('axios');

const wallet = new ethers.Wallet('0x098a5a5ef970dc30a42f8c2e542a760ecd567218bdb3f6135df07d5edbfa24e6', new ethers.JsonRpcProvider('https://testnet-rpc.monad.xyz'));

const PAIRS = [
  {from: '0x760afe86e5de5fa0ee542fc7b7b713e1c5425701', to: '0xB5a30b0FDc5EA94A52fDc42e3E9760Cb8449Fb37', amount: '100000', name: 'WMON → WETH'},
  {from: '0xB5a30b0FDc5EA94A52fDc42e3E9760Cb8449Fb37', to: '0x760afe86e5de5fa0ee542fc7b7b713e1c5425701', amount: '10000', name: 'WETH → WMON'},
  {from: '0x0000000000000000000000000000000000000000', to: '0xB5a30b0FDc5EA94A52fDc42e3E9760Cb8449Fb37', amount: '1000000000000000', name: 'MON → WETH'},
];

async function swap(from, to, amount, name) {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`Testing: ${name}`);
  console.log('='.repeat(50));
  
  console.log('📊 Getting quote...');
  console.log(`  From: ${from}`);
  console.log(`  To: ${to}`);
  console.log(`  Amount: ${amount}`);
  
  const quote = await axios.get('http://localhost:3000/v1/swapQuote', {
    params: {inputToken: from, outputToken: to, amountIn: amount, chain: '13'}
  });
  
  if (!quote.data.data?.[0]) {
    console.log('❌ No quote');
    return;
  }
  
  console.log('✅ Quote:', ethers.formatEther(quote.data.data[0].amountOut), 'WETH');
  
  console.log('\n🔧 Getting instruction...');
  const instruction = await axios.post('http://localhost:3000/v1/swapInstruction', {
    quote: quote.data.data[0],
    address: wallet.address
  });
  
  const {approveIX, swapIX} = instruction.data.data;
  
  if (approveIX) {
    console.log('🔓 Approving...');
    await (await wallet.sendTransaction({to: approveIX.to, data: approveIX.data, gasLimit: 200000})).wait();
    console.log('✅ Approved');
  }
  
  console.log('\n💱 Swapping...');
  const tx = await wallet.sendTransaction({to: swapIX.to, data: swapIX.data, value: swapIX.value || '0', gasLimit: 1000000});
  console.log('📤 TX:', tx.hash);
  
  const receipt = await tx.wait();
  console.log(receipt.status === 1 ? '✅ Success' : '❌ Failed');
}

async function testAllPairs() {
  for (const pair of PAIRS) {
    try {
      await swap(pair.from, pair.to, pair.amount, pair.name);
    } catch (e) {
      console.log('❌', e.message);
    }
  }
  console.log('\n✅ All tests completed');
}

testAllPairs().catch(console.error);
