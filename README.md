# Sacred

## Introduction

This is a variant of Tornado cash compatible with Conflux network. The source code is orginiated from [tornado-anonymity-mining](https://github.com/tornadocash/tornado-anonymity-mining), [tornado-core](https://github.com/tornadocash/tornado-core).

## Installation

### Dependencies

1. node 12
2. yarn
3. zkutil (`brew install rust && cargo install zkutil`)

### Build

```bash
$ yarn
$ cp .env.example .env
$ yarn build
```

### Test

Current test code is incompetible with Conflux's RPC. So you can only test it via the Ethereum tool-chains.

1. Run a personal ethereum.

```bash
$ npx ganache-cli
```

2. Run test.

```bash
$ yarn test
```

### Deployment on Testnet

1. Use [Conflux Portal](https://portal.conflux-chain.org/) to claim the CFX tokens on testnet.
2. Put your private key in `truffle.js` and `.env`
3. Run `yarn deploy:cfxtest`

## Contract guidance

TBA.
