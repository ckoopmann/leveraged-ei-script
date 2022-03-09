import * as dotenv from "dotenv";
dotenv.config();
import { defineConfig } from "@dethcrypto/eth-sdk";

export default defineConfig({
    contracts: {
        polygon: {
            exchangeIssuanceLeveraged:
                "0x600d9950c6ecAef98Cc42fa207E92397A6c43416",
            tokens: {
                weth: "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619",
                usdc: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
            },
            uniswap: {
                v3: {
                    pool: "0x45dDa9cb7c25131DF268515131f647d726f50608",
                },
            },
        },
    },
    etherscanKey: process.env.POLYGONSCAN_API_KEY,
    rpc: {
        polygon: process.env.POLYGON_URL,
    },
});
