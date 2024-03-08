import { ethers } from "ethers";
import { CONTRACT_ABI } from "./config.js";
import fs from 'fs';
import path from 'path';

const sepoliaProvider = new ethers.InfuraWebSocketProvider("sepolia", "070c174a2442432a803e427d142d79c1");
const walletPrivateKey = '1cf4b1702f07d9090ab6c165f90564f3a4d516ddc0193740e19d846f9f59bf20';
const wallet = new ethers.Wallet(walletPrivateKey, sepoliaProvider);

const sepoliaContractAddress = '0x8e36A56dB311222927b3aa8BEB5C3c8861320FEE';
const sepoliaContract = new ethers.Contract(sepoliaContractAddress, CONTRACT_ABI, wallet);

const nonce = await sepoliaProvider.getTransactionCount("0x7A009cF93A68533bf15347a9C6637C229c6d25BA");
console.log(nonce);

let startBlock = readLastState().lastBlock;

function readLastState() {
    const filePath = path.join("./", 'lastState.json');
    if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data);
    }
    return { lastBlock: 0, nonce: 0 };
}

function updateLastState(blockNumber, nonce) {
    const filePath = path.join("./", 'lastState.json');
    const data = JSON.stringify({ lastBlock: blockNumber, nonce: nonce });
    fs.writeFileSync(filePath, data, 'utf8');
}

sepoliaContract.on('Ping', async (event) => {
    console.log(`Ping event from block: ${event.log.blockNumber}`);
    await sendPong(event.log.transactionHash, event.log.blockNumber);
});

async function sendPong(pingHash, blockNumber) {
    if (blockNumber <= startBlock) {
        console.log(`Skipping already processed block: ${blockNumber}`);
        return;
    }
    startBlock = blockNumber;

    try {
        const nonce = await sepoliaProvider.getTransactionCount("0x7A009cF93A68533bf15347a9C6637C229c6d25BA");
        const gasPrice = await sepoliaProvider.getFeeData();
        const tx = await sepoliaContract.pong(pingHash, { gasPrice: gasPrice.maxFeePerGas, nonce: nonce});
        console.log(`Sent Pong transaction with Pong txHash: ${tx.hash}`, `Ping txHash ${pingHash}`, `PingBlock: ${startBlock}`);
        updateLastState(blockNumber, nonce);
        console.log(tx);
    } catch (error) {
        console.error(`Failed to send Pong for block ${blockNumber}: ${error.message}`);
    }
    console.log(startBlock);
}

