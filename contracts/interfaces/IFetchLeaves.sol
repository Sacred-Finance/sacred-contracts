// SPDX-License-Identifier: MIT

pragma solidity ^0.6.12;

interface IFetchLeaves {
  function leafSlice(uint256 _start, uint256 _end) external view returns (bytes32[] memory);

  function nextIndex() external returns (uint32);
}
