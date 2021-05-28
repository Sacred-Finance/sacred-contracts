const { toBN } = require('web3-utils')
const { encrypt, decrypt } = require('eth-sig-util')
const { randomBN, poseidonHash } = require('./utils')

class Account {
  constructor({ amount, secret, nullifier } = {}) {
    this.amount = amount ? toBN(amount) : toBN('0')
    this.secret = secret ? toBN(secret) : randomBN(31)
    this.nullifier = nullifier ? toBN(nullifier) : randomBN(31)

    this.commitment = poseidonHash([this.amount, this.secret, this.nullifier])
    this.nullifierHash = poseidonHash([this.nullifier])

    if (this.amount.lt(toBN(0))) {
      throw new Error('Cannot create an account with negative amount')
    }
  }

  encode() {
    const bytes = Buffer.concat([
      this.amount.toBuffer('be', 31),
      this.secret.toBuffer('be', 31),
      this.nullifier.toBuffer('be', 31),
    ])
    return bytes.toString('base64')
  }

  static decode(message) {
    const buf = Buffer.from(message, 'base64')
    return new Account({
      amount: toBN('0x' + buf.slice(0, 31).toString('hex')),
      secret: toBN('0x' + buf.slice(31, 62).toString('hex')),
      nullifier: toBN('0x' + buf.slice(62, 93).toString('hex')),
    })
  }

  encrypt(pubkey) {
    return encrypt(pubkey, { data: this.encode() }, 'x25519-xsalsa20-poly1305')
  }

  static decrypt(privkey, data) {
    const decryptedMessage = decrypt(data, privkey)
    return Account.decode(decryptedMessage)
  }
}

module.exports = Account
