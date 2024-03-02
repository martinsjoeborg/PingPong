import { ethers } from "ethers";

import { CONTRACT_ABI } from "./config.js";

const sepoliaProvider = new ethers.JsonRpcProvider('https://sepolia.infura.io/v3/070c174a2442432a803e427d142d79c1');
const walletPrivateKey = 'fb738bc6491b81da284be3676bf5e914ee0fca27d0a0ffb26fee2bcac00ea0e6';
const wallet = new ethers.Wallet(walletPrivateKey, sepoliaProvider);

const sepoliaContractAddress = '0x68857672427c6F823F1f5e4D17ae4E149AB23018';
const sepoliaContract = new ethers.Contract(sepoliaContractAddress, CONTRACT_ABI, wallet);


let startBlock = 5388354;

sepoliaContract.on('Ping', async (event) => {
    console.log(`Received Ping event from block: ${event.log.blockNumber}`);
    await sendPong(event.log.transactionHash, event.log.blockNumber);
});

async function sendPong(pingHash, blockNumber) {
    if (blockNumber <= startBlock) {
        console.log(`Skipping already processed block: ${blockNumber}`);
        return;
    }
    startBlock = blockNumber;

    try {
        const tx = await sepoliaContract.pong(pingHash, { gasLimit: 2100000 });
        console.log(`Sent Pong transaction: ${tx.hash}`, `StartBlock: ${startBlock}`);
    } catch (error) {
        console.error(`Failed to send Pong for block ${blockNumber}: ${error.message}`);
    }
    console.log(startBlock);
}

console.log(startBlock);
