// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import { ethers, network } from "hardhat";
import { getPolygonSdk } from '@dethcrypto/eth-sdk-client'

async function main() {
    const signers = await ethers.getSigners();
    const defaultSigner = signers[0];

    const polygonSdk = getPolygonSdk(defaultSigner)
    console.log("UniV3Router", await polygonSdk.exchangeIssuanceLeveraged.uniV3Router())
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
