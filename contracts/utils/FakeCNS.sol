// SPDX-License-Identifier: MIT

pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

contract CnsResolve{
  function resolve(bytes32 _addr) public virtual pure returns (address) {
    return address(uint160(uint256(_addr) >> (12 * 8)));
  }
}