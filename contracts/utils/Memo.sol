// SPDX-License-Identifier: MIT

pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;
import "@openzeppelin/contracts/math/Math.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

contract Memo {
  using SafeMath for uint256;
  mapping(bytes32 => string) public memos;
  mapping(bytes32 => uint256) public nextIndex;

  event Set(address indexed _addr, bytes32 indexed topic_hash, string topic, uint256 index, string _value);

  function set(
    string calldata _topic,
    uint256 _index,
    string calldata _value
  ) public {
    bytes32 key = keccak256(abi.encode(address(msg.sender), _topic, _index));
    memos[key] = _value;

    bytes32 indexKey = keccak256(abi.encode(address(msg.sender), _topic));
    nextIndex[indexKey] = Math.max(nextIndex[indexKey], _index.add(1));

    bytes32 topicHash = keccak256(abi.encode(_topic));
    emit Set(address(msg.sender), topicHash, _topic, _index, _value);
  }

  function get(
    address _addr,
    string calldata _topic,
    uint256 _index
  ) public view returns (string memory) {
    bytes32 key = keccak256(abi.encode(_addr, _topic, _index));
    return memos[key];
  }

  function getKeys(bytes32[] calldata _keys) public view returns (string[] memory) {
    string[] memory answer = new string[](_keys.length);
    for (uint256 i = 0; i < _keys.length; i++) {
      answer[i] = memos[_keys[i]];
    }
    return answer;
  }

  function getNextIndices(bytes32[] calldata _keys) public view returns (uint256[] memory) {
    uint256[] memory answer = new uint256[](_keys.length);
    for (uint256 i = 0; i < _keys.length; i++) {
      answer[i] = nextIndex[_keys[i]];
    }
    return answer;
  }
}
