import { ethers } from "ethers";
import { CONTRACT_ABI, sepoliaContractAddress } from "./config.js";
import fs from 'fs';
import path from 'path';

const sepoliaProvider = new ethers.InfuraWebSocketProvider("sepolia", "070c174a2442432a803e427d142d79c1");
const walletPrivateKey = '3e4bd3d08cb2be37cf995e177ba2c436ec75d6b2a68fde73a800cc306bc7cafa';
const wallet = new ethers.Wallet(walletPrivateKey, sepoliaProvider);

// const sepoliaContractAddress = '0x8e36A56dB311222927b3aa8BEB5C3c8861320FEE';
const sepoliaContract = new ethers.Contract(sepoliaContractAddress, CONTRACT_ABI, wallet);

const nonce = await sepoliaProvider.getTransactionCount("0x6d81571895F2783715C23a64D53E807a581f750D");
console.log(nonce);

let startBlock = readLastState().lastBlock;

const maxRetries = 100;
const baseDelay = 1000;



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


async function startEventListener() {

    let retries = 0;

    while (retries <= maxRetries) {

        try {
                sepoliaContract.on('Ping', async (event) => {
                console.log(`Ping event from block: ${event.log.blockNumber}`);
                await sendPong(event.log.transactionHash, event.log.blockNumber);
            });
            console.log("Event listener initialized successfully.");
            break;
        } catch (error) {
            if (error.code === 'ETIMEDOUT' || error.code === 'ECONNRESET' || error.message.includes('rate limit')) {
                console.log(`Rate limited or network error, retrying... Attempt ${retries + 1}`);
                await exponentialBackoff(baseDelay, retries);
                retries++;
            } else {
                console.error(`Failed to initialize event listener: ${error.message}`);
                return;
            }
        }

    }

    if (retries > maxRetries) {
        console.error(`Failed to initialize event listener after ${maxRetries} retries.`);
    }
}


async function sendPong(pingHash, blockNumber) {

    let retries = 0;

    if (blockNumber <= startBlock) {
        console.log(`Skipping already processed block: ${blockNumber}`);
        return;
    }
    startBlock = blockNumber;

    while (retries <= maxRetries) {
        try {
            const nonce = await sepoliaProvider.getTransactionCount("0x6d81571895F2783715C23a64D53E807a581f750D");
            const gasPrice = await sepoliaProvider.getFeeData();
            const tx = await sepoliaContract.pong(pingHash, { gasPrice: gasPrice.maxFeePerGas, nonce: nonce});
            console.log(`Sent Pong transaction with Pong txHash: ${tx.hash}`, `Ping txHash ${pingHash}`, `PingBlock: ${startBlock}`);
            updateLastState(blockNumber, nonce + 1);
            console.log(tx);
        } catch (error) {
            if (error.code === 'ETIMEDOUT' || error.code === 'ECONNRESET' || error.message.includes('rate limit')) {
                console.log(`Rate limited or network error, retrying... Attempt ${retries + 1}`);
                await exponentialBackoff(baseDelay, retries);
                retries++;
            } else {
                console.error(`Failed to send pong for block ${blockNumber}: ${error.message}`);
                return;
            }
        }
    }

    // try {
        // const nonce = await sepoliaProvider.getTransactionCount("0x7A009cF93A68533bf15347a9C6637C229c6d25BA");
        // const gasPrice = await sepoliaProvider.getFeeData();
        // const tx = await sepoliaContract.pong(pingHash, { gasPrice: gasPrice.maxFeePerGas, nonce: nonce});
        // console.log(`Sent Pong transaction with Pong txHash: ${tx.hash}`, `Ping txHash ${pingHash}`, `PingBlock: ${startBlock}`);
        // updateLastState(blockNumber, nonce);
        // console.log(tx);
    // } catch (error) {
    //     console.error(`Failed to send Pong for block ${blockNumber}: ${error.message}`);
    // }
    console.log(startBlock);
}

async function exponentialBackoff(baseDelay, retries) {
    const delay = baseDelay * (2 ** retries);
    await new Promise(resolve => setTimeout(resolve, delay));
}

startEventListener();