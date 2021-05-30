// SPDX-License-Identifier: MIT
pragma solidity >=0.4.15;
import "./Staking.sol";

contract AutoStaking {
  Staking public constant STAKING = Staking(address(0x0888000000000000000000000000000000000002));
  event NotStaking();

  modifier autoStaking {
    uint256 staking_balance = STAKING.getStakingBalance(address(this));
    STAKING.withdraw(staking_balance);
    _;
    if (address(this).balance >= 1 ether) {
      STAKING.deposit(address(this).balance);
    } else {
      emit NotStaking();
    }
  }
}
