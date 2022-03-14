// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import { ethers, network } from "hardhat";
import { getPolygonSdk } from "@dethcrypto/eth-sdk-client";
import { AlphaRouter } from "@uniswap/smart-order-router";
import { Token, CurrencyAmount, Percent, TradeType } from "@uniswap/sdk-core";
import { BigNumber, getDefaultProvider, Wallet, Signer } from "ethers";
import { getSwapDataCollateralForDebt, getSigner } from "./utils";
import { Exchange } from "./types";
import JSBI from "jsbi";
import assert from "assert";
import axios from "axios";
import util from "util";
import readline from "readline-sync";

async function main() {
    const signer = await getSigner();
    if (signer == null) {
        throw new Error(
            "Signer undefined, remember to set private key when running against mainnet"
        );
    }
    const polygonSdk = getPolygonSdk(signer);

    const gasScalingFactor = 110;

    // Hardcoded amount to redeem TODO: Update / Check everytime you use
    const setAmount = 5;
    const setAmountWei = ethers.utils.parseEther(setAmount.toString());
    const setToken = polygonSdk.tokens.eth2xFli;
    const setTokenAddress = setToken.address;

    const debtToken = polygonSdk.tokens.usdc;
    const collateralToken = polygonSdk.tokens.weth;
    // Calculation of setAmount based on max price you want to pay in usd and usd price of input token
    // Hardcoded max price to pay in usd TODO: Update / Check everytime you use
    const setMinPrice = 23;
    // Hardcoded weth price in USD TODO: Update / Check everytime you use
    const outputTokenPrice = 2570;
    const outputToken = collateralToken;
    const outputTokenAddress = outputToken.address;
    const outputTokenDecimals = await outputToken.decimals();
    const minAmountOut = (setAmount * setMinPrice) / outputTokenPrice;
    console.log("minAmountOut", minAmountOut);
    const minAmountOutWei = ethers.utils.parseUnits(
        minAmountOut.toString(),
        outputTokenDecimals
    );

    const chainId = 137;

    // Code to get gas price from api. Commented out since it seemed to be inaccurate
    // const gasPriceApi = "https://gasstation-mainnet.matic.network";
    // const response = await axios(gasPriceApi);
    // const gasPrice = ethers.utils.parseUnits(response.data.fastest.toString(), "gwei");
    // Hardcoded gas price TODO: Update / Check everytime you use
    const gasPrice = ethers.utils.parseUnits("60", "gwei");

    console.log("Gas Price:", ethers.utils.formatUnits(gasPrice, "gwei"));

    const {
        debtToken: debtTokenAddress,
        collateralToken: collateralTokenAddress,
        debtAmount,
    } = await polygonSdk.exchangeIssuanceLeveraged.getLeveragedTokenData(
        polygonSdk.tokens.eth2xFli.address,
        setAmountWei,
        false
    );

    assert(debtTokenAddress === debtToken.address, "Debt token mismatch");
    assert(
        collateralTokenAddress === collateralToken.address,
        "Collateral token mismatch"
    );

    // Get swap data for uniV3 swap from debt to collateral token (USDC -> WETH);
    const routerConfig = {
        chainId,
        provider: ethers.provider,
    };
    const router = new AlphaRouter(routerConfig);
    const swapDataCollateralForDebt = await getSwapDataCollateralForDebt(
        router,
        debtAmount,
        debtToken,
        collateralToken,
        signer
    );
    console.log("swapDataCollateralForDebt", swapDataCollateralForDebt);

    // Since we use the collateral as input  token we can leave this data empty
    // TODO: Replace with swap data OutputToken -> WETH if not paying in WETH
    const swapDataOutputToken = { path: [], fees: [] };

    const setBalance = await setToken.balanceOf(signer.address);
    console.log("setBalance", ethers.utils.formatEther(setBalance));
    assert(setBalance.gte(setAmountWei), "Not enough set balance");

    const outputBalance = await outputToken.balanceOf(signer.address);


    const allowance = await setToken.allowance(
        signer.address,
        polygonSdk.exchangeIssuanceLeveraged.address
    );

    console.log("Allowance", ethers.utils.formatEther(allowance));
    if (allowance.lt(setAmountWei)) {
        console.log(
            "Amount needed to approve",
            ethers.utils.formatEther(setAmountWei)
        );
        const answer = readline.question(
            "Do you want approve the exchange Issuance contract to spend your token (press y to confirm or any other key to cancel)?"
        );

        if (answer !== "y") {
            console.log("Aborting");
            process.exit(1);
        }
        console.log("Approving");
        const approveTx = await setToken.approve(
            polygonSdk.exchangeIssuanceLeveraged.address,
            setAmountWei,
            { gasPrice }
        );
        console.log("Approve Tx", approveTx.hash);
        await approveTx.wait();
        console.log("Approved");
    }

    const metaData = {
        setMinPrice,
        outputTokenPrice,
        setBalance: ethers.utils.formatEther(setBalance),
        from: signer.address,
        arguments: {
            setTokenAddress,
            setAmount: ethers.utils.formatEther(setAmountWei),
            outputTokenAddress,
            minAmountOut: ethers.utils.formatEther(minAmountOutWei),
            swapDataCollateralForDebt,
            swapDataOutputToken,
        },
    };
    console.log(
        "Transaction data",
        util.inspect(metaData, { showHidden: false, depth: null, colors: true })
    );

    console.log("Estimating gas");
    const gasEstimate =
        await polygonSdk.exchangeIssuanceLeveraged.estimateGas.redeemExactSetForERC20(
            setTokenAddress,
            setAmountWei,
            outputTokenAddress,
            minAmountOutWei,
            Exchange.UniV3,
            swapDataCollateralForDebt,
            swapDataOutputToken
        );
    const gasLimit = gasEstimate.mul(gasScalingFactor).div(100);
    const gasCostEstimate = ethers.utils.formatEther(gasEstimate.mul(gasPrice));
    const gasCostLimit = ethers.utils.formatEther(gasLimit.mul(gasPrice));
    console.log("Gas", { gasCostEstimate, gasCostLimit });

    const answer = readline.question(
        "Do you want to continue and redeem (press y to confirm or any other key to cancel)?"
    );
    if (answer !== "y") {
        console.log("Aborting");
        process.exit(1);
    }

    const redeemTx =
        await polygonSdk.exchangeIssuanceLeveraged.redeemExactSetForERC20(
            setTokenAddress,
            setAmountWei,
            outputTokenAddress,
            minAmountOutWei,
            Exchange.UniV3,
            swapDataCollateralForDebt,
            swapDataOutputToken,
            { gasPrice, gasLimit }
        );
    console.log("redeemTx", redeemTx.hash);
    await redeemTx.wait();

    const outputBalanceAfter = await outputToken.balanceOf(signer.address);
    const outputTokenReceived = outputBalanceAfter.sub(outputBalance);
    console.log(
        "Output token received",
        ethers.utils.formatUnits(
            outputTokenReceived,
            await outputToken.decimals()
        )
    );
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
