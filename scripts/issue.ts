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
import { getSwapData, getSigner } from "./utils";
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
    const setAmount = 1;
    const setAmountWei = ethers.utils.parseEther(setAmount.toString());
    const setToken= polygonSdk.tokens.iBtcFli;
    const setTokenAddress = setToken.address;

    // Calculation of maxAmountIn based on max price you want to pay in usd and usd price of input token
    // Hardcoded max price to pay in usd TODO: Update / Check everytime you use
    const setMaxPrice = 120;
    // Hardcoded weth price in USD TODO: Update / Check everytime you use
    const inputToken = polygonSdk.tokens.weth;
    const inputTokenAddress = inputToken.address;
    const inputTokenPrice = 2600;
    const maxAmountIn = (setAmount * setMaxPrice) / inputTokenPrice;
    console.log("maxAmountIn", maxAmountIn);
    const maxAmountInWei = ethers.utils.parseUnits(maxAmountIn.toString(), await inputToken.decimals());

    const {
        debtToken: debtTokenAddress,
        collateralToken: collateralTokenAddress,
        debtAmount,
    } = await polygonSdk.exchangeIssuanceLeveraged.getLeveragedTokenData(
        setTokenAddress,
        setAmountWei,
        true
    );
    const debtToken = polygonSdk.tokens.weth.attach(debtTokenAddress);
    const collateralToken = polygonSdk.tokens.weth.attach(
        collateralTokenAddress
    );

    const chainId = 137;

    // Code to get gas price from api. Commented out since it seemed to be inaccurate
    // const gasPriceApi = "https://gasstation-mainnet.matic.network";
    // const response = await axios(gasPriceApi);
    // const gasPrice = ethers.utils.parseUnits(response.data.fastest.toString(), "gwei");
    // Hardcoded gas price TODO: Update / Check everytime you use
    const gasPrice = ethers.utils.parseUnits("60", "gwei");

    console.log("Gas Price:", ethers.utils.formatUnits(gasPrice, "gwei"));

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
    const swapDataDebtForCollateral = await getSwapData(
        router,
        debtAmount,
        debtToken,
        collateralToken,
        signer
    );
    console.log("swapDataDebtForCollateral", swapDataDebtForCollateral);

    // Since we use the collateral as input  token we can leave this data empty
    let swapDataInputToken: { path: string[]; fees: number[] } = {
        path: [],
        fees: [],
    };
    if (inputTokenAddress !== collateralTokenAddress) {
        swapDataInputToken = await getSwapData(
            router,
            maxAmountInWei,
            inputToken,
            collateralToken,
            signer
        );
    }
    console.log("swapDataInputToken", swapDataInputToken);

    const inputBalance = await inputToken.balanceOf(signer.address);
    assert(inputBalance.gte(maxAmountInWei), "Not enough input token balance");

    const allowance = await inputToken.allowance(
        signer.address,
        polygonSdk.exchangeIssuanceLeveraged.address
    );
    console.log("Allowance", ethers.utils.formatEther(allowance));
    if (allowance.lt(maxAmountInWei)) {
        console.log(
            "Amount needed to approve",
            ethers.utils.formatUnits(maxAmountInWei, await inputToken.decimals())
        );
        const answer = readline.question(
            "Do you want approve the exchange Issuance contract to spend your tokens (press y to confirm or any other key to cancel)?"
        );

        if (answer !== "y") {
            console.log("Aborting");
            process.exit(1);
        }
        console.log("Approving");
        const approveTx = await inputToken.approve(
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
        setToken: await setToken.name(),
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
