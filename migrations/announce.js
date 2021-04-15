const announce_abi = [
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'address',
        name: 'announcer',
        type: 'address',
      },
      {
        indexed: true,
        internalType: 'bytes',
        name: 'keyHash',
        type: 'bytes',
      },
      {
        indexed: false,
        internalType: 'bytes',
        name: 'key',
        type: 'bytes',
      },
      {
        indexed: false,
        internalType: 'bytes',
        name: 'value',
        type: 'bytes',
      },
    ],
    name: 'Announce',
    type: 'event',
  },
  {
    inputs: [
      {
        internalType: 'bytes',
        name: 'key',
        type: 'bytes',
      },
      {
        internalType: 'bytes',
        name: 'value',
        type: 'bytes',
      },
    ],
    name: 'announce',
    outputs: [
      {
        internalType: 'uint256',
        name: 'count',
        type: 'uint256',
      },
    ],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        components: [
          {
            internalType: 'bytes',
            name: 'key',
            type: 'bytes',
          },
          {
            internalType: 'bytes',
            name: 'value',
            type: 'bytes',
          },
        ],
        internalType: 'struct Announcement.Entry[]',
        name: 'array',
        type: 'tuple[]',
      },
    ],
    name: 'announce',
    outputs: [
      {
        internalType: 'uint256',
        name: 'count',
        type: 'uint256',
      },
    ],
    stateMutability: 'nonpayable',
    type: 'function',
  },
]
const announce_addr = 'cfxtest:aca514ancmbdu9u349u4m7d0u4jjdv83py3muarnv1'

module.exports = { announce_abi, announce_addr }
