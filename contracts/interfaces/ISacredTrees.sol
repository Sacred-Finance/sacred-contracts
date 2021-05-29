// SPDX-License-Identifier: MIT

pragma solidity ^0.6.12;

interface ISacredTrees {
  function registerDeposit(address instance, bytes32 commitment) external;

  function registerWithdrawal(address instance, bytes32 nullifier) external;

  function registerAccount(bytes32 commitment) external;
}
