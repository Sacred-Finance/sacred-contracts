// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.6.12;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract ERC20Mock is ERC20 {
  constructor() public ERC20("DAIMock", "DAIM") {}

  function mint(address recipient, uint256 amount) public {
    _mint(recipient, amount);
  }
}
