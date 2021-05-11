// SPDX-License-Identifier: MIT

pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

contract CnsResolve {
  function resolve(bytes32 _addr) public pure virtual returns (address) {
    return address(uint160(uint256(_addr) >> (12 * 8)));
  }
}
