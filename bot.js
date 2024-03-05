import { ethers } from "ethers";
import { CONTRACT_ABI } from "./config.js";
import fs from 'fs';
import path from 'path';

const sepoliaProvider = new ethers.JsonRpcProvider('https://sepolia.infura.io/v3/070c174a2442432a803e427d142d79c1');
const walletPrivateKey = '63240b8b01f2a12eb06aa0f92299c5482ca73ac15761657881155ea9489022ed';
const wallet = new ethers.Wallet(walletPrivateKey, sepoliaProvider);

const sepoliaContractAddress = '0x3481E00b8C053D2402B8ac4FBD0B73164Cf04b63';
const sepoliaContract = new ethers.Contract(sepoliaContractAddress, CONTRACT_ABI, wallet);

const nonce = await sepoliaProvider.getTransactionCount("0xbcAAd13349E231A21A0c4fd75746Cf8828B50206");
// console.log(nonce);

let startBlock = readLastState().lastBlock;

function readLastState() {
    const filePath = path.join("./", 'lastState.json');
    if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data);
    }
    return { lastBlock: 0, nonce: 0 };
}
// console.log(readLastState().nonce);

function updateLastState(blockNumber, nonce) {
    const filePath = path.join("./", 'lastState.json');
    const data = JSON.stringify({ lastBlock: blockNumber, nonce: nonce });
    fs.writeFileSync(filePath, data, 'utf8');
}

sepoliaContract.on('Ping', async (event) => {
    console.log(`Ping event from block: ${event.log.blockNumber}`);
    await sendPong(event.log.transactionHash, event.log.blockNumber);
    // console.log(event.log.transactionHash);
});

async function sendPong(pingHash, blockNumber) {
    if (blockNumber <= startBlock) {
        console.log(`Skipping already processed block: ${blockNumber}`);
        return;
    }
    startBlock = blockNumber;

    try {
        const nonce = readLastState().nonce;
        const tx = await sepoliaContract.pong(pingHash, { gasLimit: 2100000 });
        console.log(`Sent Pong transaction with Pong txHash: ${tx.hash}`, `Ping txHash ${pingHash}`, `PingBlock: ${startBlock}`);
        updateLastState(blockNumber, nonce + 1);
        console.log(tx);
    } catch (error) {
        console.error(`Failed to send Pong for block ${blockNumber}: ${error.message}`);
    }
    console.log(startBlock);
}

