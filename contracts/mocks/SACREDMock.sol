// SPDX-License-Identifier: MIT

pragma solidity ^0.6.12;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract SacredTokenMock is ERC20 {
  constructor() public ERC20("SacredMock", "SRD") {}

  function mint(address recipient, uint256 amount) public {
    _mint(recipient, amount);
  }
}
