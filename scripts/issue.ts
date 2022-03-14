// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import { ethers } from "hardhat";
import { getPolygonSdk } from "@dethcrypto/eth-sdk-client";
import { AlphaRouter } from "@uniswap/smart-order-router";
import assert from "assert";
import util from "util";
import readline from "readline-sync";
import { getSwapDataDebtForCollateral, getSigner } from "./utils";
import { Exchange } from "./types";

async function main() {
    const signer = await getSigner();
    if (signer == null) {
        throw new Error(
            "Signer undefined, remember to set private key when running against mainnet"
        );
    }
    const polygonSdk = getPolygonSdk(signer);

    const gasScalingFactor = 110;

    // Hardcoded amount to issue TODO: Update / Check everytime you use
    const setAmount = 5;
    const setAmountWei = ethers.utils.parseEther(setAmount.toString());
    const setTokenAddress = polygonSdk.tokens.eth2xFli.address;

    // Calculation of maxAmountIn based on max price you want to pay in usd and usd price of input token
    // Hardcoded max price to pay in usd TODO: Update / Check everytime you use
    const setMaxPrice = 29;
    // Hardcoded weth price in USD TODO: Update / Check everytime you use
    const inputTokenPrice = 2580;
    const inputTokenAddress = polygonSdk.tokens.weth.address;
    const maxAmountIn = (setAmount * setMaxPrice) / inputTokenPrice;
    console.log("maxAmountIn", maxAmountIn);
    const maxAmountInWei = ethers.utils.parseEther(maxAmountIn.toString());

    const chainId = 137;

    // Code to get gas price from api. Commented out since it seemed to be inaccurate
    // const gasPriceApi = "https://gasstation-mainnet.matic.network";
    // const response = await axios(gasPriceApi);
    // const gasPrice = ethers.utils.parseUnits(response.data.fastest.toString(), "gwei");
    // Hardcoded gas price TODO: Update / Check everytime you use
    const gasPrice = ethers.utils.parseUnits("60", "gwei");

    console.log("Gas Price:", ethers.utils.formatUnits(gasPrice, "gwei"));

    const { debtToken, collateralToken, debtAmount } =
        await polygonSdk.exchangeIssuanceLeveraged.getLeveragedTokenData(
            polygonSdk.tokens.eth2xFli.address,
            setAmountWei,
            true
        );

    assert(debtToken === polygonSdk.tokens.usdc.address, "Debt token mismatch");
    assert(
        collateralToken === polygonSdk.tokens.weth.address,
        "Collateral token mismatch"
    );

    // Get swap data for uniV3 swap from debt to collateral token (USDC -> WETH);
    const routerConfig = {
        chainId,
        provider: ethers.provider,
    };
    const router = new AlphaRouter(routerConfig);
    const swapDataDebtForCollateral = await getSwapDataDebtForCollateral(
        router,
        debtAmount,
        signer
    );
    console.log("swapDataDebtForCollateral", swapDataDebtForCollateral);

    // Since we use the collateral as input  token we can leave this data empty
    // TODO: Replace with swap data InputToken -> WETH if not paying in WETH
    const swapDataInputToken = { path: [], fees: [] };

    const inputBalance = await polygonSdk.tokens.weth.balanceOf(signer.address);
    assert(inputBalance.gte(maxAmountInWei), "Not enough input token balance");

    const allowance = await polygonSdk.tokens.weth.allowance(
        signer.address,
        polygonSdk.exchangeIssuanceLeveraged.address
    );
    console.log("Allowance", ethers.utils.formatEther(allowance));
    if (allowance.lt(maxAmountInWei)) {
        console.log(
            "Amount needed to approve",
            ethers.utils.formatEther(maxAmountInWei)
        );
        const answer = readline.question(
            "Do you want approve the exchange Issuance contract to spend your weth (press y to confirm or any other key to cancel)?"
        );

        if (answer !== "y") {
            console.log("Aborting");
            process.exit(1);
        }
        console.log("Approving");
        const approveTx = await polygonSdk.tokens.weth.approve(
            polygonSdk.exchangeIssuanceLeveraged.address,
            maxAmountInWei,
            { gasPrice }
        );
        console.log("Approve Tx", approveTx.hash);
        await approveTx.wait();
        console.log("Approved");
    }

    console.log("Estimating gas");
    const gasEstimate =
        await polygonSdk.exchangeIssuanceLeveraged.estimateGas.issueExactSetFromERC20(
            setTokenAddress,
            setAmountWei,
            inputTokenAddress,
            maxAmountInWei,
            Exchange.UniV3,
            swapDataDebtForCollateral,
            swapDataInputToken
        );
    const gasLimit = gasEstimate.mul(gasScalingFactor).div(100);
    const gasCostEstimate = ethers.utils.formatEther(gasEstimate.mul(gasPrice));
    const gasCostLimit = ethers.utils.formatEther(gasLimit.mul(gasPrice));
    const metaData = {
        setMaxPrice,
        inputTokenPrice,
        gasCostEstimate,
        gasCostLimit,
        inputTokenBalance: ethers.utils.formatEther(inputBalance),
        from: signer.address,
        arguments: {
            setTokenAddress,
            setAmount: ethers.utils.formatEther(setAmountWei),
            inputTokenAddress,
            maxAmountIn: ethers.utils.formatEther(maxAmountInWei),
            swapDataDebtForCollateral,
            swapDataInputToken,
        },
    };
    console.log(
        "Transaction data",
        util.inspect(metaData, { showHidden: false, depth: null, colors: true })
    );

    const answer = readline.question(
        "Do you want to continue and issue (press y to confirm or any other key to cancel)?"
    );
    if (answer !== "y") {
        console.log("Aborting");
        process.exit(1);
    }

    const issueTx =
        await polygonSdk.exchangeIssuanceLeveraged.issueExactSetFromERC20(
            setTokenAddress,
            setAmountWei,
            inputTokenAddress,
            maxAmountInWei,
            Exchange.UniV3,
            swapDataDebtForCollateral,
            swapDataInputToken,
            { gasPrice, gasLimit }
        );
    console.log("issueTx", issueTx.hash);
    await issueTx.wait();

    const inputBalanceAfter = await polygonSdk.tokens.weth.balanceOf(
        signer.address
    );
    const inputTokenSpent = inputBalance.sub(inputBalanceAfter);
    console.log("Input token spent", ethers.utils.formatEther(inputTokenSpent));
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
