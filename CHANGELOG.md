# Changelog

## Solidity interface

- Change the constructor of contract `TornadoTrees`.
- Make the Tornado Trees be updated on time. Remove the functions `getRegisteredDeposits`, `getRegisteredWithdrawals`, `updateRoot`, `updateDepositTree`, `updateWithdrawalTree`. Remove the variables `deposits`, `lastProcessedDepositLeaf`, `withdrawals`, `lastProcessedWithdrawalLeaf`. Add the functions `withdrawalTreeSize`, `depositTreeSize`.
- Add `hasher` and `logger` to the constructor of contract `Tornado`, `ETHTornado` and `ERC20Tornado`.

## ZK witness and proof generation

- The hash function of Merkle tree in circuit `WithdrawAsset` is changed from MiMC to Poseidon. The maintainance of Merkle tree in Javascript code should be changed correspondingly.
- The `extData` of circuit `WithdrawAsset` (`reciepent`, `relayer`, `fee`, `refund`) is replaced by `extDataHash`. You should compute the hash value `extDataHash` when generating zk-proof. The hash value computation in verivication process has been embedded in the solidity code.

Compare `test/ETHTornado.test.js` with the same file in repo `tornado-core` to see the details of ZK-related change.

## The other details

- Remove the requirement for `TornadoProxy`
- Add staking property to contract `CFXTornado`
- Rename the `tornado` to `sacred`
