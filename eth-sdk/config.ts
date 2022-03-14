import * as dotenv from "dotenv";
dotenv.config();
import { defineConfig } from "@dethcrypto/eth-sdk";

export default defineConfig({
    contracts: {
        polygon: {
            exchangeIssuanceLeveraged:
                "0x783f299588Ae89E9f44B230D6cd8E349FD01b16e",
            aaveLeverageModule: "0xB7F72e15239197021480EB720E1495861A1ABdce",
            tokens: {
                eth2xFli: "0x3Ad707dA309f3845cd602059901E39C4dcd66473",
                iEthFli: "0x4f025829C4B13dF652f38Abd2AB901185fF1e609",
                weth: "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619",
                usdc: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
                matic2xFli: "0xf287D97B6345bad3D88856b26Fb7c0ab3F2C7976",
                iMaticFli: "0x340f412860dA7b7823df372a2b59Ff78b7ae6abc",
                btc2xFli: "0xd6ca869a4ec9ed2c7e618062cdc45306d8dbbc14",
                iBtcFli: "0x130cE4E4F76c2265f94a961D70618562de0bb8d2",
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
