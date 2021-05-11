// SPDX-License-Identifier: MIT

pragma solidity ^0.6.12;

interface IRewardSwap {
  function swap(address recipient, uint256 amount) external returns (uint256);

  function setPoolWeight(uint256 newWeight) external;
}
