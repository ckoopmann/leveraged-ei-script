import * as dotenv from "dotenv";

import { HardhatUserConfig } from "hardhat/config";
import "@typechain/hardhat";
import "@nomiclabs/hardhat-ethers";

dotenv.config();

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more
//
const polygonConfig = {
    url: process.env.POLYGON_URL || "",
    accounts:
        process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
};

const config: HardhatUserConfig = {
    solidity: "0.8.4",
    networks: {
        hardhat: {
            forking: polygonConfig,
        },
        polygon: polygonConfig,
    },
};

export default config;
