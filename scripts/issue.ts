// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import { ethers, network } from "hardhat";
import { getPolygonSdk } from "@dethcrypto/eth-sdk-client";
import { AlphaRouter } from "@uniswap/smart-order-router";
import { Token, CurrencyAmount, Percent, TradeType } from "@uniswap/sdk-core";
import { Wallet, Signer } from "ethers";
import JSBI from "jsbi";

async function main() {
    const signers = await ethers.getSigners();
    const signer = signers[0];

    if (signer == null) {
        throw new Error(
            "Signer undefined, remember to set private key when running against mainnet"
        );
    }
    console.log("Signer: ", signer.address);
    const chainId = 137;

    const routerConfig = {
        chainId,
        provider: ethers.provider,
    };

    const polygonSdk = getPolygonSdk(signer);
    console.log(
        "UniV3Router",
        await polygonSdk.exchangeIssuanceLeveraged.uniV3Router()
    );

    const router = new AlphaRouter(routerConfig);

    const weth = new Token(
        chainId,
        polygonSdk.tokens.weth.address,
        18,
        "weth",
        "wrapped ether"
    );
    const usdc = new Token(
        chainId,
        polygonSdk.tokens.usdc.address,
        6,
        "usdc",
        "usd//c"
    );

    const typedValueParsed = "100000000000000000000";
    const wethAmount = CurrencyAmount.fromRawAmount(
        weth,
        JSBI.BigInt(typedValueParsed)
    );

    const route = await router.route(
        wethAmount,
        usdc,
        TradeType.EXACT_INPUT,
        {
            recipient: signer.address,
            slippageTolerance: new Percent(5, 100),
            deadline: Date.now() + 1800,
        },
        { maxSplits: 1 }
    );
    const tokenPath = route?.route[0].tokenPath.map((token) => token.address);
    console.log("TokenPath: ", tokenPath);
    const feePromises = route?.route[0].poolAddresses.map(
        async (poolAddress) => {
            const contract = polygonSdk.uniswap.v3.pool.attach(poolAddress);
            const fee = await contract.fee();
            return fee;
        }
    );
    if (feePromises !== undefined) {
        const fees = await Promise.all(feePromises);
        console.log("Fees: ", fees);
    }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
