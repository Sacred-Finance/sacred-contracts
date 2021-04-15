// SPDX-License-Identifier: MIT
pragma solidity >=0.4.21;
pragma experimental ABIEncoderV2;

interface Announcement {
  struct Entry {
    bytes key;
    bytes value;
  }

  event Announce(address indexed announcer, bytes indexed keyHash, bytes key, bytes value);

  function announce(bytes calldata key, bytes calldata value) external returns (uint256 count);

  function announce(Entry[] calldata array) external returns (uint256 count);
}
