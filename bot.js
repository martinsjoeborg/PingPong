import { ethers } from "ethers";
import { CONTRACT_ABI, sepoliaContractAddress } from "./config.js";
import fs from 'fs';
import path from 'path';

const sepoliaProvider = new ethers.InfuraWebSocketProvider("sepolia", "070c174a2442432a803e427d142d79c1");
const walletPrivateKey = '2a32f63779c8684b17ea60d0d5979afef3741b8de323e96ac9596458f18bd26f';
const wallet = new ethers.Wallet(walletPrivateKey, sepoliaProvider);

const sepoliaContract = new ethers.Contract(sepoliaContractAddress, CONTRACT_ABI, wallet);

const nonce = await sepoliaProvider.getTransactionCount("0x5630Ab31526601e11d663cd623e202CaBB5B3f2f");
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
            const nonce = await sepoliaProvider.getTransactionCount("0x5630Ab31526601e11d663cd623e202CaBB5B3f2f");
            // const newNonce = nonce + 1;
            const gasPrice = await sepoliaProvider.getFeeData();
            const tx = await sepoliaContract.pong(pingHash, { gasPrice: gasPrice.maxFeePerGas, nonce: nonce});
            console.log(`Sent Pong transaction with Pong txHash: ${tx.hash}`, `Ping txHash ${pingHash}`, `PingBlock: ${startBlock}`);
            updateLastState(blockNumber, nonce + 1);
            console.log(tx);
            break;
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
    console.log(startBlock);
}

async function exponentialBackoff(baseDelay, retries) {
    const delay = baseDelay * (2 ** retries);
    await new Promise(resolve => setTimeout(resolve, delay));
}

startEventListener();