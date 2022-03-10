# leveraged-ei-script
This repository contains a script to issue IndexCoop's ETH2XFli via an on chain smart contract called `ExchangeIssuanceLeveraged`.

USE AT YOUR OWN RISK. FUNDS MAY BE LOST. STRICTLY NO WARRANTY.

# Install
Run `yarn install` to install dependencies

# Build
Run `yarn eth-sdk` to download abis / generate typechain artifacts for smart contracts

# Configure
Copy `.env.example` to `.env` and adjust environment variables inside to correct values.

# Test
Run `yarn hardhat node` to run a local polygon fork.
Run `yarn hardhat run scripts/issue.ts --network localhost` to run the script against the local fork for testing (set `USE_PRIVATE_KEY=true` to use the private key configured in `.env` instead of the hardhat account.

# Run (DANGER ZONE - USE AT YOUR OWN RISK)
Run `USE_DEPLOYER=true yarn hardhat run scripts/issue.ts --network polygon` to run the script against polygon mainnet.
Review code / and all variables set before doing this. 


