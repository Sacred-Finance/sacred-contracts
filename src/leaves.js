const BATCH_SIZE = 1024
const { format } = require('js-conflux-sdk')
const { methods } = require('./adapter.js')

async function fetchLeaves(tree) {
  const size = await methods(tree).nextIndex().call()
  const batches = Math.ceil(format.uInt(size) / BATCH_SIZE)
  var tasks = []
  for (i = 0; i < batches; i++) {
    tasks.push(
      methods(tree)
        .leafSlice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE - 1)
        .call(),
    )
  }
  const answers = await Promise.all(tasks)
  return answers.flat().map((e) => format.hex(e))
}

module.exports = { fetchLeaves }
