// SPDX-License-Identifier: MIT

pragma solidity ^0.6.0;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "torn-token/contracts/ENS.sol";
import "./utils/FloatMath.sol";

/**
  Let's imagine we have 1M SACRED tokens for anonymity mining to distribute during 1 year (~31536000 seconds).
  The contract should constantly add liquidity to a pool of claimed rewards to SACRED (REWD/SACRED). At any time user can exchange REWD->SACRED using
  this pool. The rate depends on current available SACRED liquidity - the more SACRED are withdrawn the worse the swap rate is.

  The contract starts with some virtual balance liquidity and adds some SACRED tokens every second to the balance. Users will decrease
  this balance by swaps.

  Exchange rate can be calculated as following:
  BalanceAfter = BalanceBefore * e^(-rewardAmount/poolWeight)
  tokens = BalanceBefore - BalanceAfter
*/

contract RewardSwap is EnsResolve {
  using SafeMath for uint256;

  uint256 public constant DURATION = 365 days;

  IERC20 public immutable sacred;
  address public immutable miner;
  uint256 public immutable startTimestamp;
  uint256 public immutable initialLiquidity;
  uint256 public immutable liquidity;
  uint256 public tokensSold;
  uint256 public poolWeight;

  event Swap(address indexed recipient, uint256 pSACRED, uint256 SACRED);
  event PoolWeightUpdated(uint256 newWeight);

  modifier onlyMiner() {
    require(msg.sender == miner, "Only Miner contract can call");
    _;
  }

  constructor(
    bytes32 _sacred,
    bytes32 _miner,
    uint256 _miningCap,
    uint256 _initialLiquidity,
    uint256 _poolWeight
  ) public {
    require(_initialLiquidity <= _miningCap, "Initial liquidity should be lower than mining cap");
    sacred = IERC20(resolve(_sacred));
    miner = resolve(_miner);
    initialLiquidity = _initialLiquidity;
    liquidity = _miningCap.sub(_initialLiquidity);
    poolWeight = _poolWeight;
    startTimestamp = getTimestamp();
  }

  function swap(address _recipient, uint256 _amount) external onlyMiner returns (uint256) {
    uint256 tokens = getExpectedReturn(_amount);
    tokensSold += tokens;
    require(sacred.transfer(_recipient, tokens), "transfer failed");
    emit Swap(_recipient, _amount, tokens);
    return tokens;
  }

  /**
    @dev
   */
  function getExpectedReturn(uint256 _amount) public view returns (uint256) {
    uint256 oldBalance = sacredVirtualBalance();
    int128 pow = FloatMath.neg(FloatMath.divu(_amount, poolWeight));
    int128 exp = FloatMath.exp(pow);
    uint256 newBalance = FloatMath.mulu(exp, oldBalance);
    return oldBalance.sub(newBalance);
  }

  function sacredVirtualBalance() public view returns (uint256) {
    uint256 passedTime = getTimestamp().sub(startTimestamp);
    if (passedTime < DURATION) {
      return initialLiquidity.add(liquidity.mul(passedTime).div(DURATION)).sub(tokensSold);
    } else {
      return sacred.balanceOf(address(this));
    }
  }

  function setPoolWeight(uint256 _newWeight) external onlyMiner {
    poolWeight = _newWeight;
    emit PoolWeightUpdated(_newWeight);
  }

  function getTimestamp() public view virtual returns (uint256) {
    return block.timestamp;
  }
}
