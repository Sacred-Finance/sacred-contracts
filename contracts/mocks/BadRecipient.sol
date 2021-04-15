// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.6.0;

contract BadRecipient {
  fallback() external {
    require(false, "this contract does not accept ETH");
  }
}
