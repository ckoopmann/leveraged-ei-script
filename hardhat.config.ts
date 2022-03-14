import * as dotenv from "dotenv";

import { HardhatUserConfig } from "hardhat/config";
import "@typechain/hardhat";
import "@nomiclabs/hardhat-ethers";

dotenv.config();

const TIMEOUT = 5 * 60 * 1000;
const polygonConfig = {
    url: process.env.POLYGON_URL || "",
    timeout: TIMEOUT,
    accounts:
        process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
};

const config: HardhatUserConfig = {
    solidity: "0.8.4",
    networks: {
        localhost: {
            timeout: TIMEOUT,
        },
        hardhat: {
            forking: polygonConfig,
        },
        polygon: polygonConfig,
    },
};

export default config;
