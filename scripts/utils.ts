import { ethers } from "hardhat";
import { getPolygonSdk } from "@dethcrypto/eth-sdk-client";
import { AlphaRouter } from "@uniswap/smart-order-router";
import { Token, CurrencyAmount, Percent, TradeType } from "@uniswap/sdk-core";
import { BigNumber, Wallet } from "ethers";
import JSBI from "jsbi";

export async function getTokenPathAndFees(
    router: AlphaRouter,
    amountRaw: string,
    tokenIn: Token,
    tokenOut: Token,
    signer: any,
    isExactInput: boolean = true,
    slippageTolerance: number = 5
) {
    const polygonSdk = getPolygonSdk(signer);

    let route;
    if (isExactInput) {
        const amountIn = CurrencyAmount.fromRawAmount(
            tokenIn,
            JSBI.BigInt(amountRaw)
        );
        const swapOptions = {
            recipient: signer.address,
            slippageTolerance: new Percent(slippageTolerance, 100),
            deadline: Date.now() + 1800,
        };
        route = await router.route(
            amountIn,
            tokenOut,
            TradeType.EXACT_INPUT,
            swapOptions,
            { maxSplits: 1 }
        );
    } else {
        const amountOut = CurrencyAmount.fromRawAmount(
            tokenOut,
            JSBI.BigInt(amountRaw)
        );
        route = await router.route(
            amountOut,
            tokenIn,
            TradeType.EXACT_OUTPUT,
            {
                recipient: signer.address,
                slippageTolerance: new Percent(slippageTolerance, 100),
                deadline: Date.now() + 1800,
            },
            { maxSplits: 1 }
        );
    }

    const path: string[] =
        route?.route[0].tokenPath.map((token) => token.address) ?? [];
    const feePromises = route?.route[0].poolAddresses.map(
        async (poolAddress) => {
            const contract = polygonSdk.uniswap.v3.pool.attach(poolAddress);
            const fee = await contract.fee();
            return fee;
        }
    );
    let fees: number[] = [];
    if (feePromises !== undefined) {
        fees = await Promise.all(feePromises);
    }
    return { path, fees };
}

export async function getSwapDataDebtForCollateral(
    router: AlphaRouter,
    debtAmount: BigNumber,
    debtToken: any,
    collateralToken: any,
    signer: any
) {
    const collateralTokenData = await getTokenData(collateralToken);
    const debtTokenData = await getTokenData(debtToken);

    return getTokenPathAndFees(
        router,
        debtAmount.toString(),
        debtTokenData,
        collateralTokenData,
        signer
    );
}

export async function getSwapDataCollateralForDebt(
    router: AlphaRouter,
    debtAmount: BigNumber,
    debtToken: any,
    collateralToken: any,
    signer: any
) {
    const collateralTokenData = await getTokenData(collateralToken);
    const debtTokenData = await getTokenData(debtToken);

    return getTokenPathAndFees(
        router,
        debtAmount.toString(),
        collateralTokenData,
        debtTokenData,
        signer,
        false
    );
}

async function getTokenData(token: any) {
    return new Token(
        137,
        token.address,
        await token.decimals(),
        await token.symbol(),
        await token.name()
    );
}


export async function getSigner() {
    if (process.env.USE_PRIVATE_KEY) {
        return new Wallet(process.env.PRIVATE_KEY as string, ethers.provider);
    }
    const signers = await ethers.getSigners();
    return signers[0];
}
