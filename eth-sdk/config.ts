import * as dotenv from "dotenv";
dotenv.config();
import { defineConfig } from "@dethcrypto/eth-sdk";

export default defineConfig({
    contracts: {
        polygon: {
            exchangeIssuanceLeveraged:
                "0x600d9950c6ecAef98Cc42fa207E92397A6c43416",
        },
    },
    etherscanKey: process.env.POLYGONSCAN_API_KEY,
    rpc: {
        polygon: process.env.POLYGON_URL
    }
});
